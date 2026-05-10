@echo off
setlocal
cd /d "%~dp0"

if not exist venv (
    echo [run] venv missing. Execute setup.bat first.
    exit /b 1
)
if not exist node_modules (
    echo [run] node_modules missing. Execute setup.bat first.
    exit /b 1
)

echo [run] building frontend...
call npm run build --silent
if errorlevel 1 (
    echo [run] frontend build failed.
    exit /b 1
)

echo [run] launching GrindHolm...
venv\Scripts\python.exe src\grindholm\main.py
endlocal
