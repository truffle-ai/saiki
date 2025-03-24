# Advanced MCP Scripts

This directory contains additional scripts for advanced usage of the MCP Connector. While the main AI interface (accessible via `mcp.bat` or `mcp.sh`) is recommended for most users, these scripts provide more direct control over MCP functionality.

## Available Scripts

### Windows Scripts (`windows/`)

| Script | Purpose | Usage |
|--------|---------|-------|
| `mcp-connector.bat` | Main menu interface | Provides access to all MCP functionality |
| `ai-cli.bat` | AI interface | Natural language interaction (same as main entry point) |
| `connect-mcp.bat` | Universal connector | Connect to any MCP server |
| `connect-to-commander.bat` | Desktop commander | Direct connection to file/terminal operations |
| `mcp-cli.bat` | Local development | Connect to a local MCP host |
| `test-commander.bat` | Testing utility | Verify commander connection |
| `run-mcp.ps1` | PowerShell menu | PowerShell version of the interface |

### Unix Scripts (`unix/`)

| Script | Purpose | Usage |
|--------|---------|-------|
| `mcp-connector.sh` | Main menu interface | Provides access to all MCP functionality |
| `ai-cli.sh` | AI interface | Natural language interaction (same as main entry point) |
| `connect-mcp.sh` | Universal connector | Connect to any MCP server |

## Direct MCP Usage

For users who want to bypass the AI interface and work directly with MCP:

1. **Connect to Desktop Commander**:
```bash
# Windows
scripts\windows\connect-to-commander.bat

# Unix
./scripts/unix/connect-mcp.sh npx -y @wonderwhy-er/desktop-commander
```

2. **Use Raw Commands**:
```
> list-tools
> call execute_command {"command":"dir"}
> call read_file {"path":"example.txt"}
```

3. **Start Local Server**:
```bash
# Windows
scripts\windows\mcp-cli.bat

# Unix
./scripts/unix/connect-mcp.sh node dist/host.js stdio
```

## Development and Testing

For developers working on extending MCP:

1. **Test Environment**:
```bash
# Windows
scripts\windows\test-commander.bat

# Unix
./scripts/unix/connect-mcp.sh node dist/host.js stdio
```

2. **Custom Server Connection**:
```bash
# Windows
scripts\windows\connect-mcp.bat your-server-command args

# Unix
./scripts/unix/connect-mcp.sh your-server-command args
```

## Notes

- All scripts check for npm and project build status
- Windows scripts use both .bat and .ps1 formats
- Unix scripts require execute permissions (`chmod +x scripts/unix/*.sh`)
- Some advanced features are Windows-only due to ClaudeDesktopCommander dependencies