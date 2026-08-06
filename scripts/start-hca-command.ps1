Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $ScriptDirectory "hca-host.config.ps1"
$UpdateScriptPath = Join-Path $ScriptDirectory "update-hca-command.ps1"
$PeriodicBackupScriptPath = Join-Path $ScriptDirectory "periodic-backup.ps1"

if (-not (Test-Path $ConfigPath)) {
    Write-Host "Missing config file:" -ForegroundColor Red
    Write-Host "  $ConfigPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Copy scripts\hca-host.config.example.ps1 to scripts\hca-host.config.ps1 and update the paths." -ForegroundColor Yellow
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

    Write-Host $entry

    Ensure-Directory -Path $SharedLogsPath
    Add-Content -Path $HostEventsLogPath -Value $entry
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
    }
    catch {
        return $false
    }
}

function Get-GitCommit {
    try {
        Set-Location $AppPath
        $commit = (cmd.exe /c "git rev-parse --short HEAD").Trim()
        if ($commit) {
            return $commit
        }

        return "unknown"
    }
    catch {
        return "unknown"
    }
}

function Get-LocalUrl {
    $hostName = $env:COMPUTERNAME
    return "http://$hostName`:$Port"
}

function Get-LoginUrl {
    param( [string]$BaseUrl )
    return "$($BaseUrl.TrimEnd('/'))/login"
}

Write-HostEvent "START requested."

if (-not (Test-Path $AppPath)) {
    Write-HostEvent "START failed. App path not found at $AppPath"
    Write-Host "App path not found:" -ForegroundColor Red
    Write-Host "  $AppPath" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $SharedRoot)) {
    Write-HostEvent "START failed. Shared root not found at $SharedRoot"
    Write-Host "Shared root not found:" -ForegroundColor Red
    Write-Host "  $SharedRoot" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "HCA was not started because the shared coordination folder is unavailable." -ForegroundColor Yellow
    exit 1
}

Ensure-Directory -Path $SharedLatestDirectory
Ensure-Directory -Path $SharedBackupsPath
Ensure-Directory -Path $SharedLogsPath

$activeHostState = $null

if (Test-Path $ActiveHostPath) {
    try {
        $activeHostState = Get-Content -Path $ActiveHostPath -Raw | ConvertFrom-Json
    }
    catch {
        Write-HostEvent "START warning. Could not parse active-host.json. Error=$($_.Exception.Message)"
        Write-Host "Could not parse active-host.json." -ForegroundColor Red
        Write-Host "Refusing to start to avoid active-host confusion." -ForegroundColor Yellow
        exit 1
    }
}

if ($activeHostState -and $activeHostState.status -eq "RUNNING" -and $activeHostState.url) {
    $activeUrl = [string]$activeHostState.url
    $activeHost = [string]$activeHostState.activeHost

    Write-HostEvent "START detected active host. Host=$activeHost Url=$activeUrl"

    if (Test-HcaHealth -Url $activeUrl) {
        Write-Host ""
        Write-Host "HCA Central Command is already running." -ForegroundColor Green
        Write-Host "Active host: $activeHost" -ForegroundColor Cyan
        Write-Host "Opening: $activeUrl" -ForegroundColor Yellow

        Write-HostEvent "START opened existing active host. Host=$activeHost Url=$activeUrl"

        Start-Process (Get-LoginUrl -BaseUrl $activeUrl)
        exit 0
    }

    Write-Host ""
    Write-Host "Previous active host is listed but not reachable." -ForegroundColor Yellow
    Write-Host "Host: $activeHost" -ForegroundColor Yellow
    Write-Host "URL:  $activeUrl" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "HCA was NOT started automatically." -ForegroundColor Red
    Write-Host "Use Emergency Takeover only if you are sure the previous host is offline." -ForegroundColor Yellow

    Write-HostEvent "START refused. Listed active host unreachable. Host=$activeHost Url=$activeUrl"

    exit 2
}

# No healthy active host is running. This machine can become active host.
$localUrl = Get-LocalUrl

Write-Host ""
Write-Host "No active HCA host detected. Preparing this machine to host..." -ForegroundColor Cyan
Write-HostEvent "START preparing local host. Url=$localUrl"

