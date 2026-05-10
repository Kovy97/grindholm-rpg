@echo off
setlocal
cd /d "%~dp0"

echo [dev] starting backend with --reload (port 8000)...
start "GrindHolm Backend" cmd /k venv\Scripts\python.exe -m uvicorn server.main:app --reload --host 127.0.0.1 --port 8000

echo [dev] starting vite dev server (port 5173)...
start "GrindHolm Frontend" cmd /k npm run dev

echo.
echo  Backend:        http://127.0.0.1:8000
echo  Frontend (dev): http://127.0.0.1:5173  (proxies /api to backend)
echo.
echo  Open http://127.0.0.1:5173 in a browser, OR launch PyWebView pointing
echo  at the dev server:
echo    set GRINDHOLM_DEV_URL=http://127.0.0.1:5173
echo    venv\Scripts\python.exe src\grindholm\main.py
echo.
endlocal
