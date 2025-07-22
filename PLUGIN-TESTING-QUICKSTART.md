# Plugin System Testing - Quick Start

This guide helps you quickly test that the Saiki plugin system is working correctly.

## Quick Test (30 seconds)

### 1. Run the Plugin Test Script

```bash
# Test the plugin system components
node test-plugin-system.js
```

**Expected output:**
```
🔍 Checking plugin files...
✅ Found: ./plugins/audit-logger.ts
✅ Found: ./plugins/tool-filter.ts

🧪 Testing Saiki Plugin System...

1️⃣  Creating PluginManager...
✅ PluginManager created successfully

2️⃣  Testing plugin loading...
[INFO] PluginManager initialized
[INFO] Loading 2 plugins
✅ Plugins loaded successfully

3️⃣  Testing plugin initialization...
✅ Initialized 2 plugins

4️⃣  Testing beforeToolCall hook...
✅ beforeToolCall hook executed successfully

5️⃣  Testing afterToolCall hook...
✅ afterToolCall hook executed successfully

6️⃣  Testing tool blocking (should fail)...
✅ Tool correctly blocked by filter plugin

🎉 All plugin system tests passed!
```

### 2. Test with Real Saiki Instance

```bash
# Start Saiki with plugin configuration
npx saiki --config test-plugins.yml

# Or in web mode
npx saiki web --config test-plugins.yml
```

**Watch for these startup messages:**
```
[INFO] Loading 2 plugin(s)
[INFO] Plugin 'audit-logger' loaded successfully
[INFO] Plugin 'tool-filter' loaded successfully
[INFO] Plugin manager initialized with 2 active plugin(s)
```

### 3. Test Plugin Hooks in Action

With Saiki running, try these commands:

#### CLI Mode:
```bash
# This should work (read_file is allowed)
echo "Can you read the package.json file?" | npx saiki chat --config test-plugins.yml

# This should be blocked (if tool not in allowedTools)
echo "Search the web for AI news" | npx saiki chat --config test-plugins.yml
```

#### Web Mode (Browser):
1. Go to `http://localhost:3000`
2. Ask: "Can you list the files in this directory?"
3. Ask: "Read the README.md file"
4. Ask: "Create a new file called test.txt" (may be blocked depending on config)

## What to Look For

### ✅ Plugin Loading Success Signs:
- No error messages during startup
- Plugin loading messages in logs
- "initialized with X active plugin(s)" message

### ✅ Plugin Hook Execution Signs:
- `[AuditLogger]` messages when tools are used
- `[ToolFilter]` allow/block messages
- `[AUDIT]` JSON entries in logs

### ✅ Tool Filtering Working:
- Allowed tools execute normally
- Blocked tools return error messages like "Tool 'X' is not allowed by plugin policy"

### ❌ Common Issues and Fixes:

**Plugin files not found:**
```bash
ls -la plugins/  # Check files exist
```

**Permission errors:**
```bash
chmod +r plugins/*.ts  # Make files readable
```

**Path issues:**
```bash
pwd  # Make sure you're in the saiki directory
```

**Import errors:**
```bash
node --version  # Needs Node.js 18+ for ES modules
```

**TypeScript compilation errors:**
```bash
npm install typescript  # Install TypeScript compiler for .ts plugins
```

## Advanced Testing

### Test Different Plugin Configurations

Edit `test-plugins.yml` to try different settings:

```yaml
plugins:
  - name: "tool-filter"
    config:
      mode: "deny"  # Switch to deny mode
      deniedTools:
        - "write_file"
        - "delete_file"
```

### Monitor Plugin Activity

```bash
# Run with debug logging
DEBUG=* npx saiki --config test-plugins.yml

# Or watch logs in real-time
tail -f .saiki/logs/saiki.log
```

### Test Plugin Error Handling

Temporarily break a plugin file to test error handling:

```bash
# Backup original
cp plugins/audit-logger.js plugins/audit-logger.js.backup

# Add syntax error
echo "BROKEN_SYNTAX" >> plugins/audit-logger.js

# Start Saiki (should handle error gracefully)
npx saiki --config test-plugins.yml

# Restore original
mv plugins/audit-logger.js.backup plugins/audit-logger.js
```

## Success Criteria

Your plugin system is working correctly if:

- ✅ Test script runs without errors
- ✅ Saiki starts with plugin loading messages
- ✅ Tool calls generate audit logs
- ✅ Tool filtering blocks/allows tools as configured
- ✅ No critical errors in startup logs

## Next Steps

Once plugins are working:
1. Create your own custom plugins
2. Experiment with different hook types
3. Add plugins to your production agent configurations
4. Monitor plugin performance in real workflows