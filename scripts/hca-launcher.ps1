Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $ScriptDirectory "hca-host.config.ps1"

$StartScriptPath = Join-Path $ScriptDirectory "start-hca-command.ps1"
$StopScriptPath = Join-Path $ScriptDirectory "stop-hca-command.ps1"
$BackupScriptPath = Join-Path $ScriptDirectory "backup-db.ps1"
$UpdateScriptPath = Join-Path $ScriptDirectory "update-hca-command.ps1"
$TakeoverScriptPath = Join-Path $ScriptDirectory "takeover-host.ps1"

if (-not (Test-Path $ConfigPath)) {
    [System.Windows.Forms.MessageBox]::Show(
        "Missing config file:`n`n$ConfigPath`n`nCopy scripts\hca-host.config.example.ps1 to scripts\hca-host.config.ps1 and update the paths.",
        "HCA Central Command",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null

    exit 1
}

. $ConfigPath

function Ensure-Directory {
    param(
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Write-HostEvent {
    param(
        [string]$Message
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $machine = $env:COMPUTERNAME
    $entry = "$timestamp [$machine] $Message"

    try {
        Ensure-Directory -Path $SharedLogsPath
        Add-Content -Path $HostEventsLogPath -Value $entry
    } catch {
        # Do not crash launcher if logging fails.
    }
}

function Test-HcaHealth {
    param(
        [string]$Url
    )

    try {
        $healthUrl = "$Url/api/health"
        $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5

        if ($response.StatusCode -eq 200) {
            return $true
        }

        return $false
    } catch {
        return $false
    }
}

function Get-LocalUrl {
    $hostName = $env:COMPUTERNAME
    return "http://$hostName`:$Port"
}

function Get-ActiveHostState {
    if (-not (Test-Path $ActiveHostPath)) {
        return $null
    }

    try {
        return Get-Content -Path $ActiveHostPath -Raw | ConvertFrom-Json
    } catch {
        return [pscustomobject]@{
            status = "ERROR"
            message = "Could not parse active-host.json"
        }
    }
}

function Invoke-HcaScript {
    param(
        [string]$ScriptPath,
        [string]$DisplayName,
        [string[]]$Arguments = @(),
        [switch]$Wait,
        [switch]$KeepWindowOpen
    )

    if (-not (Test-Path $ScriptPath)) {
        [System.Windows.Forms.MessageBox]::Show(
            "Missing script:`n`n$ScriptPath",
            "HCA Central Command",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null

        return $null
    }

    Write-HostEvent "LAUNCHER invoking script. Name=$DisplayName Path=$ScriptPath"

    $argumentList = @(
        "-NoProfile"
    )

    if ($KeepWindowOpen) {
        $argumentList += "-NoExit"
    }

    $argumentList += @(
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "`"$ScriptPath`""
    )

    $argumentList += $Arguments

    $startProcessParameters = @{
        FilePath     = "powershell.exe"
        ArgumentList = $argumentList
        PassThru     = $true
    }

    if ($Wait) {
        $startProcessParameters.Wait = $true
    }

    return Start-Process @startProcessParameters
}

function Open-Url {
    param(
        [string]$Url
    )

    if ([System.String]::IsNullOrWhiteSpace($Url)) {
        [System.Windows.Forms.MessageBox]::Show(
            "No HCA URL is currently available.",
            "HCA Central Command",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null

        return
    }

    Start-Process "$($Url.TrimEnd('/'))/login"
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "HCA Central Command Launcher"
$form.Size = New-Object System.Drawing.Size(640, 520)
$form.StartPosition = "CenterScreen"
$form.MinimumSize = New-Object System.Drawing.Size(640, 520)

$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = "HCA Central Command"
$titleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$titleLabel.AutoSize = $true
$titleLabel.Location = New-Object System.Drawing.Point(24, 20)
$form.Controls.Add($titleLabel)

$subtitleLabel = New-Object System.Windows.Forms.Label
$subtitleLabel.Text = "Personal Machine Active Host Launcher"
$subtitleLabel.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$subtitleLabel.AutoSize = $true
$subtitleLabel.Location = New-Object System.Drawing.Point(28, 58)
$form.Controls.Add($subtitleLabel)

$statusBox = New-Object System.Windows.Forms.TextBox
$statusBox.Multiline = $true
$statusBox.ReadOnly = $true
$statusBox.ScrollBars = "Vertical"
$statusBox.Font = New-Object System.Drawing.Font("Consolas", 10)
$statusBox.Location = New-Object System.Drawing.Point(28, 90)
$statusBox.Size = New-Object System.Drawing.Size(570, 165)
$form.Controls.Add($statusBox)

$startButton = New-Object System.Windows.Forms.Button
$startButton.Text = "Start / Open HCA"
$startButton.Location = New-Object System.Drawing.Point(28, 280)
$startButton.Size = New-Object System.Drawing.Size(175, 40)
$form.Controls.Add($startButton)

$openButton = New-Object System.Windows.Forms.Button
$openButton.Text = "Open App"
$openButton.Location = New-Object System.Drawing.Point(220, 280)
$openButton.Size = New-Object System.Drawing.Size(175, 40)
$form.Controls.Add($openButton)

$refreshButton = New-Object System.Windows.Forms.Button
$refreshButton.Text = "Refresh Status"
$refreshButton.Location = New-Object System.Drawing.Point(412, 280)
$refreshButton.Size = New-Object System.Drawing.Size(175, 40)
$form.Controls.Add($refreshButton)

$stopButton = New-Object System.Windows.Forms.Button
$stopButton.Text = "Stop Hosting"
$stopButton.Location = New-Object System.Drawing.Point(28, 335)
$stopButton.Size = New-Object System.Drawing.Size(175, 40)
$form.Controls.Add($stopButton)

$backupButton = New-Object System.Windows.Forms.Button
$backupButton.Text = "Backup Now"
$backupButton.Location = New-Object System.Drawing.Point(220, 335)
$backupButton.Size = New-Object System.Drawing.Size(175, 40)
$form.Controls.Add($backupButton)

$updateButton = New-Object System.Windows.Forms.Button
$updateButton.Text = "Check For Updates"
$updateButton.Location = New-Object System.Drawing.Point(412, 335)
$updateButton.Size = New-Object System.Drawing.Size(175, 40)
$form.Controls.Add($updateButton)

$takeoverButton = New-Object System.Windows.Forms.Button
$takeoverButton.Text = "Emergency Takeover"
$takeoverButton.Location = New-Object System.Drawing.Point(28, 390)
$takeoverButton.Size = New-Object System.Drawing.Size(175, 40)
$form.Controls.Add($takeoverButton)

$logsButton = New-Object System.Windows.Forms.Button
$logsButton.Text = "View Logs"
$logsButton.Location = New-Object System.Drawing.Point(220, 390)
$logsButton.Size = New-Object System.Drawing.Size(175, 40)
$form.Controls.Add($logsButton)

$closeButton = New-Object System.Windows.Forms.Button
$closeButton.Text = "Close Launcher"
$closeButton.Location = New-Object System.Drawing.Point(412, 390)
$closeButton.Size = New-Object System.Drawing.Size(175, 40)
$form.Controls.Add($closeButton)

$footerLabel = New-Object System.Windows.Forms.Label
$footerLabel.Text = "If this machine is hosting HCA, click Stop Hosting before shutting down."
$footerLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$footerLabel.AutoSize = $true
$footerLabel.Location = New-Object System.Drawing.Point(28, 450)
$form.Controls.Add($footerLabel)

$currentOpenUrl = ""

function Refresh-LauncherStatus {
    $state = Get-ActiveHostState
    $localUrl = Get-LocalUrl
    $machine = $env:COMPUTERNAME

    $lines = @()
    $lines += "Current machine: $machine"
    $lines += "Local URL:       $localUrl"
    $lines += "Shared root:     $SharedRoot"
    $lines += ""

    $currentOpenUrl = ""

    if (-not $state) {
        $lines += "Status:          NOT RUNNING"
        $lines += "Active host:     none"
        $lines += ""
        $lines += "Click Start / Open HCA to become the active host."
        $script:currentOpenUrl = $localUrl

        $stopButton.Enabled = $false
        $backupButton.Enabled = $false
        $takeoverButton.Enabled = $false
        $openButton.Enabled = $false
    } elseif ($state.status -eq "RUNNING") {
        $activeHost = [string]$state.activeHost
        $activeUrl = [string]$state.url
        $isHealthy = $false

        if ($activeUrl) {
            $isHealthy = Test-HcaHealth -Url $activeUrl
        }

        $lines += "Status:          RUNNING"
        $lines += "Active host:     $activeHost"
        $lines += "Active URL:      $activeUrl"
        $lines += "Health check:    $isHealthy"
        $lines += "Git commit:      $($state.gitCommit)"
        $lines += ""

        if ($isHealthy) {
            $lines += "HCA is already running. Use Open App."
            $script:currentOpenUrl = $activeUrl
            $openButton.Enabled = $true
            $takeoverButton.Enabled = $false
        } else {
            $lines += "Previous active host is not reachable."
            $lines += "Do not start normally unless takeover is intentional."
            $script:currentOpenUrl = $activeUrl
            $openButton.Enabled = $false
            $takeoverButton.Enabled = $true
        }

        if ($activeHost -eq $machine) {
            $stopButton.Enabled = $true
            $backupButton.Enabled = $true
        } else {
            $stopButton.Enabled = $false
            $backupButton.Enabled = $false
        }
    } elseif ($state.status -eq "STOPPED") {
        $lines += "Status:          STOPPED"
        $lines += "Last host:       $($state.lastActiveHost)"
        $lines += "Last URL:        $($state.lastUrl)"
        $lines += "Stopped at:      $($state.stoppedAt)"
        $lines += "Last backup:     $($state.lastBackupPath)"
        $lines += ""
        $lines += "Click Start / Open HCA to pull the latest backup and host locally."

        $script:currentOpenUrl = $localUrl
        $openButton.Enabled = $false
        $stopButton.Enabled = $false
        $backupButton.Enabled = $false
        $takeoverButton.Enabled = $false
    } else {
        $lines += "Status:          ERROR"
        $lines += "Message:         $($state.message)"
        $lines += ""
        $lines += "Fix active-host.json or contact Joseph."

        $openButton.Enabled = $false
        $stopButton.Enabled = $false
        $backupButton.Enabled = $false
        $takeoverButton.Enabled = $false
    }

   $statusBox.Text = ($lines -join "`r`n")
}

$startButton.Add_Click({
    $state = Get-ActiveHostState

    if ($state -and $state.status -eq "RUNNING" -and $state.url) {
        $activeUrl = [string]$state.url

        if (Test-HcaHealth -Url $activeUrl) {
            Open-Url -Url $activeUrl
            return
        }
    }

    $statusBox.Text = "HCA is starting...`r`n`r`nThe application will open automatically when ready."
    [System.Windows.Forms.Application]::DoEvents()

    Invoke-HcaScript `
        -ScriptPath $StartScriptPath `
        -DisplayName "Start / Open HCA" | Out-Null

    Refresh-LauncherStatus
})
$openButton.Add_Click({
    Open-Url -Url $script:currentOpenUrl
})

$refreshButton.Add_Click({
    Refresh-LauncherStatus
})

$stopButton.Add_Click({
    $dialogResult = [System.Windows.Forms.MessageBox]::Show(
        "Stop hosting HCA on this computer?`n`nThe latest database will be backed up before HCA stops.",
        "Stop HCA Hosting",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )

    if ($dialogResult -ne [System.Windows.Forms.DialogResult]::Yes) {
        return
    }

    $stopButton.Enabled = $false
    $statusBox.Text = "Backing up the database and stopping HCA...`r`n`r`nDo not shut down this computer yet."

    try {
        $process = Invoke-HcaScript `
            -ScriptPath $StopScriptPath `
            -DisplayName "Stop Hosting" `
            -Wait

        if ($process -and $process.ExitCode -eq 0) {
            [System.Windows.Forms.MessageBox]::Show(
                "HCA hosting has stopped successfully.`n`nThe latest database backup has been saved. This computer may now be shut down.",
                "HCA Central Command",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            ) | Out-Null
        } else {
            [System.Windows.Forms.MessageBox]::Show(
                "The stop operation reported an error.`n`nDo not shut down this computer until the host log has been reviewed.",
                "HCA Central Command",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Warning
            ) | Out-Null
        }
    } finally {
        $stopButton.Enabled = $true
        Refresh-LauncherStatus
    }
})

$backupButton.Add_Click({
    Invoke-HcaScript `
        -ScriptPath $BackupScriptPath `
        -DisplayName "Backup Now" `
        -Arguments @("-Reason", "launcher") | Out-Null

    Refresh-LauncherStatus
})

$updateButton.Add_Click({
    Invoke-HcaScript `
        -ScriptPath $UpdateScriptPath `
        -DisplayName "Check For Updates" | Out-Null

    Refresh-LauncherStatus
})

$takeoverButton.Add_Click({
    $dialogResult = [System.Windows.Forms.MessageBox]::Show(
        "Emergency Takeover should only be used if the previous active host is unavailable.`n`nThis machine will become the active host using the latest shared backup.`n`nContinue?",
        "Emergency Takeover",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )

    if ($dialogResult -eq [System.Windows.Forms.DialogResult]::Yes) {
        Invoke-HcaScript -ScriptPath $TakeoverScriptPath -DisplayName "Emergency Takeover"
        Refresh-LauncherStatus
    }
})

$logsButton.Add_Click({
    if (Test-Path $HostEventsLogPath) {
        Start-Process notepad.exe $HostEventsLogPath
    } else {
        [System.Windows.Forms.MessageBox]::Show(
            "Log file does not exist yet:`n`n$HostEventsLogPath",
            "HCA Central Command",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
    }
})

$closeButton.Add_Click({
    $form.Close()
})

$statusTimer = New-Object System.Windows.Forms.Timer
$statusTimer.Interval = 5000

$statusTimer.Add_Tick({
    Refresh-LauncherStatus
})

$form.Add_Shown({
    Refresh-LauncherStatus
    $statusTimer.Start()
})

$form.Add_FormClosed({
    $statusTimer.Stop()
})

Write-HostEvent "LAUNCHER opened."

[void]$form.ShowDialog()