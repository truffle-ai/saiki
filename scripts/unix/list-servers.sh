#!/bin/bash

echo "Available MCP Server Configurations"
echo "=================================="
echo

# Check if config file exists
if [ ! -f "configuration/mcp.json" ]; then
    echo "ERROR: configuration/mcp.json file not found."
    echo "Please make sure the configuration directory and mcp.json file exist."
    exit 1
fi

# List server aliases with command details
echo "Server aliases found in configuration/mcp.json:"
echo

# Parse JSON with jq if available, otherwise use a simpler grep method
if command -v jq >/dev/null 2>&1; then
    echo "$(jq -r 'keys[] as $k | "\($k) => \(.[$k].command) \(.[$k].args | join(" "))"' configuration/mcp.json)"
else
    # Fallback to grep/sed method
    grep -o '"[^"]*": {' configuration/mcp.json | sed 's/": {//' | sed 's/"//g' | while read -r alias; do
        cmd=$(grep -A 2 "\"$alias\": {" configuration/mcp.json | grep "command" | sed 's/.*: "\(.*\)",/\1/')
        echo "$alias => $cmd [see config for full details]"
    done
fi

echo
echo "To use a specific server, run: ./scripts/unix/ai-cli.sh <server-alias>"
echo "Example: ./scripts/unix/ai-cli.sh desktopCommander" 