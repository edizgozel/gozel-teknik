@echo off
setlocal
chcp 65001 >nul
title GOZEL TEKNIK Durdurucu

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
echo.
pause
