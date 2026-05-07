$ErrorActionPreference = "Stop"

$AppRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$BackendDir = Join-Path $AppRoot "backend"
$FrontendDir = Join-Path $AppRoot "frontend"
$RuntimeDir = Join-Path $AppRoot "runtime"
$LogDir = Join-Path $AppRoot "logs"
$BackendVenv = Join-Path $RuntimeDir "backend-venv"
$BackendEnv = Join-Path $BackendDir ".env.local"
$FrontendEnv = Join-Path $FrontendDir ".env.local"
$BackendUrl = "http://127.0.0.1:8000"
$FrontendUrl = "http://127.0.0.1:3000"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-Command {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-WingetInstall {
    param(
        [string]$PackageId,
        [string]$DisplayName
    )

    if (-not (Test-Command "winget")) {
        throw "$DisplayName is not installed and winget is unavailable. Install $DisplayName manually, then run VisAIble again."
    }

    Write-Step "Installing $DisplayName"
    winget install --id $PackageId --exact --accept-package-agreements --accept-source-agreements
}

function Get-PythonCommand {
    if (Test-Command "py") {
        try {
            & py -3.12 --version *> $null
            if ($LASTEXITCODE -eq 0) {
                return "py -3.12"
            }
        } catch {
        }
    }

    if (Test-Command "python") {
        try {
            $versionOutput = & python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
            if ($LASTEXITCODE -eq 0 -and [version]$versionOutput -ge [version]"3.12") {
                return "python"
            }
        } catch {
        }
    }

    return $null
}

function Ensure-Python {
    $pythonCommand = Get-PythonCommand
    if ($pythonCommand) {
        return $pythonCommand
    }

    Invoke-WingetInstall -PackageId "Python.Python.3.12" -DisplayName "Python 3.12"
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $pythonCommand = Get-PythonCommand
    if (-not $pythonCommand) {
        throw "Python 3.12 installation finished, but python was not found on PATH. Reopen VisAIble after Windows refreshes PATH."
    }
    return $pythonCommand
}

function Ensure-Node {
    if (Test-Command "node" -and Test-Command "npm") {
        return
    }

    Invoke-WingetInstall -PackageId "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (-not (Test-Command "node") -or -not (Test-Command "npm")) {
        throw "Node.js installation finished, but node/npm was not found on PATH. Reopen VisAIble after Windows refreshes PATH."
    }
}

function Ensure-Configuration {
    $needsBackendEnv = -not (Test-Path $BackendEnv)
    $needsFrontendEnv = -not (Test-Path $FrontendEnv)

    if (-not $needsBackendEnv -and -not $needsFrontendEnv) {
        return
    }

    Write-Step "First run configuration"
    $geminiKey = Read-Host "Gemini API Key"
    if ([string]::IsNullOrWhiteSpace($geminiKey)) {
        throw "Gemini API Key is required."
    }

    $competitionBackendUrl = Read-Host "Competition Backend URL"
    if ([string]::IsNullOrWhiteSpace($competitionBackendUrl)) {
        throw "Competition Backend URL is required."
    }
    $competitionBackendUrl = $competitionBackendUrl.TrimEnd("/")

    $backendEnvContent = @"
GOOGLE_API_KEY=$geminiKey
GEMINI_MODEL=gemini-3-flash-preview
"@
    $backendEnvContent | Set-Content -Path $BackendEnv -Encoding UTF8

    $frontendEnvContent = @"
NEXT_PUBLIC_API_BASE_URL=$BackendUrl
NEXT_PUBLIC_COMPETITION_API_BASE_URL=$competitionBackendUrl
"@
    $frontendEnvContent | Set-Content -Path $FrontendEnv -Encoding UTF8
}

function Invoke-CommandString {
    param([string]$Command)
    & powershell -NoProfile -ExecutionPolicy Bypass -Command $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $Command"
    }
}

function Ensure-BackendDependencies {
    New-Item -ItemType Directory -Force -Path $RuntimeDir, $LogDir | Out-Null
    $pythonCommand = Ensure-Python
    $venvPython = Join-Path $BackendVenv "Scripts\python.exe"

    if (-not (Test-Path $venvPython)) {
        Write-Step "Creating backend virtual environment"
        Invoke-CommandString "$pythonCommand -m venv `"$BackendVenv`""
    }

    Write-Step "Installing backend packages"
    $env:PIP_PREFER_BINARY = "1"
    & $venvPython -m pip install --upgrade pip
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to upgrade pip."
    }
    & $venvPython -m pip install --prefer-binary -r (Join-Path $BackendDir "requirements.txt")
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install backend packages."
    }
}

function Ensure-FrontendDependencies {
    Ensure-Node
    Write-Step "Installing frontend packages"
    $npmCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
    if (-not $npmCommand) {
        $npmCommand = Get-Command "npm" -ErrorAction Stop
    }
    Push-Location $FrontendDir
    try {
        if (Test-Path (Join-Path $FrontendDir "package-lock.json")) {
            & $npmCommand.Source ci
        } else {
            & $npmCommand.Source install
        }
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to install frontend packages."
        }
    } finally {
        Pop-Location
    }
}

function Stop-ProcessOnPort {
    param([int]$Port)
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        try {
            Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
        } catch {
        }
    }
}

function Start-VisAIble {
    $venvPython = Join-Path $BackendVenv "Scripts\python.exe"
    Stop-ProcessOnPort -Port 8000
    Stop-ProcessOnPort -Port 3000

    Write-Step "Starting backend on 8000"
    Start-Process -FilePath $venvPython `
        -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000" `
        -WorkingDirectory $BackendDir `
        -RedirectStandardOutput (Join-Path $LogDir "backend.log") `
        -RedirectStandardError (Join-Path $LogDir "backend-error.log") `
        -WindowStyle Minimized

    Write-Step "Starting frontend on 3000"
    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c npm run dev -- --hostname 127.0.0.1 --port 3000" `
        -WorkingDirectory $FrontendDir `
        -RedirectStandardOutput (Join-Path $LogDir "frontend.log") `
        -RedirectStandardError (Join-Path $LogDir "frontend-error.log") `
        -WindowStyle Minimized

    Start-Sleep -Seconds 3
    Start-Process $FrontendUrl
}

try {
    Write-Host "VisAIble launcher" -ForegroundColor Green
    Write-Host "Install path: $AppRoot"
    Ensure-Configuration
    Ensure-BackendDependencies
    Ensure-FrontendDependencies
    Start-VisAIble
    Write-Host ""
    Write-Host "VisAIble is running at $FrontendUrl" -ForegroundColor Green
    Write-Host "Logs are saved in $LogDir"
    Write-Host "You can close this window."
} catch {
    Write-Host ""
    Write-Host "VisAIble failed to start:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 1
}
