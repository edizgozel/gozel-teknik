$ErrorActionPreference = "Continue"
$AppDir = $PSScriptRoot
$runtimeDir = Join-Path $AppDir "backend\runtime"

function Stop-AppComponent {
    param([string]$PidFile, [string]$Label)

    $path = Join-Path $runtimeDir $PidFile
    if (-not (Test-Path $path)) {
        Write-Host "$Label : kayitli surec yok (PID dosyasi bulunamadi)."
        return
    }

    $raw = (Get-Content $path -ErrorAction SilentlyContinue | Select-Object -First 1)
    $raw = "$raw".Trim()
    if ($raw -notmatch '^[0-9]+$') {
        Write-Host "$Label : PID dosyasi gecersiz ('$raw'), surec durdurulmadi."
        Remove-File $path
        return
    }
    $targetPid = [int]$raw

    $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
    if (-not $proc) {
        Write-Host "$Label : kayitli surec (PID $targetPid) artik calismiyor."
        Remove-File $path
        return
    }

    $isCmd = $proc.ProcessName -eq "cmd"
    $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $targetPid" -ErrorAction SilentlyContinue).CommandLine
    $marker = if ($PidFile -eq "uvicorn.pid") { "backend.cmd" } else { "frontend.cmd" }
    if (-not ($isCmd -and $cmdLine -and $cmdLine -like "*$marker*")) {
        Write-Host "$Label : PID $targetPid bu uygulamaya ait gorunmuyor (islem: $($proc.ProcessName), komut: '$cmdLine'). Dokunulmadi."
        return
    }

    & taskkill /PID $targetPid /T /F 2>&1 | Out-Null
    Start-Sleep -Milliseconds 500

    if (Get-Process -Id $targetPid -ErrorAction SilentlyContinue) {
        Write-Host "$Label : PID $targetPid durdurulamadi, elle kontrol edin."
        return
    }

    Write-Host "$Label durduruldu (PID $targetPid ve alt surecleri)."
    Remove-File $path
}

function Remove-File {
    param([string]$Path)
    if (Test-Path $Path) { Remove-Item $Path -Force -ErrorAction SilentlyContinue }
}

Stop-AppComponent -PidFile "uvicorn.pid" -Label "Backend (API)"
Stop-AppComponent -PidFile "vite.pid" -Label "Frontend (Vite)"
Write-Host "islem tamamlandi."
