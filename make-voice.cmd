@echo off
rem Double-click to make the narration clips. A window asks for your ElevenLabs key (typing is hidden).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make-voice.ps1"
echo.
pause
