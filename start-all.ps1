$projectRoot = $PSScriptRoot
$backendPath = Join-Path $projectRoot "backend"

Write-Host "Starting Treble backend..."
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$backendPath'; npm run dev"
)

Start-Sleep -Seconds 3

Write-Host "Starting ngrok..."
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$projectRoot'; npx ngrok http --url=fond-whippet-fairly.ngrok-free.app 5000"
)

Start-Sleep -Seconds 3

Write-Host "Starting Expo..."
Set-Location $projectRoot
npx expo start --tunnel --clear