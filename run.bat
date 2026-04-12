@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "VENV_DIR=%ROOT_DIR%visaible"
set "PYTHON_CMD="

where npm >nul 2>nul
if errorlevel 1 (
  echo npm not found. Install Node.js and npm first.
  exit /b 1
)

if exist "%VENV_DIR%\Scripts\python.exe" (
  set "PYTHON_CMD=%VENV_DIR%\Scripts\python.exe"
) else (
  py -3.12 -V >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_CMD=py -3.12"
  ) else (
    py -3 -V >nul 2>nul
    if not errorlevel 1 (
      set "PYTHON_CMD=py -3"
    ) else (
      where python >nul 2>nul
      if errorlevel 1 (
        echo Python not found. Install Python first.
        exit /b 1
      )
      set "PYTHON_CMD=python"
    )
  )
)

if not exist "%VENV_DIR%\Scripts\python.exe" (
  echo Creating virtual environment at %VENV_DIR%
  %PYTHON_CMD% -m venv "%VENV_DIR%"
)

echo Installing backend dependencies
"%VENV_DIR%\Scripts\python.exe" -m pip install --upgrade pip
"%VENV_DIR%\Scripts\python.exe" -m pip install -r "%ROOT_DIR%backend\requirements.txt"

echo Installing frontend dependencies
cd /d "%ROOT_DIR%frontend"
call npm install

echo Starting backend on http://127.0.0.1:8000
start "VisAIble Backend" cmd /k "cd /d %ROOT_DIR%backend && \"%VENV_DIR%\Scripts\python.exe\" -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

echo Starting frontend on http://127.0.0.1:3000
start "VisAIble Frontend" cmd /k "cd /d %ROOT_DIR%frontend && set NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 && npm run dev -- --hostname 127.0.0.1 --port 3000"

echo Open http://127.0.0.1:3000 after both windows finish starting.
