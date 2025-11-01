@echo off
start cmd /k "cd backend && node server.js"
timeout /t 2 >nul
start cmd /k "cd backend && lt --port 3001"
timeout /t 2 >nul
start cmd /k "cd frontend && npm start"
