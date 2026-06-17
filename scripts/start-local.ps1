$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$CookieFile = Join-Path $Root "cookies.txt"
$YtDlpBinary = Join-Path $Root "binaries\yt-dlp.exe"

if (-not (Test-Path $CookieFile)) {
  Write-Host "Falta cookies.txt en $Root"
  Write-Host "Crea ese archivo, pega tus cookies Netscape, guarda y vuelve a ejecutar este script."
  exit 1
}

if (-not (Test-Path $YtDlpBinary)) {
  Write-Host "Falta yt-dlp.exe en binaries\yt-dlp.exe"
  exit 1
}

$env:DOWNLOAD_ENGINE = "yt-dlp"
$env:YT_DLP_BINARY = $YtDlpBinary
$env:YOUTUBE_COOKIES_BASE64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content $CookieFile -Raw)))
$env:PORT = "3000"

Set-Location $Root
node server.js
