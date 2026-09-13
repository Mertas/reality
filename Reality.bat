@echo off
rem Reality launcher: vite dev server (:1836) + браузер
cd /d E:\My\Reality

if not defined PORT set PORT=1836

rem Уже запущено?
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 goto open

echo Starting Reality (vite dev, :%PORT%)...
where npm >nul 2>nul
if %errorlevel%==0 (
  start "Reality" cmd /k "cd /d E:\My\Reality && npm run dev"
) else (
  start "Reality" cmd /k "cd /d E:\My\Reality && C:\nvm4w\nodejs\npm.cmd run dev"
)

rem Ждём, пока сервер ответит (максимум ~60 с)
set /a tries=0
:loop
set /a tries+=1
if %tries% gtr 60 goto open
curl -s -o nul --max-time 2 http://localhost:%PORT%/ >nul 2>&1
if %errorlevel%==0 goto open
ping -n 2 127.0.0.1 >nul
goto loop

:open
start "" http://localhost:%PORT%
exit /b
