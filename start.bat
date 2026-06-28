@echo off
setlocal
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "VENV=%BACKEND%\venv"

echo ============================================
echo    MedServicePrice.kz - Launch
echo ============================================
echo.

:: 1. Create venv if missing
if not exist "%VENV%\Scripts\activate.bat" (
    echo [1/4] Creating Python virtual environment...
    python -m venv "%VENV%"
    if errorlevel 1 (
        echo ERROR: Python not found. Download from https://python.org
        pause
        exit /b 1
    )
) else (
    echo [1/4] Virtual environment OK
)

:: 2. Install backend deps
echo [2/4] Installing backend dependencies...
call "%VENV%\Scripts\activate.bat"
pip install -r "%BACKEND%\requirements.txt" -q
if errorlevel 1 (
    echo ERROR: pip install failed!
    pause
    exit /b 1
)
echo     OK

:: 3. Install frontend deps
if not exist "%FRONTEND%\node_modules\" (
    echo [3/4] Installing npm dependencies (first time ~2 min)...
    cd /d "%FRONTEND%"
    npm install
    if errorlevel 1 (
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
) else (
    echo [3/4] node_modules OK
)

:: 4. Launch both in separate windows
echo [4/4] Launching backend and frontend...
echo.
echo   Backend API : http://localhost:8000
echo   Frontend    : http://localhost:3000
echo   Admin panel : http://localhost:3000/admin
echo.

start "Backend :8000" cmd /k "%ROOT%run_backend.bat"
timeout /t 4 /nobreak > nul
start "Frontend :3000" cmd /k "%ROOT%run_frontend.bat"

echo Both services launched in separate windows!
echo Close this window when done.
pause
