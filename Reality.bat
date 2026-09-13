@echo off
rem Reality — «Это вода»: локальный сервер на :1836 + браузер
cd /d "%~dp0"
start "" http://localhost:1836/
where python >nul 2>nul && (python -m http.server 1836) || (py -3 -m http.server 1836)
