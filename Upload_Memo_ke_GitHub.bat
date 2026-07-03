@echo off
setlocal enabledelayedexpansion
title Upload Data & Memo ke GitHub Pages
echo ============================================================
echo   UPLOAD DATA TERBARU KE GITHUB PAGES
echo   (iklan + memo agar visitor dapat melihat jadwal terbaru)
echo ============================================================
echo.

:: Pindah ke direktori project
cd /d "%~dp0"

:: ─────────────────────────────────────────────────────────────
:: LANGKAH 0: Regenerate data.js dari file Excel terbaru
:: ─────────────────────────────────────────────────────────────
echo [0/5] Membaca ulang data Excel dan memperbarui data.js...
python generate_data.py
if %errorlevel% neq 0 (
  echo [PERINGATAN] generate_data.py gagal dijalankan.
  echo              Lanjut menggunakan data.js yang sudah ada...
)
echo.

:: ─────────────────────────────────────────────────────────────
:: Cari git - cek PATH dulu
:: ─────────────────────────────────────────────────────────────
set GIT_EXE=

where git >nul 2>&1
if %errorlevel%==0 (
  set GIT_EXE=git
  goto :found_git
)

if exist "C:\Program Files\Git\cmd\git.exe" (
  set GIT_EXE="C:\Program Files\Git\cmd\git.exe"
  goto :found_git
)

if exist "C:\Program Files\Git\bin\git.exe" (
  set GIT_EXE="C:\Program Files\Git\bin\git.exe"
  goto :found_git
)

for /d %%D in ("%LOCALAPPDATA%\GitHubDesktop\app-*") do (
  if exist "%%D\resources\app\git\cmd\git.exe" (
    set GIT_EXE="%%D\resources\app\git\cmd\git.exe"
    goto :found_git
  )
)

echo [ERROR] Git tidak ditemukan!
echo Download di: https://git-scm.com/download/win
pause
exit /b 1

:found_git
echo [OK] Git ditemukan: %GIT_EXE%
echo.

:: Cek apakah sudah ada repo git
if not exist ".git" (
  echo [1/5] Menginisialisasi Git repository...
  %GIT_EXE% init
  %GIT_EXE% remote add origin https://github.com/tejun219/iklanmedsos.kompas.git
) else (
  echo [1/5] Repository Git sudah ada.
  %GIT_EXE% remote set-url origin https://github.com/tejun219/iklanmedsos.kompas.git 2>nul
)

echo.
echo [2/5] Mengatur branch ke 'main'...
%GIT_EXE% checkout -b main 2>nul
%GIT_EXE% checkout main 2>nul

echo.
echo [3/5] Menambahkan file yang diperbarui...
%GIT_EXE% add data.js
%GIT_EXE% add app.js
%GIT_EXE% add index.html
%GIT_EXE% add version.json
%GIT_EXE% add -A memo

echo.
echo [4/5] Membuat commit...
%GIT_EXE% config user.email "yustinus.sulistyono@kompas.com" 2>nul
%GIT_EXE% config user.name "Yustinus Sulistyono" 2>nul

:: Tanggal dengan WMIC
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set DT=%%I
set TANGGAL=%DT:~6,2%-%DT:~4,2%-%DT:~0,4%
set JAM=%DT:~8,2%:%DT:~10,2%

%GIT_EXE% commit -m "Update data iklan & memo - %TANGGAL% %JAM%"
if %errorlevel%==1 (
  echo [INFO] Tidak ada perubahan baru untuk di-commit.
)

echo.
echo [5/5] Mengupload ke GitHub Pages...
echo Username GitHub: tejun219
echo.
%GIT_EXE% push -u origin main
set PUSH_ERR=%errorlevel%

echo.
if %PUSH_ERR%==0 (
  echo ============================================================
  echo  BERHASIL! Data iklan ^& memo sudah diupload ke GitHub Pages.
  echo.
  echo  5 Memo terakhir di folder (terbaru di atas):
  echo  -----------------------------------------------
  set COUNT=0
  for /f "delims=" %%F in ('dir /b /o-d "memo\*.pdf" 2^>nul') do (
    if !COUNT! LSS 5 (
      echo    [%%F]
      set /a COUNT+=1
    )
  )
  echo  -----------------------------------------------
  echo.
  echo  Visitor dapat melihat jadwal terbaru di:
  echo  https://tejun219.github.io/iklanmedsos.kompas/
  echo ============================================================
) else (
  echo ============================================================
  echo  Ada masalah saat upload. Coba langkah berikut:
  echo  1. Buka GitHub Desktop
  echo  2. Tambahkan repository ini: %~dp0
  echo  3. Commit dan Push semua perubahan
  echo ============================================================
)
echo.
pause
