@echo off
title GOZEL TEKNIK Frontend
cd /d "%~dp0frontend"
if not exist node_modules call npm install
npm run dev
echo.
echo Vite sonlandi. Hata varsa yukaridaki mesajlari kontrol edin.
echo Pencereyi kapatabilir veya yeniden baslatmak icin start.bat kullanabilirsiniz.
pause
