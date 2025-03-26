@echo off
echo Available MCP Server Configurations
echo ==================================
echo.

REM Check if config file exists
if not exist "configuration\mcp.json" (
    echo ERROR: configuration\mcp.json file not found.
    echo Please make sure the configuration directory and mcp.json file exist.
    pause
    exit /b 1
)

echo Server aliases found in configuration\mcp.json:
echo.

REM Simple way to display server aliases in Windows
for /f "tokens=1 delims=:" %%a in ('findstr /C:"\"" configuration\mcp.json') do (
    set line=%%a
    setlocal enabledelayedexpansion
    set line=!line:~0!
    set line=!line:"=!
    set line=!line: =!
    if not "!line!"=="" if not "!line:~0,1!"="{" if not "!line:~0,1!"="[" (
        echo !line!
    )
    endlocal
)

echo.
echo To use a specific server, run: scripts\windows\ai-cli.bat ^<server-alias^>
echo Example: scripts\windows\ai-cli.bat desktopCommander
echo.

pause 