# Pull latest database backup before update/db push so schema sync applies to the latest handoff DB.
if (Test-Path $SharedLatestDatabasePath) {
    $localDataDirectory = Split-Path -Parent $LocalDatabasePath
    Ensure-Directory -Path $localDataDirectory

    Copy-Item -Path $SharedLatestDatabasePath -Destination $LocalDatabasePath -Force

    Write-HostEvent "START copied latest shared DB to local DB. Source=$SharedLatestDatabasePath Destination=$LocalDatabasePath"
    Write-Host "Copied latest shared database backup into local data directory." -ForegroundColor Green
}
else {
    Write-HostEvent "START no latest shared DB found. Local DB will be created/synced if needed."
    Write-Host "No latest shared database backup found. Continuing with local database setup." -ForegroundColor Yellow
}

if (-not (Test-Path $UpdateScriptPath)) {
    Write-HostEvent "START failed. Update script not found at $UpdateScriptPath"
    Write-Host "Update script not found:" -ForegroundColor Red
    Write-Host "  $UpdateScriptPath" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Updating HCA before hosting..." -ForegroundColor Cyan

powershell.exe -ExecutionPolicy Bypass -File $UpdateScriptPath

if ($LASTEXITCODE -ne 0) {
    Write-HostEvent "START failed. Update script failed. ExitCode=$LASTEXITCODE"
    Write-Host "Update failed. HCA was not started." -ForegroundColor Red
    exit 1
}

Set-Location $AppPath

$existingConnection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

if ($existingConnection) {
    Write-HostEvent "START found local port already listening. Port=$Port"
    Write-Host "Something is already listening on port $Port." -ForegroundColor Yellow
    $localLoginUrl = Get-LoginUrl -BaseUrl $localUrl 
    Write-Host "Opening login URL: $localLoginUrl" -ForegroundColor Yellow 
    Start-Process $localLoginUrl exit 0
    exit 0
}

Write-Host ""
Write-Host "Starting HCA Central Command locally..." -ForegroundColor Cyan

Start-Process powershell.exe -ArgumentList "-ExecutionPolicy", "Bypass", "-Command", "cd '$AppPath'; npm run start"

$healthOk = $false

for ($i = 1; $i -le 30; $i++) {
    Start-Sleep -Seconds 2

    if (Test-HcaHealth -Url $localUrl) {
        $healthOk = $true
        break
    }

    Write-Host "Waiting for HCA to become healthy... ($i/30)" -ForegroundColor DarkGray
}

if (-not $healthOk) {
    Write-HostEvent "START failed. Local app did not become healthy. Url=$localUrl"
    Write-Host "HCA did not become healthy after starting." -ForegroundColor Red
    Write-Host "Check the server window and logs." -ForegroundColor Yellow
    exit 1
}

$gitCommit = Get-GitCommit
$now = (Get-Date).ToUniversalTime().ToString("o")

$activeHostJson = [ordered]@{
    status         = "RUNNING"
    activeHost     = $env:COMPUTERNAME
    url            = $localUrl
    startedAt      = $now
    databaseMode   = "LOCAL_ACTIVE_HOST"
    gitCommit      = $gitCommit
    lastBackupPath = $SharedLatestDatabasePath
} | ConvertTo-Json -Depth 5

$activeHostJson | Set-Content -Path $ActiveHostPath -Encoding UTF8

Write-HostEvent "START completed. ActiveHost=$env:COMPUTERNAME Url=$localUrl GitCommit=$gitCommit"

if (Test-Path $PeriodicBackupScriptPath) {
    Write-HostEvent "START launching periodic backup safety net."

    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList "-ExecutionPolicy", "Bypass", "-File", "`"$PeriodicBackupScriptPath`""
}
else {
    Write-HostEvent "START warning. Periodic backup script not found at $PeriodicBackupScriptPath"
}

Write-Host ""
Write-Host "HCA Central Command is running on this machine." -ForegroundColor Green
$localLoginUrl = Get-LoginUrl -BaseUrl $localUrl
Write-Host "Opening: $localLoginUrl" -ForegroundColor Yellow
Start-Process $localLoginUrl

