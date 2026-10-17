<#
.SYNOPSIS
  Evita que Polkadot Desktop 0.1.3 llene el disco en Windows.

.DESCRIPTION
  Al pasar de 5 MB, el Desktop intenta rotar su log con un nombre que lleva la hora ISO
  ("...2026-09-30T11:45:00.135Z.log"). Windows no admite ':' en nombres de archivo, así que
  el rename falla siempre. El aviso del fallo se escribe en el mismo log y dispara otro
  intento: el log crece sin límite y el Desktop se traba.

  Este script saca el log de su carpeta antes de que llegue a 5 MB. El Desktop crea uno
  nuevo en la siguiente línea y el bucle se corta, incluso con la app abierta.

.PARAMETER Watch
  Sigue vigilando cada -IntervalSeconds hasta que pulses Ctrl+C.

.PARAMETER Keep
  En vez de borrar el log, lo mueve a un .bak junto a la carpeta logs (sigue ocupando disco).

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\desktop-log-guard.ps1

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\desktop-log-guard.ps1 -Watch
#>
param(
  [switch]$Watch,
  [switch]$Keep,
  [ValidateRange(5, 3600)][int]$IntervalSeconds = 60,
  [long]$LimitBytes = 4MB,
  [string]$LogPath = (Join-Path $env:APPDATA 'polkadot-desktop\logs\polkadot-desktop.log')
)

$ErrorActionPreference = 'Stop'

function Format-Size([long]$Bytes) {
  if ($Bytes -ge 1GB) { return '{0:N2} GB' -f ($Bytes / 1GB) }
  if ($Bytes -ge 1MB) { return '{0:N1} MB' -f ($Bytes / 1MB) }
  return '{0:N0} KB' -f ($Bytes / 1KB)
}

function Get-DesktopStatus {
  $procs = Get-Process -Name 'Polkadot Desktop Dev' -ErrorAction SilentlyContinue
  if (-not $procs) { return 'Desktop cerrado' }
  $mem = ($procs | Measure-Object PrivateMemorySize64 -Sum).Sum
  return "Desktop abierto, usa $(Format-Size $mem)"
}

function Invoke-Check {
  $stamp = Get-Date -Format 'HH:mm:ss'
  $free = Format-Size (Get-PSDrive -Name ($LogPath.Substring(0, 1))).Free

  if (-not (Test-Path -LiteralPath $LogPath)) {
    if (-not $Watch) { Write-Host "[$stamp] Sin log todavía. $(Get-DesktopStatus). Libre: $free." }
    return
  }

  $size = (Get-Item -LiteralPath $LogPath).Length
  if ($size -le $LimitBytes) {
    if (-not $Watch) { Write-Host "[$stamp] Log en $(Format-Size $size): bien. $(Get-DesktopStatus). Libre: $free." }
    return
  }

  try {
    if ($Keep) {
      $root = Split-Path (Split-Path $LogPath -Parent) -Parent
      $target = Join-Path $root ('polkadot-desktop.log.{0}.bak' -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
      Move-Item -LiteralPath $LogPath -Destination $target
      Write-Host "[$stamp] Log de $(Format-Size $size) movido a $target." -ForegroundColor Yellow
    } else {
      Remove-Item -LiteralPath $LogPath
      Write-Host "[$stamp] Log de $(Format-Size $size) borrado." -ForegroundColor Yellow
    }
  } catch {
    Write-Host "[$stamp] No se pudo quitar el log: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host '          Cierra Polkadot Desktop por completo y vuelve a correr este script.'
    return
  }

  $free = Format-Size (Get-PSDrive -Name ($LogPath.Substring(0, 1))).Free
  Write-Host "          $(Get-DesktopStatus). Libre: $free."
}

if (-not $Watch) {
  Invoke-Check
  return
}

Write-Host "Vigilando $LogPath cada $IntervalSeconds s (límite $(Format-Size $LimitBytes)). Ctrl+C para salir."
while ($true) {
  Invoke-Check
  Start-Sleep -Seconds $IntervalSeconds
}
