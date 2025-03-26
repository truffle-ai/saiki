@echo off
echo AI-Powered MCP Client
echo =====================
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ERROR: .env file not found.
    echo Please create a .env file with your OpenAI API key.
    echo You can copy .env.example and fill in your API key.
    echo.
    echo Example .env content:
    echo OPENAI_API_KEY=your_openai_api_key_here
    echo.
    pause
    exit /b 1
)

REM Check if the project is built
if not exist "dist" (
    echo Building the project...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to install dependencies.
        pause
        exit /b 1
    )
    
    call npm run build
    if %ERRORLEVEL% neq 0 (
        echo Error: Failed to build the project.
        pause
        exit /b 1
    )
    echo Project built successfully.
    echo.
)

REM Set default parameter values
set CONFIG_FILE=configuration\mcp.json
set VERBOSE=-v
set CONNECTION_MODE=lenient

REM Parse command line arguments
:parse_args
if "%~1"=="" goto end_parse_args
if "%~1"=="-c" (
    set CONFIG_FILE=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="--config-file" (
    set CONFIG_FILE=%~2
    shift
    shift
    goto parse_args
)
if "%~1"=="-s" (
    set CONNECTION_MODE=strict
    shift
    goto parse_args
)
if "%~1"=="--strict" (
    set CONNECTION_MODE=strict
    shift
    goto parse_args
)
if "%~1"=="--no-verbose" (
    set VERBOSE=
    shift
    goto parse_args
)
if "%~1"=="-h" (
    goto show_help
)
if "%~1"=="--help" (
    goto show_help
)

echo Unknown option: %~1
goto show_help

:show_help
echo Usage: %0 [options]
echo Options:
echo   -c, --config-file PATH    Path to server config file (default: configuration\mcp.json)
echo   -s, --strict              Require all server connections to succeed
echo   --no-verbose              Disable verbose output
echo   -h, --help                Show this help message
exit /b 1

:end_parse_args

echo Starting AI-powered MCP client with config file: %CONFIG_FILE%
echo.
echo This client uses OpenAI to interpret your commands and call appropriate MCP tools.
echo You can interact with tools using natural language.
echo.
echo Examples:
echo - "List all files in the current directory"
echo - "Show system information"
echo - "Create a new file called test.txt with 'Hello World' as content"
echo - "Run a simple python script that prints numbers from 1 to 10"
echo.

node dist\ai.js connect --config-file "%CONFIG_FILE%" --connection-mode "%CONNECTION_MODE%" %VERBOSE%
