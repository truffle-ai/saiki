# JSON to YAML Configuration Conversion

This document outlines the tasks required to convert our configuration system from JSON to YAML format.

## Task Checklist

### Configuration Files
- [x] Create new `configuration/saiki.yml` file 
- [x] Delete `configuration/mcp.json` after successful conversion

### Dependencies
- [x] Add YAML parsing library (`yaml` package) to package.json
- [x] Install new dependencies

### Code Changes
- [x] Update `src/config/loader.ts` to use YAML parser instead of JSON
  - Use `yaml.parse()` instead of `JSON.parse()`
  - Add improved error handling to leverage YAML's better error messages
- [x] Modify `app/index.ts` to use `configuration/saiki.yml` as default config path
- [x] Update any logging or error messages referring to config file

### Documentation
- [x] Update `configuration/README.md` to explain YAML format
- [x] Replace JSON examples with YAML examples
- [x] Update command-line option documentation
- [x] Update main README.md to reference YAML configuration

### Testing
- [x] Verify application loads with new YAML config
- [x] Test all configured services work with YAML config
- [x] Ensure command-line override for config path still works

## Implementation Notes

### Library Choice
We've selected the `yaml` library (not js-yaml) for better TypeScript support, improved error messages, and more robust handling of edge cases common in configuration files.

### YAML Structure
```yaml
mcpServers:
  filesystem:
    type: stdio
    command: npx
    args:
      - -y
      - "@modelcontextprotocol/server-filesystem"
      - .
  puppeteer:
    type: stdio
    command: node
    args:
      - --loader
      - ts-node/esm
      - src/servers/puppeteerServer.ts
llm:
  provider: openai
  model: gpt-4o-mini
  apiKey: env:OPENAI_API_KEY
``` 