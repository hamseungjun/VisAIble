@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "RENDER_URL=%NEXT_PUBLIC_COMPETITION_API_BASE_URL%"
if "%RENDER_URL%"=="" set "RENDER_URL=http://210.115.229.161:8001"

set "PYTHON_BIN="
if exist "%ROOT_DIR%visaible\Scripts\python.exe" set "PYTHON_BIN=%ROOT_DIR%visaible\Scripts\python.exe"
if "%PYTHON_BIN%"=="" if exist "%ROOT_DIR%.venv\Scripts\python.exe" set "PYTHON_BIN=%ROOT_DIR%.venv\Scripts\python.exe"
if "%PYTHON_BIN%"=="" set "PYTHON_BIN=py -3"

where npm >nul 2>nul
if errorlevel 1 (
  echo npm not found. Install Node.js and npm first.
  exit /b 1
)

echo Starting local backend on http://127.0.0.1:8000
echo Using Render competition backend: %RENDER_URL%

start "VisAIble Local Backend" cmd /k "cd /d %ROOT_DIR%backend && %PYTHON_BIN% -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "VisAIble Frontend" cmd /k "cd /d %ROOT_DIR%frontend && set NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 && set NEXT_PUBLIC_COMPETITION_API_BASE_URL=%RENDER_URL% && npm run dev -- --hostname 127.0.0.1 --port 3000"

echo Open http://127.0.0.1:3000 after both windows finish starting.
