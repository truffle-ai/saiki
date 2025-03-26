# Advanced MCP Scripts

This directory contains additional scripts for advanced usage of the MCP Connector. While the main AI interface (accessible via `npm run dev`) is recommended for most users, these scripts provide more direct control over MCP functionality.

## New Cross-Platform Approach

The MCP Connector now uses a standardized cross-platform approach with npm scripts:

```bash
# Run the AI-powered MCP CLI (recommended)
npm run dev

# With custom options
npm run dev -- --config-file path/to/your/config.json --strict
```



## Direct MCP Usage

For users who want to bypass the AI interface and work directly with MCP:

1. **Connect to Desktop Commander**:
```bash
npx -y @wonderwhy-er/desktop-commander
```

2. **Use Raw Commands**:
```
> list-tools
> call execute_command {"command":"dir"}
> call read_file {"path":"example.txt"}
```

3. **Start Local Server**:
```bash
node dist/host.js stdio
```

## Development and Testing

For developers working on extending MCP:

1. **Test Environment**:
```bash
node dist/host.js stdio
```

2. **Custom Server Connection**:
```bash
your-server-command args
```

## Notes

- The npm scripts handle checking for dependencies and building the project
- Platform-specific scripts are being phased out in favor of cross-platform npm scripts
- Some advanced features may still require platform-specific code internally