#!/usr/bin/env npx tsx

/**
 * Scheduled Agent Example
 *
 * This example demonstrates the new input event system and scheduler functionality
 * that allows agents to be triggered by time-based events and external inputs.
 *
 * Features demonstrated:
 * - Creating scheduled tasks (one-time and recurring)
 * - Triggering agents via input events
 * - Managing scheduled tasks via API
 * - Event-driven agent processing
 */

import { SaikiAgent } from '../dist/src/core/index.js';
import type { AgentConfig } from '../dist/src/core/index.js';

async function main() {
    console.log('🚀 Starting Scheduled Agent Example\n');

    // Create agent configuration
    const config: AgentConfig = {
        systemPrompt: `You are a helpful AI assistant that can be triggered by scheduled events.
        
        When processing scheduled messages, always:
        1. Acknowledge the trigger type (scheduled, webhook, external)
        2. Provide helpful information based on the context
        3. Log the current time and any metadata provided`,

        llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20240620',
            apiKey: process.env.ANTHROPIC_API_KEY || 'demo-key',
            router: 'in-built',
        },
        mcpServers: {},
        storage: {
            cache: { type: 'in-memory' },
            database: { type: 'in-memory' },
        },
        sessions: {
            maxSessions: 10,
            sessionTTL: 3600,
        },
        toolConfirmation: {
            mode: 'auto-approve',
            allowedToolsStorage: 'memory',
            timeout: 30000,
        },
    };

    // Create and start the agent
    const agent = new SaikiAgent(config);
    await agent.start();

    console.log('✅ Agent started successfully\n');

    // Mock the agent.run method for demo purposes
    // In a real scenario, this would call the actual LLM
    const originalRun = agent.run.bind(agent);
    agent.run = async (message: string, imageData?: any, sessionId?: string) => {
        const timestamp = new Date().toISOString();
        console.log(`🤖 Agent Processing [${timestamp}]:`);
        console.log(`   Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
        console.log(`   Session: ${sessionId || 'default'}`);
        console.log('   Response: Mock AI response - task acknowledged\n');

        return `[${timestamp}] Task acknowledged: ${message.substring(0, 50)}...`;
    };

    // Example 1: Create a one-time scheduled task
    console.log('📅 Creating one-time scheduled task...');
    const oneTimeTask = agent.createScheduledTask({
        message: 'Daily system health check - check server status and disk usage',
        scheduledFor: new Date(Date.now() + 2000), // 2 seconds from now
        sessionId: 'health-check',
        metadata: {
            type: 'health-check',
            priority: 'normal',
            department: 'infrastructure',
        },
    });
    console.log(`   Task ID: ${oneTimeTask}\n`);

    // Example 2: Create a recurring scheduled task
    console.log('🔄 Creating recurring scheduled task...');
    const recurringTask = agent.createScheduledTask({
        message: 'Weekly report reminder - prepare weekly team status report',
        scheduledFor: new Date(Date.now() + 4000), // 4 seconds from now
        sessionId: 'weekly-reports',
        recurring: {
            pattern: 'custom',
            interval: 3000, // Every 3 seconds for demo
        },
        maxExecutions: 3, // Limit to 3 executions for demo
        metadata: {
            type: 'reminder',
            priority: 'high',
            department: 'management',
        },
    });
    console.log(`   Task ID: ${recurringTask}\n`);

    // Example 3: Trigger input events manually
    console.log('🎯 Triggering manual input events...');

    // Trigger a conversation event
    setTimeout(() => {
        console.log('📡 Triggering conversation event...');
        agent.triggerInputEvent('saiki:triggerConversation', {
            message: 'Manual trigger: Check current system metrics and generate summary',
            sessionId: 'manual-trigger',
            metadata: {
                source: 'manual',
                requestedBy: 'admin',
                urgency: 'normal',
            },
            source: 'admin-panel',
        });
    }, 6000);

    // Trigger a webhook event
    setTimeout(() => {
        console.log('🪝 Triggering webhook event...');
        agent.triggerInputEvent('saiki:webhookReceived', {
            webhookId: 'gh_webhook_123',
            payload: {
                action: 'deployment_completed',
                environment: 'production',
                repository: 'my-app',
                commit: 'abc123def',
                status: 'success',
            },
            headers: {
                'x-github-event': 'deployment',
                'content-type': 'application/json',
            },
            source: 'github',
            transformedMessage:
                'GitHub Deployment Notification: Production deployment of my-app (commit abc123def) completed successfully',
            sessionId: 'deployment-notifications',
        });
    }, 8000);

    // Trigger an external event
    setTimeout(() => {
        console.log('🌐 Triggering external event...');
        agent.triggerInputEvent('saiki:externalTrigger', {
            triggerId: 'monitoring_alert_789',
            source: 'datadog',
            data: {
                alert_type: 'metric',
                metric: 'response_time',
                value: 1500,
                threshold: 1000,
                severity: 'warning',
                service: 'api-gateway',
            },
            message:
                'Performance Alert: API Gateway response time (1500ms) exceeded threshold (1000ms)',
            sessionId: 'monitoring-alerts',
            metadata: {
                alert_id: 'alert_789',
                team: 'platform',
                runbook: 'https://runbooks.example.com/response-time',
            },
        });
    }, 10000);

    // Example 4: Demonstrate scheduler management
    setTimeout(async () => {
        console.log('📊 Scheduler Management Demo:');

        // Get scheduler stats
        const stats = agent.getSchedulerStats();
        console.log(`   Total tasks: ${stats.totalTasks}`);
        console.log(`   Enabled tasks: ${stats.enabledTasks}`);
        console.log(`   Recurring tasks: ${stats.recurringTasks}`);
        console.log(`   Pending executions: ${stats.pendingExecutions}`);
        console.log(`   Scheduler running: ${stats.isRunning}\n`);

        // List all tasks
        const tasks = agent.listScheduledTasks();
        console.log('📝 All scheduled tasks:');
        tasks.forEach((task) => {
            console.log(
                `   ${task.id}: "${task.message.substring(0, 40)}..." (enabled: ${task.enabled}, executions: ${task.executionCount})`
            );
        });
        console.log('');

        // Disable the recurring task after demo
        console.log('⏸️  Disabling recurring task...');
        agent.setScheduledTaskEnabled(recurringTask, false);
        console.log('   Recurring task disabled\n');
    }, 12000);

    // Example 5: API endpoints demonstration (simulated)
    setTimeout(() => {
        console.log('🌐 API Endpoints Available:');
        console.log('   POST /api/scheduler/tasks - Create scheduled task');
        console.log('   GET  /api/scheduler/tasks - List scheduled tasks');
        console.log('   GET  /api/scheduler/tasks/:taskId - Get specific task');
        console.log('   PUT  /api/scheduler/tasks/:taskId - Update task');
        console.log('   DELETE /api/scheduler/tasks/:taskId - Delete task');
        console.log('   GET  /api/scheduler/stats - Get scheduler statistics');
        console.log('');
        console.log('   POST /api/trigger/conversation - Trigger conversation event');
        console.log('   POST /api/trigger/webhook - Trigger webhook event');
        console.log('   POST /api/trigger/external - Trigger external event');
        console.log('');

        console.log('💡 Example API calls:');
        console.log('   curl -X POST http://localhost:3001/api/scheduler/tasks \\');
        console.log('     -H "Content-Type: application/json" \\');
        console.log(
            '     -d \'{"message":"Daily backup reminder","scheduledFor":"2024-01-16T09:00:00Z","recurring":{"pattern":"daily"}}\''
        );
        console.log('');
        console.log('   curl -X POST http://localhost:3001/api/trigger/conversation \\');
        console.log('     -H "Content-Type: application/json" \\');
        console.log(
            '     -d \'{"message":"Emergency system check required","sessionId":"emergency","source":"monitoring"}\''
        );
        console.log('');
    }, 14000);

    // Cleanup after demo
    setTimeout(async () => {
        console.log('🧹 Cleaning up and stopping agent...');
        await agent.stop();
        console.log('✅ Demo completed successfully!');
        console.log('');
        console.log(
            '🎉 You can now use the input event system and scheduler in your Saiki agents!'
        );
        console.log('   - Schedule tasks for future execution');
        console.log('   - Create recurring reminders and checks');
        console.log('   - Trigger agents via external events');
        console.log('   - Build event-driven workflows');
        console.log('');
        process.exit(0);
    }, 16000);

    // Keep the process alive for the demo
    console.log('⏳ Demo running... Watch for scheduled events and triggers!\n');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

// Run the example
main().catch((error) => {
    console.error('❌ Example failed:', error);
    process.exit(1);
});
