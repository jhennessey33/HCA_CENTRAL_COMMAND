$OutputPath = Join-Path $PWD "repository-context.txt"

$AllowedExtensions = @(
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".prisma",
    ".css",
    ".scss",
    ".md",
    ".yml",
    ".yaml"
)

$ExcludedFiles = @(
    "package-lock.json",
    "repository-context.txt",
    "build-repository-context.ps1"
)

$ExcludedPatterns = @(
    "^\.env($|\.)",
    "^node_modules/",
    "^\.next/",
    "^dist/",
    "^build/",
    "^coverage/",
    "^public/",
    "^prisma/migrations/",
    "\.db$",
    "\.sqlite$",
    "\.sqlite3$",
    "\.db-journal$",
    "\.min\.js$"
)

$Utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
$Writer = New-Object System.IO.StreamWriter(
    $OutputPath,
    $false,
    $Utf8WithoutBom
)

try {
    $Writer.WriteLine("# HCA Central Command Repository Context")
    $Writer.WriteLine("")
    $Writer.WriteLine("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
    $Writer.WriteLine("Repository: $PWD")
    $Writer.WriteLine("")

    $Files = git ls-files |
        Where-Object {
            $RelativePath = $_
            $Extension = [System.IO.Path]::GetExtension($RelativePath)
            $FileName = [System.IO.Path]::GetFileName($RelativePath)

            $IsAllowedExtension = $AllowedExtensions -contains $Extension
            $IsExcludedFile = $ExcludedFiles -contains $FileName
            $MatchesExcludedPattern = $false

            foreach ($Pattern in $ExcludedPatterns) {
                if ($RelativePath -match $Pattern) {
                    $MatchesExcludedPattern = $true
                    break
                }
            }

            $IsAllowedExtension -and
            -not $IsExcludedFile -and
            -not $MatchesExcludedPattern
        } |
        Sort-Object

    foreach ($RelativePath in $Files) {
        $FullPath = Join-Path $PWD $RelativePath

        if (-not (Test-Path -LiteralPath $FullPath -PathType Leaf)) {
            continue
        }

        $Writer.WriteLine("")
        $Writer.WriteLine("=" * 100)
        $Writer.WriteLine("FILE: $RelativePath")
        $Writer.WriteLine("=" * 100)
        $Writer.WriteLine("")

        try {
            $Content = Get-Content -LiteralPath $FullPath -Raw -ErrorAction Stop

            if ($null -ne $Content) {
                $Writer.Write($Content)

                if (-not $Content.EndsWith("`n")) {
                    $Writer.WriteLine("")
                }
            }
        }
        catch {
            $Writer.WriteLine(
                "[Unable to read file: $($_.Exception.Message)]"
            )
        }
    }
}
finally {
    $Writer.Dispose()
}

$OutputFile = Get-Item -LiteralPath $OutputPath

Write-Host ""
Write-Host "Created: $($OutputFile.FullName)"
Write-Host "Size: $(:Round($OutputFile.Length / 1MB, 2)) MB"
Write-Host "Files included: $($Files.Count)"