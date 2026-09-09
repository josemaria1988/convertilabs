param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$companionRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$companionState = Join-Path $companionRoot '.local-companion'
$companionCli = Join-Path $companionRoot 'scripts\local-companion\cli.cjs'
$companionNode = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $companionState -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $companionState 'config.json'))) {
  Write-Host 'Primero ejecutá: npm run local -- configure --slug <organizacion> --actor <UUID-del-usuario>'
  exit 1
}
# Reabrir la interfaz conserva el trabajador existente y sus logs.
$companionSupervisorPath = Join-Path $companionState 'supervisor.json'
if (Test-Path -LiteralPath $companionSupervisorPath) {
  $companionExisting = Get-Content -LiteralPath $companionSupervisorPath -Raw | ConvertFrom-Json
  $companionExistingPid = 0
  if ([int]::TryParse([string]$companionExisting.pid, [ref]$companionExistingPid) -and $companionExistingPid -gt 0) {
    $companionExistingProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $companionExistingPid"
    if ($companionExistingProcess -and $companionExistingProcess.CommandLine -like "*$companionCli*" -and $companionExistingProcess.CommandLine -match '--with-worker(?:\s|$)') {
      $companionExistingPort = [int]$companionExisting.port
      if ($companionExistingPort -lt 1024 -or $companionExistingPort -gt 65535) { throw 'Puerto local guardado invalido.' }
      $companionExistingUrl = "http://127.0.0.1:$companionExistingPort"
      $companionExistingResponse = Invoke-WebRequest -UseBasicParsing -Uri "$companionExistingUrl/login" -TimeoutSec 10
      if ($companionExistingResponse.StatusCode -eq 200) {
        if (-not $NoBrowser) { Start-Process "$companionExistingUrl/app" }
        Write-Host 'Convertilabs Local ya esta iniciado. Se conserva el trabajador en segundo plano.'
        exit 0
      }
    }
  }
}
Write-Host 'Iniciando Convertilabs Local...'
$companionProcess = Start-Process -FilePath $companionNode -ArgumentList @(('"' + $companionCli + '"'), 'serve', '--with-worker') -WorkingDirectory $companionRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $companionState 'app.log') -RedirectStandardError (Join-Path $companionState 'app.error.log')
$companionDeadline = (Get-Date).AddSeconds(90)
$companionReady = $false
while ((Get-Date) -lt $companionDeadline -and -not $companionProcess.HasExited) {
  try {
    $companionResponse = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4318/login' -TimeoutSec 3
    if ($companionResponse.StatusCode -eq 200) { $companionReady = $true; break }
  } catch { Start-Sleep -Milliseconds 500 }
}
if (-not $companionReady) {
  Get-Content -LiteralPath (Join-Path $companionState 'app.error.log') -Tail 8
  Write-Host 'La interfaz aun no esta lista. Revisa .local-companion/app.log y ejecuta npm run local -- doctor --cloud.'
  exit 1
}
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:4318/app' }
Write-Host 'Convertilabs Local iniciado. Para detener: npm run local -- stop'
