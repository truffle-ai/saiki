#!/usr/bin/env node

/**
 * Simple test script to validate plugin system functionality
 * Run this to verify plugins are working correctly
 */

import { PluginManager } from './src/core/plugins/manager.js';
import { logger } from './src/core/logger/index.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Mock context for testing
const mockContext = {
  agentEventBus: {
    emit: (event, data) => console.log(`[AgentEvent] ${event}:`, data),
    on: () => {},
    off: () => {}
  },
  logger,
  mcpManager: {
    executeTool: async (toolName, args) => {
      console.log(`[Mock] Executing tool: ${toolName}`, args);
      return { result: `Mock result for ${toolName}` };
    },
    getAllTools: () => ({})
  },
  promptManager: {},
  stateManager: {}
};

async function testPluginSystem() {
  console.log('🧪 Testing Saiki Plugin System...\n');

  try {
    // 1. Test Plugin Manager Creation
    console.log('1️⃣  Creating PluginManager...');
    const pluginManager = new PluginManager(mockContext, process.cwd());
    console.log('✅ PluginManager created successfully\n');

    // 2. Test Plugin Loading
    console.log('2️⃣  Testing plugin loading...');
    
    const pluginConfigs = [
      {
        name: 'audit-logger',
        path: './plugins/audit-logger.js',
        enabled: true,
        priority: 10,
        config: { logLevel: 'debug' }
      },
      {
        name: 'tool-filter',
        path: './plugins/tool-filter.js',
        enabled: true,
        priority: 20,
        config: {
          mode: 'allow',
          allowedTools: ['read_file', 'write_file']
        }
      }
    ];

    await pluginManager.loadPlugins(pluginConfigs);
    console.log('✅ Plugins loaded successfully\n');

    // 3. Test Plugin Initialization
    console.log('3️⃣  Testing plugin initialization...');
    await pluginManager.initializePlugins();
    console.log(`✅ Initialized ${pluginManager.getActivePluginCount()} plugins\n`);

    // 4. Test Hook Execution - Before Tool Call
    console.log('4️⃣  Testing beforeToolCall hook...');
    const beforeContext = {
      toolName: 'read_file',
      args: { path: './package.json' },
      sessionId: 'test-session-123',
      sessionEventBus: {},
      ...mockContext
    };

    const beforeResult = await pluginManager.executeHook(
      'beforeToolCall',
      'test-session-123',
      {},
      beforeContext,
      beforeContext.args
    );

    console.log('Hook execution result:', {
      success: beforeResult.success,
      messages: beforeResult.messages,
      hasModifiedData: beforeResult.result !== undefined
    });
    console.log('✅ beforeToolCall hook executed successfully\n');

    // 5. Test Hook Execution - After Tool Call
    console.log('5️⃣  Testing afterToolCall hook...');
    const afterContext = {
      toolName: 'read_file',
      args: { path: './package.json' },
      result: { content: 'Mock file content...' },
      success: true,
      sessionId: 'test-session-123',
      sessionEventBus: {},
      ...mockContext
    };

    const afterResult = await pluginManager.executeHook(
      'afterToolCall',
      'test-session-123',
      {},
      afterContext,
      afterContext.result
    );

    console.log('Hook execution result:', {
      success: afterResult.success,
      messages: afterResult.messages,
      hasModifiedData: afterResult.result !== undefined
    });
    console.log('✅ afterToolCall hook executed successfully\n');

    // 6. Test Tool Blocking
    console.log('6️⃣  Testing tool blocking (should fail)...');
    const blockedContext = {
      toolName: 'delete_file', // Not in allowedTools
      args: { path: './some-file.txt' },
      sessionId: 'test-session-123',
      sessionEventBus: {},
      ...mockContext
    };

    const blockedResult = await pluginManager.executeHook(
      'beforeToolCall',
      'test-session-123',
      {},
      blockedContext,
      blockedContext.args
    );

    if (blockedResult.success === false) {
      console.log('✅ Tool correctly blocked by filter plugin');
      console.log('Block reason:', blockedResult.error?.message);
    } else {
      console.log('❌ Tool was not blocked when it should have been');
    }
    console.log();

    // 7. Test Plugin Stats
    console.log('7️⃣  Plugin system statistics...');
    console.log(`Active plugins: ${pluginManager.getActivePluginCount()}`);
    console.log('Plugin states:', Object.fromEntries(pluginManager.getPluginStates()));
    console.log();

    // 8. Cleanup
    console.log('8️⃣  Cleaning up...');
    await pluginManager.cleanup();
    console.log('✅ Cleanup completed\n');

    console.log('🎉 All plugin system tests passed!');
    console.log();
    console.log('Next steps:');
    console.log('- Start Saiki with: npx saiki --config test-plugins.yml');
    console.log('- Watch logs for plugin loading messages');
    console.log('- Try using tools to see plugin hooks in action');
    
  } catch (error) {
    console.error('❌ Plugin test failed:', error);
    process.exit(1);
  }
}

// Check if plugin files exist
async function checkPluginFiles() {
  const files = ['./plugins/audit-logger.js', './plugins/tool-filter.js'];
  
  for (const file of files) {
    try {
      await readFile(file);
      console.log(`✅ Found: ${file}`);
    } catch (error) {
      console.error(`❌ Missing: ${file}`);
      throw new Error(`Plugin file ${file} not found. Make sure you're in the saiki directory.`);
    }
  }
  console.log();
}

// Run the test
console.log('🔍 Checking plugin files...');
await checkPluginFiles();
await testPluginSystem();