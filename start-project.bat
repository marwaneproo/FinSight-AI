@echo off
title FinSight AI - Start Production Environment
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)
echo Starting FinSight AI development server...
call npm run dev
pause
