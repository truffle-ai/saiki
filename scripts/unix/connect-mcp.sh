#!/bin/bash

echo "Universal MCP Client Connector"
echo "============================"
echo

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed or not in the PATH."
    echo "Please install Node.js and npm before running this script."
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if the project is built
if [ ! -d "dist" ]; then
    echo "Building the project..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install dependencies."
        read -p "Press Enter to exit..."
        exit 1
    fi
    
    npm run build
    if [ $? -ne 0 ]; then
        echo "Error: Failed to build the project."
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo "Project built successfully."
    echo
fi

COMMAND="$1"
shift
ARGS="$@"

if [ -z "$COMMAND" ]; then
    echo "This script connects to any MCP server by providing the command to run it."
    echo
    echo "Usage:"
    echo "  ./connect-mcp.sh [command] [args...]"
    echo
    echo "Examples:"
    echo "  ./connect-mcp.sh npx -y @wonderwhy-er/desktop-commander"
    echo "  ./connect-mcp.sh node dist/host.js stdio"
    echo "  ./connect-mcp.sh npx -y @modelcontextprotocol/server-filesystem /path/to/dir"
    echo
    read -p "Enter server command: " COMMAND
    
    if [ -z "$COMMAND" ]; then
        echo "No command provided. Exiting."
        exit 1
    fi
    
    read -p "Enter arguments (space-separated): " ARGS
fi

echo
echo "Connecting to MCP server: $COMMAND $ARGS"
echo

node dist/client.js connect "$COMMAND" $ARGS 