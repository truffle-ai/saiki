#!/bin/bash

echo "AI-Powered MCP Client"
echo "===================="
echo

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found."
    echo "Please create a .env file with your OpenAI API key."
    echo "You can copy .env.example and fill in your API key."
    echo
    echo "Example .env content:"
    echo "OPENAI_API_KEY=your_openai_api_key_here"
    echo
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install dependencies."
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# Always build the project
echo "Building the project..."
npm run build
if [ $? -ne 0 ]; then
    echo "Error: Failed to build the project."
    read -p "Press Enter to exit..."
    exit 1
fi
echo "Project built successfully."
echo

# Parse command line options
CONFIG_FILE="configuration/mcp.json"  # Default config file
VERBOSE="-v"
CONNECTION_MODE="lenient"

# Process options
while [[ $# -gt 0 ]]; do
    case "$1" in
        -c|--config-file)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -s|--strict)
            CONNECTION_MODE="strict"
            shift
            ;;
        --no-verbose)
            VERBOSE=""
            shift
            ;;
        *)
            # Unknown option
            echo "Unknown option: $1"
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -c, --config-file PATH    Path to server config file (default: configuration/mcp.json)"
            echo "  -s, --strict              Require all server connections to succeed"
            echo "  --no-verbose              Disable verbose output"
            exit 1
            ;;
    esac
done

echo "Starting AI-powered MCP client with config file: ${CONFIG_FILE}"
node dist/ai.js connect --config-file "$CONFIG_FILE" --connection-mode "$CONNECTION_MODE" $VERBOSE

echo
echo "This client uses OpenAI to interpret your commands and call appropriate MCP tools."
echo "You can interact with tools using natural language."
echo
echo "Examples:"
echo "- \"List all files in the current directory\""
echo "- \"Show system information\""
echo "- \"Create a new file called test.txt with 'Hello World' as content\""
echo "- \"Run a simple python script that prints numbers from 1 to 10\""
echo 