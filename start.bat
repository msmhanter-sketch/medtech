@echo off
echo Starting MedServicePrice.kz...

:: Setup backend venv if not exists
if not exist "backend\venv\" (
    echo [1/4] Creating Python virtual environment...
    cd backend
    python -m venv venv
    cd ..
)

:: Install backend deps if needed
echo [2/4] Installing backend dependencies...
cd backend
call venv\Scripts\activate.bat
pip install -r requirements.txt -q
cd ..

:: Install frontend deps if needed
if not exist "frontend\node_modules\" (
    echo [3/4] Installing frontend dependencies...
    cd frontend
    npm install --silent
    cd ..
)

:: Start both services
echo [4/4] Starting backend and frontend...
echo.
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000
echo   Admin:    http://localhost:3000/admin
echo.
echo Press Ctrl+C to stop.
echo.

start "MedServicePrice - Backend" cmd /k "cd backend && call venv\Scripts\activate.bat && uvicorn app.main:app --host 127.0.0.1 --port 8000"
timeout /t 3 /nobreak > nul
start "MedServicePrice - Frontend" cmd /k "cd frontend && npm run dev"
