@echo off
setlocal enabledelayedexpansion
title Server Dashboard Outline Iklan Medsos
echo ==========================================================
echo   Mengaktifkan Server Dashboard Outline Iklan Medsos...
echo ==========================================================
echo.

:: Pindah ke direktori tempat script berada
cd /d "%~dp0"

:: ─────────────────────────────────────────────────────────────
:: LANGKAH AUTO-UPLOAD: Upload data & memo ke GitHub di background
:: ─────────────────────────────────────────────────────────────
echo [PRE] Memeriksa & mengupload data/memo terbaru ke GitHub...
echo.

:: Regenerate data.js dulu
python generate_data.py >nul 2>&1

:: Cari git
set GIT_EXE=
where git >nul 2>&1
if %errorlevel%==0 (
  set GIT_EXE=git
  goto :do_upload
)
if exist "C:\Program Files\Git\cmd\git.exe" (
  set GIT_EXE="C:\Program Files\Git\cmd\git.exe"
  goto :do_upload
)
for /d %%D in ("%LOCALAPPDATA%\GitHubDesktop\app-*") do (
  if exist "%%D\resources\app\git\cmd\git.exe" (
    set GIT_EXE="%%D\resources\app\git\cmd\git.exe"
    goto :do_upload
  )
)
echo [PERINGATAN] Git tidak ditemukan, skip upload otomatis.
goto :start_server

:do_upload
:: Stage semua perubahan
%GIT_EXE% add data.js app.js index.html >nul 2>&1
%GIT_EXE% add -A memo >nul 2>&1

:: Set nama & email git
%GIT_EXE% config user.email "yustinus.sulistyono@kompas.com" >nul 2>&1
%GIT_EXE% config user.name "Yustinus Sulistyono" >nul 2>&1

:: Commit jika ada perubahan
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set DT=%%I
set TANGGAL=%DT:~6,2%-%DT:~4,2%-%DT:~0,4%
set JAM=%DT:~8,2%:%DT:~10,2%

%GIT_EXE% commit -m "Auto-upload saat buka dashboard - %TANGGAL% %JAM%" >nul 2>&1
set COMMIT_CODE=%errorlevel%

:: Push ke GitHub di background (tidak menunggu selesai)
if %COMMIT_CODE%==0 (
  echo [OK] Ada perubahan baru - sedang mengupload ke GitHub di background...
  start /b cmd /c "%GIT_EXE% push -u origin main >nul 2>&1"
) else (
  echo [OK] Tidak ada perubahan baru. Semua data & memo sudah terupload.
)

:: Tampilkan memo terbaru
echo.
echo      Memo terbaru di folder:
set COUNT=0
for /f "delims=" %%F in ('dir /b /o-d "memo\*.pdf" 2^>nul') do (
  if !COUNT! LSS 3 (
    echo      ^> %%F
    set /a COUNT+=1
  )
)
echo.

:start_server
:: Hapus file port lama jika ada
if exist ".server_port" del /f /q ".server_port"

echo [1/2] Memulai Server Python lokal...
echo ----------------------------------------------------------

:: Jalankan server Python di background
start /b python server.py

:: Tunggu server siap (muncul file .server_port) maksimal 15 detik
set /a WAIT=0
:WAIT_LOOP
timeout /t 1 /nobreak >nul
set /a WAIT+=1
if exist ".server_port" goto PORT_FOUND
if %WAIT% geq 15 goto FALLBACK
goto WAIT_LOOP

:PORT_FOUND
:: Baca port dari file
set /p ACTUAL_PORT=<".server_port"
echo Server berjalan aktif di: http://localhost:%ACTUAL_PORT%
echo JANGAN tutup jendela ini selama menggunakan dashboard web.
echo Tekan Ctrl + C di jendela ini untuk menghentikan server.
echo ----------------------------------------------------------
echo.

echo [2/2] Membuka browser di http://localhost:%ACTUAL_PORT%...
start http://localhost:%ACTUAL_PORT%
goto END

:FALLBACK
:: Jika file port tidak ditemukan, buka di port default 8000
echo [WARN] Tidak dapat mendeteksi port otomatis, mencoba port default 8000...
start http://localhost:8000

:END
echo.
echo Tekan Ctrl+C untuk menghentikan server.
echo.
pause >nul
