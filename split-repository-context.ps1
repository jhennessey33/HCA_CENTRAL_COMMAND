param(
    [string]$InputPath = (Join-Path $PWD "repository-context.txt"),
    [string]$OutputDirectory = $PWD,
    [int]$PartCount = 3
)

$ErrorActionPreference = "Stop"

if ($PartCount -lt 2) {
    throw "PartCount must be at least 2."
}

if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
    throw "Input file not found: $InputPath"
}

if (-not (Test-Path -LiteralPath $OutputDirectory -PathType Container)) {
    throw "Output directory not found: $OutputDirectory"
}

$InputFile = Get-Item -LiteralPath $InputPath
$InputFullPath = $InputFile.FullName
$OutputFullPath = (Get-Item -LiteralPath $OutputDirectory).FullName
$Utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)

# Read the combined context file and preserve each FILE section as one unit.
$Lines = [System.IO.File]::ReadAllLines($InputFullPath)
$FileHeaderPattern = '^FILE:\s+(.+)$'
$Sections = New-Object System.Collections.Generic.List[object]
$PreambleLines = New-Object System.Collections.Generic.List[string]
$CurrentLines = $null
$CurrentFilePath = $null

foreach ($Line in $Lines) {
    if ($Line -match $FileHeaderPattern) {
        if ($null -ne $CurrentLines) {
            $Sections.Add([pscustomobject]@{
                FilePath = $CurrentFilePath
                Lines = $CurrentLines.ToArray()
                CharacterCount = (($CurrentLines.ToArray() -join "`n").Length + 1)
            })
        }

        $CurrentFilePath = $Matches[1].Trim()
        $CurrentLines = New-Object System.Collections.Generic.List[string]
        $CurrentLines.Add($Line)
        continue
    }

    if ($null -eq $CurrentLines) {
        $PreambleLines.Add($Line)
    }
    else {
        $CurrentLines.Add($Line)
    }
}

if ($null -ne $CurrentLines) {
    $Sections.Add([pscustomobject]@{
        FilePath = $CurrentFilePath
        Lines = $CurrentLines.ToArray()
        CharacterCount = (($CurrentLines.ToArray() -join "`n").Length + 1)
    })
}

if ($Sections.Count -eq 0) {
    throw "No FILE sections were found in $InputFullPath. Expected lines such as: FILE: app/page.tsx"
}

if ($PartCount -gt $Sections.Count) {
    throw "PartCount ($PartCount) cannot exceed the number of file sections ($($Sections.Count))."
}

$TotalCharacters = ($Sections | Measure-Object -Property CharacterCount -Sum).Sum
$TargetCharactersPerPart = [math]::Ceiling($TotalCharacters / $PartCount)
$Parts = New-Object System.Collections.Generic.List[object]
$SectionIndex = 0

for ($PartNumber = 1; $PartNumber -le $PartCount; $PartNumber += 1) {
    $PartSections = New-Object System.Collections.Generic.List[object]
    $PartCharacters = 0
    $PartsRemainingAfterThis = $PartCount - $PartNumber

    while ($SectionIndex -lt $Sections.Count) {
        $SectionsRemaining = $Sections.Count - $SectionIndex

        # Reserve at least one whole file section for every remaining part.
        if ($SectionsRemaining -le $PartsRemainingAfterThis) {
            break
        }

        $NextSection = $Sections[$SectionIndex]
        $WouldExceedTarget =
            $PartSections.Count -gt 0 -and
            ($PartCharacters + $NextSection.CharacterCount) -gt $TargetCharactersPerPart

        if ($WouldExceedTarget -and $PartNumber -lt $PartCount) {
            break
        }

        $PartSections.Add($NextSection)
        $PartCharacters += $NextSection.CharacterCount
        $SectionIndex += 1
    }

    # The last part receives every remaining complete file section.
    if ($PartNumber -eq $PartCount) {
        while ($SectionIndex -lt $Sections.Count) {
            $NextSection = $Sections[$SectionIndex]
            $PartSections.Add($NextSection)
            $PartCharacters += $NextSection.CharacterCount
            $SectionIndex += 1
        }
    }

    $Parts.Add([pscustomobject]@{
        PartNumber = $PartNumber
        Sections = $PartSections.ToArray()
        CharacterCount = $PartCharacters
    })
}

$CreatedFiles = New-Object System.Collections.Generic.List[object]

foreach ($Part in $Parts) {
    $OutputName = "repository-context-part-$($Part.PartNumber)-of-$PartCount.txt"
    $OutputPath = Join-Path $OutputFullPath $OutputName
    $Writer = New-Object System.IO.StreamWriter($OutputPath, $false, $Utf8WithoutBom)

    try {
        $Writer.WriteLine("# HCA Central Command Repository Context")
        $Writer.WriteLine("")
        $Writer.WriteLine("Source: $InputFullPath")
        $Writer.WriteLine("Part: $($Part.PartNumber) of $PartCount")
        $Writer.WriteLine("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
        $Writer.WriteLine("Files in this part: $($Part.Sections.Count)")
        $Writer.WriteLine("")

        if ($Part.PartNumber -eq 1 -and $PreambleLines.Count -gt 0) {
            $Writer.WriteLine("# Original File Preamble")
            foreach ($PreambleLine in $PreambleLines) {
                $Writer.WriteLine($PreambleLine)
            }
            $Writer.WriteLine("")
        }

        foreach ($Section in $Part.Sections) {
            $Writer.WriteLine("=" * 100)
            foreach ($SectionLine in $Section.Lines) {
                $Writer.WriteLine($SectionLine)
            }
        }
    }
    finally {
        $Writer.Dispose()
    }

    $CreatedFiles.Add((Get-Item -LiteralPath $OutputPath))
}

$AssignedSectionCount = ($Parts | ForEach-Object { $_.Sections.Count } | Measure-Object -Sum).Sum

if ($AssignedSectionCount -ne $Sections.Count) {
    throw "Consistency check failed: assigned $AssignedSectionCount of $($Sections.Count) file sections."
}

Write-Host ""
Write-Host "Split complete."
Write-Host "Source file: $InputFullPath"
Write-Host "Source sections: $($Sections.Count)"
Write-Host ""

foreach ($CreatedFile in $CreatedFiles) {
    $SizeMb = [math]::Round($CreatedFile.Length / 1MB, 2)
    Write-Host "$($CreatedFile.Name): $SizeMb MB"
}
