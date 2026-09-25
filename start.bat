@echo off
chcp 65001 >nul
title VoiceCircle - Voice Room Community
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [ERROR] Node.js not found.
  echo  Please install Node.js 22 or newer: https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo.
echo   VoiceCircle is starting...
echo   Home   :  http://localhost:5173/
echo   Admin  :  http://localhost:5173/admin
echo   Account:  admin / admin123
echo.
echo   Keep this window open. Press Ctrl+C to stop.
echo.

node server/boot.js
pause
