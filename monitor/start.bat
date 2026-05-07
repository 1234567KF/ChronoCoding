@echo off
cd /d "%~dp0"
echo Starting Monitor Dashboard with File Watcher...
start /B node src\server.js
echo Monitor PID: %ERRORLEVEL%
timeout /t 2 >nul
curl -s http://localhost:3456/api/health
echo.
echo Monitor started on http://localhost:3456
