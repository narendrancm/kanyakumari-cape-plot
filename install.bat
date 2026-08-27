@echo off
echo ===================================================
echo Installing Scrapling with AI support
echo ===================================================
python -m pip install "scrapling[ai]"
echo.
echo Installing browser engine dependencies for stealth mode...
python -m scrapling install
echo.
echo Installation complete!
pause
