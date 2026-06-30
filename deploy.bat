@echo off
REM ============================================================
REM Auralis AI v2 - One-shot deploy script
REM ============================================================
REM Jalankan file ini dari folder BMS-AI-v2:
REM   cd "C:\Users\Administrator\Downloads\claude_like_ai_studio\bms-ai-v2"
REM   deploy.bat
REM ============================================================

setlocal

cd /d "%~dp0"

echo [1/7] Init git...
git init
if errorlevel 1 goto :fail

echo [2/7] Set local user (override kalau perlu)...
git config user.name "BMS Studio"
git config user.email "bms-studio@users.noreply.github.com"

echo [3/7] Add files...
git add .

echo [4/7] Commit...
git commit -m "Initial commit - Auralis AI v2 (React + Vite + Tailwind)"

echo [5/7] Rename branch to main...
git branch -M main

echo [6/7] Set remote...
git remote remove origin 2>nul
git remote add origin https://github.com/bms-studio/bms-ai-v2.git

echo [7/7] Push...
echo NOTE: Browser akan terbuka untuk login GitHub kalau belum authenticated.
git push -u origin main --force

if errorlevel 1 (
  echo.
  echo PUSH GAGAL. Kemungkinan penyebab:
  echo   - Belum login ke GitHub di browser ini
  echo   - Repo belum punya akses tulis
  echo   - Username/password salah
  echo.
  echo Coba jalankan manual:
  echo   git push -u origin main --force
  pause
  exit /b 1
)

echo.
echo ============================================================
echo  DEPLOY SUKSES!
echo.
echo  Langkah terakhir - aktifkan GitHub Pages:
echo    1. Buka https://github.com/bms-studio/bms-ai-v2/settings/pages
echo    2. Source: GitHub Actions
echo    3. Tunggu ~1-2 menit sampai workflow selesai
echo    4. Web live di: https://bms-studio.github.io/bms-ai-v2/
echo ============================================================
pause
exit /b 0

:fail
echo.
echo GAGAL di step inisialisasi git. Pastikan folder ini benar.
pause
exit /b 1