# MyHealthyDistrict - one-click local setup and start for Windows.
# Installs Python, Node.js and PostgreSQL if they are missing (through winget), builds the website,
# fills the database with Forsyth County sample data, and opens http://localhost:8000.
# 'Continue' on purpose: Windows PowerShell 5.1 treats harmless messages from pip/npm as fatal errors under 'Stop'.
# Real failures are caught below with exit-code checks and 'throw'.
$ErrorActionPreference = 'Continue'
$Root = $PSScriptRoot
Set-Location $Root
try { Start-Transcript -Path "$Root\launcher.log" -Force | Out-Null } catch { }

$PgSuperPw = 'mhd_local_pw'                     # only used on this computer
$DbUrl = 'postgresql+psycopg2://mhd:mhd_dev_pw@localhost:5432/mhd'

function Say($m) { Write-Host ""; Write-Host "== $m" -ForegroundColor Cyan }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Has($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Winget-Install($id, $extra) {
  if (-not (Has winget)) { throw "winget was not found. Install 'App Installer' from the Microsoft Store, then run this file again." }
  $a = @('install', '-e', '--id', $id, '--accept-package-agreements', '--accept-source-agreements') + $extra
  & winget @a
  Refresh-Path
}
function Find-Psql {
  $c = Get-Command psql -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $f = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
  if ($f) { return $f.FullName }
  return $null
}

try {
  # ---------- Python
  Say 'Checking Python 3.11+'
  $pyOk = $false
  if (Has py) { & py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" 2>$null; $pyOk = ($LASTEXITCODE -eq 0) }
  if (-not $pyOk) { Say 'Installing Python 3.12'; Winget-Install 'Python.Python.3.12' @() }
  if (-not (Has py)) { throw 'Python was installed but is not on PATH yet. Close this window and run START-MyHealthyDistrict.bat again.' }

  # ---------- Node
  Say 'Checking Node.js 20+'
  $nodeOk = $false
  if (Has node) { $v = (node --version).TrimStart('v').Split('.')[0]; $nodeOk = ([int]$v -ge 20) }
  if (-not $nodeOk) { Say 'Installing Node.js LTS'; Winget-Install 'OpenJS.NodeJS.LTS' @() }
  if (-not (Has node)) { throw 'Node.js was installed but is not on PATH yet. Close this window and run START-MyHealthyDistrict.bat again.' }

  # ---------- PostgreSQL
  Say 'Checking PostgreSQL'
  $psql = Find-Psql
  if (-not $psql) {
    Say 'Installing PostgreSQL 16 (Windows may ask for permission)'
    Winget-Install 'PostgreSQL.PostgreSQL.16' @('--override', "--mode unattended --unattendedmodeui none --superpassword $PgSuperPw --serverport 5432")
    $psql = Find-Psql
  }
  if (-not $psql) { throw 'PostgreSQL did not install. Install PostgreSQL 16 from postgresql.org, then run this again.' }
  Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne 'Running' } | ForEach-Object { Start-Service $_.Name }
  for ($i = 0; $i -lt 30; $i++) { if ((Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded) { break }; Start-Sleep -Seconds 1 }

  Say 'Preparing the database'
  $env:PGPASSWORD = $PgSuperPw
  & $psql -h localhost -U postgres -tAc 'select 1' *> $null
  if ($LASTEXITCODE -ne 0) {
    $sec = Read-Host 'Enter the password of your existing PostgreSQL "postgres" user' -AsSecureString
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    & $psql -h localhost -U postgres -tAc 'select 1' *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Could not sign in to PostgreSQL with that password.' }
  }
  if ((& $psql -h localhost -U postgres -tAc "select 1 from pg_roles where rolname='mhd'") -ne '1') {
    & $psql -h localhost -U postgres -c "create role mhd login password 'mhd_dev_pw'" | Out-Null
  }
  if ((& $psql -h localhost -U postgres -tAc "select 1 from pg_database where datname='mhd'") -ne '1') {
    & $psql -h localhost -U postgres -c 'create database mhd owner mhd' | Out-Null
  }

  # ---------- Backend
  Say 'Installing backend packages (first run takes a minute)'
  if (-not (Test-Path "$Root\.venv\Scripts\python.exe")) { & py -3 -m venv "$Root\.venv" }
  $venvPy = "$Root\.venv\Scripts\python.exe"
  & $venvPy -m pip install -q --disable-pip-version-check -r "$Root\backend\requirements.txt"
  if ($LASTEXITCODE -ne 0) { throw 'pip could not install the backend packages.' }
  try { & $venvPy -m pip install -q --disable-pip-version-check tzdata } catch { }   # Windows has no timezone database of its own

  # ---------- Website
  $distIndex = "$Root\frontend\dist\index.html"
  $needBuild = -not (Test-Path $distIndex)
  if (-not $needBuild) {
    # rebuild when the website's source files are newer than the last build
    $newest = Get-ChildItem "$Root\frontend\src", "$Root\frontend\index.html" -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($newest -and $newest.LastWriteTime -gt (Get-Item $distIndex).LastWriteTime) { $needBuild = $true }
  }
  if ($needBuild) {
    Say 'Building the website (takes a minute; runs again only when the website files change)'
    Push-Location "$Root\frontend"
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'The website build failed.' }
    Pop-Location
  }

  # ---------- Start
  $secretFile = "$Root\.mhd-secret"
  if (-not (Test-Path $secretFile)) { [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') | Set-Content -NoNewline $secretFile }
  $env:MHD_SECRET_KEY = (Get-Content $secretFile -Raw).Trim()
  $env:MHD_DATABASE_URL = $DbUrl
  $env:MHD_STATIC_DIR = "$Root\frontend\dist"
  $env:MHD_ALLOWED_ORIGINS = 'http://localhost:8000,http://127.0.0.1:8000'

  # An older copy may still be running from a previous start. Stop it so the newest version is the one you see.
  $old = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
  if ($old) {
    Say 'Stopping the older copy of MyHealthyDistrict that was still running'
    $old | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
    if ((Test-NetConnection -ComputerName localhost -Port 8000 -WarningAction SilentlyContinue).TcpTestSucceeded) {
      throw 'Port 8000 is still busy. Close the other MyHealthyDistrict window (or restart the computer), then run this again.'
    }
  }

  Say 'Loading Forsyth County sample data (first run only)'
  Push-Location "$Root\backend"
  & $venvPy -m app.wait_and_seed
  if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the database.' }

  Say 'Starting MyHealthyDistrict at http://localhost:8000  (close this window to stop it)'
  Write-Host 'Sign in with maya@example.com / MayaDemo2026!   (county staff: county@example.com / CountyDemo2026!)'
  Start-Job -ScriptBlock { Start-Sleep -Seconds 4; Start-Process 'http://localhost:8000' } | Out-Null
  & $venvPy -m uvicorn app.main:app --host 127.0.0.1 --port 8000
  Pop-Location
}
catch {
  Write-Host ""
  Write-Host "Something went wrong: $($_.Exception.Message)" -ForegroundColor Red
}
