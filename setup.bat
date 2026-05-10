@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo [setup] Python is not on PATH. Install Python 3.12+ from python.org and tick "Add to PATH".
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [setup] Node.js is not on PATH. Install Node.js 20+ from nodejs.org.
    exit /b 1
)

if not exist venv (
    echo [setup] creating Python venv...
    python -m venv venv || exit /b 1
)

echo [setup] upgrading pip...
venv\Scripts\python.exe -m pip install --upgrade pip --quiet || exit /b 1

echo [setup] installing backend dependencies...
venv\Scripts\python.exe -m pip install -r requirements.txt --quiet || exit /b 1

echo [setup] installing frontend dependencies...
call npm install --silent
if errorlevel 1 (
    echo [setup] npm install failed.
    exit /b 1
)

echo.
echo [setup] done. Run "run.bat" to launch GrindHolm.
endlocal
