@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

if not exist "%ROOT%.env" (
  if exist "%ROOT%.env.example" (
    copy "%ROOT%.env.example" "%ROOT%.env" >nul
    powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content -LiteralPath '%ROOT%.env') -replace 'VITE_API_BASE_URL=http://127.0.0.1:8000','VITE_API_BASE_URL=http://127.0.0.1:8483' | Set-Content -LiteralPath '%ROOT%.env' -Encoding UTF8"
  ) else (
    echo Missing .env and .env.example
    pause
    exit /b 1
  )
)

if not exist "%ROOT%backend\main.py" (
  echo Missing backend\main.py
  pause
  exit /b 1
)

if not exist "%ROOT%BillNote_frontend\package.json" (
  echo Missing BillNote_frontend\package.json
  pause
  exit /b 1
)

start "BiliNote Backend" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%ROOT%backend'; python main.py"

echo Waiting for backend on http://127.0.0.1:8483/api/sys_check ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(60); while((Get-Date) -lt $deadline){ try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8483/api/sys_check' -TimeoutSec 2 | Out-Null; exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"
if errorlevel 1 (
  echo Backend did not become ready within 60 seconds. Please check the BiliNote Backend window.
  pause
  exit /b 1
)

start "BiliNote Frontend" powershell -NoExit -ExecutionPolicy Bypass -Command "Set-Location -LiteralPath '%ROOT%BillNote_frontend'; if (Get-Command pnpm.cmd -ErrorAction SilentlyContinue) { pnpm.cmd dev } elseif (Get-Command pnpm -ErrorAction SilentlyContinue) { pnpm dev } else { npm.cmd run dev }"

timeout /t 3 /nobreak >nul
start "" "http://localhost:3015/"

endlocal
