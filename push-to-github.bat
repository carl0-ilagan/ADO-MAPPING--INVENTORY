@echo off
title Push to GitHub - ADO-MAPPING--INVENTORY
cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 (
    echo Git not found in PATH. Please:
    echo 1. Install Git: https://git-scm.com/download/win
    echo 2. Or run these commands in "Git Bash" from Start Menu
    pause
    exit /b 1
)

echo Initializing and pushing to https://github.com/carl0-ilagan/ADO-MAPPING--INVENTORY.git
echo.

if not exist ".git" (
    git init
    git branch -M main
    git remote add origin https://github.com/carl0-ilagan/ADO-MAPPING--INVENTORY.git
)

git add .
git status
echo.
set /p confirm="Commit and push? (y/n): "
if /i not "%confirm%"=="y" exit /b 0

git commit -m "first commit"
git push -u origin main

echo.
echo Done. Check: https://github.com/carl0-ilagan/ADO-MAPPING--INVENTORY
pause
