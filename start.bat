@echo off
setlocal

:: Папка где лежит этот bat файл (корень проекта)
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "VENV=%BACKEND%\venv"

echo ============================================
echo    MedServicePrice.kz - Запуск проекта
echo ============================================
echo.

:: 1. Создать venv если нет
if not exist "%VENV%\Scripts\activate.bat" (
    echo [1/4] Создаю виртуальное окружение Python...
    python -m venv "%VENV%"
    if errorlevel 1 (
        echo ОШИБКА: Python не найден. Скачай с https://python.org
        pause
        exit /b 1
    )
) else (
    echo [1/4] Виртуальное окружение уже есть - ОК
)

:: 2. Установить зависимости бэкенда
echo [2/4] Устанавливаю зависимости бэкенда...
call "%VENV%\Scripts\activate.bat"
pip install -r "%BACKEND%\requirements.txt" -q
if errorlevel 1 (
    echo ОШИБКА при установке зависимостей!
    pause
    exit /b 1
)
echo     OK

:: 3. Установить зависимости фронтенда
if not exist "%FRONTEND%\node_modules\" (
    echo [3/4] Устанавливаю npm зависимости (первый раз дольше ~1-2 мин)...
    cd /d "%FRONTEND%"
    npm install
    if errorlevel 1 (
        echo ОШИБКА при npm install!
        pause
        exit /b 1
    )
) else (
    echo [3/4] node_modules уже есть - ОК
)

:: 4. Запускаем оба сервиса в отдельных окнах
echo [4/4] Запускаю бэкенд и фронтенд...
echo.
echo  Бэкенд:  http://localhost:8000
echo  Сайт:    http://localhost:3000
echo  Админка: http://localhost:3000/admin
echo.
echo Закрой это окно чтобы остановить всё.
echo.

start "Backend :8000" cmd /k "cd /d "%BACKEND%" && call "%VENV%\Scripts\activate.bat" && uvicorn app.main:app --host 127.0.0.1 --port 8000"

:: Ждём 4 сек чтобы бэкенд поднялся
timeout /t 4 /nobreak > nul

start "Frontend :3000" cmd /k "cd /d "%FRONTEND%" && npm run dev"

echo Оба сервиса запущены в отдельных окнах!
pause
