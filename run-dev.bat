@echo off
setlocal EnableExtensions

rem Run a single service when this file is called by one of the child windows.
if /I "%~1"=="backend" goto run_backend
if /I "%~1"=="frontend" goto run_frontend

cd /d "%~dp0"
title Tanzim Development Launcher

call :find_python
if not defined PYTHON_EXE (
    echo [ERROR] No project virtual environment was found.
    echo Create one in .venv or backend\.venv and install backend\requirements.txt.
    pause
    exit /b 1
)

"%PYTHON_EXE%" -c "import uvicorn" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Uvicorn is not installed in: "%PYTHON_EXE%"
    echo Install it with: "%PYTHON_EXE%" -m pip install -r backend\requirements.txt
    pause
    exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found. Install Node.js and try again.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [ERROR] Frontend dependencies are missing.
    echo Run npm install from: %CD%
    pause
    exit /b 1
)

if /I "%~1"=="--check" (
    echo [OK] Frontend and backend prerequisites are available.
    exit /b 0
)

echo Starting Tanzim development services...
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Each service opens in its own window. Press Ctrl+C in those windows to stop it.

start "Tanzim Backend" cmd.exe /k call "%~f0" backend
start "Tanzim Frontend" cmd.exe /k call "%~f0" frontend
exit /b 0

:run_backend
cd /d "%~dp0"
call :find_python
if not defined PYTHON_EXE (
    echo [ERROR] Project Python virtual environment not found.
    exit /b 1
)
cd /d "%~dp0backend"
title Tanzim Backend - http://localhost:8000
"%PYTHON_EXE%" -m uvicorn app.main:app --reload --port 8000
exit /b %errorlevel%

:run_frontend
cd /d "%~dp0"
title Tanzim Frontend - http://localhost:5173
npm.cmd run dev
exit /b %errorlevel%

:find_python
set "PYTHON_EXE="
if exist "%~dp0backend\.venv\Scripts\python.exe" set "PYTHON_EXE=%~dp0backend\.venv\Scripts\python.exe"
if not defined PYTHON_EXE if exist "%~dp0.venv\Scripts\python.exe" set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
exit /b 0
