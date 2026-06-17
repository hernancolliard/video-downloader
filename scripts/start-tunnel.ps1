$ErrorActionPreference = "Stop"

Write-Host "Creando tunel publico hacia http://localhost:3000 ..."
npx localtunnel --port 3000
