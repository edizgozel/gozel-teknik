@echo off
setlocal
chcp 65001 >nul
title GOZEL TEKNIK Baslatici

cd /d "%~dp0"
set APPDIR=%~dp0
set RTDIR=%APPDIR%backend\runtime
if not exist "%RTDIR%" mkdir "%RTDIR%"
set BEPIDFILE=%RTDIR%\uvicorn.pid
set FEPIDFILE=%RTDIR%\vite.pid

if not defined PYTHON set "PYTHON=python"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$be=$fe=$null; if (Test-Path '%BEPIDFILE%') { $p=Get-Process -Id (Get-Content '%BEPIDFILE%') -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -eq 'cmd') { $be=1 } }; if (Test-Path '%FEPIDFILE%') { $p=Get-Process -Id (Get-Content '%FEPIDFILE%') -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -eq 'cmd') { $fe=1 } }; if ($be -and $fe) { 'BOTH' } elseif ($be) { 'BE' } elseif ($fe) { 'FE' } else { 'NONE' }" > "%RTDIR%\state.tmp"
set /p STATE=<"%RTDIR%\state.tmp"
del "%RTDIR%\state.tmp" >nul 2>&1

if "%STATE%"=="BOTH" (
    echo GOZEL TEKNIK zaten calisiyor. Ikinci kopya baslatilmadi. Kapatmak icin stop.bat.
    pause
    exit /b 0
)

if not exist "%APPDIR%frontend\node_modules" (
    echo Ilk calistirma: frontend bagimliliklari kuruluyor...
    pushd "%APPDIR%frontend"
    call npm install
    if errorlevel 1 (
        popd
        goto :error
    )
    popd
)

if not "%STATE%"=="BE" if not "%STATE%"=="BOTH" (
    echo Backend baslatiliyor...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process cmd.exe -ArgumentList '/k','%APPDIR%backend.cmd' -PassThru; Set-Content -Path '%BEPIDFILE%' -Value $p.Id"
    if errorlevel 1 goto :error
)

if not "%STATE%"=="FE" if not "%STATE%"=="BOTH" (
    echo Frontend ^(Vite^) baslatiliyor...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process cmd.exe -ArgumentList '/k','%APPDIR%frontend.cmd' -PassThru; Set-Content -Path '%FEPIDFILE%' -Value $p.Id"
    if errorlevel 1 goto :error
)

echo Servislerin hazirlanmasi bekleniyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=0; for ($i=0; $i -lt 60; $i++) { Start-Sleep -Milliseconds 500; try { $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',5173); $c.Close(); $ok=1; break } catch {} }; if ($ok) { Start-Process 'http://127.0.0.1:5173' } else { Write-Host 'UYARI: Vite 30 saniyede hazir olmadi, Frontend penceresini kontrol edin.' }"

echo.
echo  GOZEL TEKNIK calisiyor:
echo    Arayuz (Vite) : http://localhost:5173  - loglar Frontend penceresinde
echo    Backend (API) : http://127.0.0.1:8600  - loglar Backend penceresinde
echo  Kapatmak icin: stop.bat
echo.
exit /b 0

:error
echo.
echo BASLATMA HATASI olustu. Pencereler acik kaliyor; hatalari orada gorebilirsiniz.
pause
exit /b 1
