@echo off
title GOZEL TEKNIK Backend
cd /d "%~dp0backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8600
echo.
echo Backend sonlandi. Hata varsa yukaridaki mesajlari kontrol edin.
echo Pencereyi kapatabilir veya yeniden baslatmak icin start.bat kullanabilirsiniz.
pause
