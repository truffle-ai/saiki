# CLI Migration to Ink/React - Implementation Plan

## Overview
This document outlines the migration of Saiki's CLI from a basic readline interface to a modern, component-based Ink/React terminal application.

## Current State Analysis

### Existing Components
- `cli.ts` - Main CLI entry point with readline loop
- `cli-subscriber.ts` - Event handling for agent responses  
- `tool-confirmation/cli-confirmation-provider.ts` - Tool approval interface
- Manual terminal manipulation with ANSI codes
- Basic boxen-based UI with manual cursor management

### Current Pain Points
1. **Manual State Management**: Tracking `accumulatedResponse`, `currentLines`, cursor positions
2. **Fragile Rendering**: Manual ANSI escape sequences, vulnerable to terminal resizing
3. **Limited Interactivity**: Basic readline with arrow key handling only for tool confirmation
4. **Poor UX**: No visual feedback during long operations, limited layout flexibility
5. **Maintenance Overhead**: Complex manual cleanup and state synchronization

## Target Architecture

### Dependencies to Add
```bash
npm install ink react @types/react ink-text-input ink-select-input ink-spinner ink-box ink-divider
npm install --save-dev ink-testing-library
```

### Component Hierarchy
```
SaikiApp (Main App)
├── Header (Connection status, tool count)
├── ChatArea
│   ├── MessageHistory (Scrollable conversation)
│   ├── StreamingResponse (Live AI response)
│   └── ToolConfirmation (Interactive tool approval)
├── InputArea 
│   ├── InputBox (Command/message input)
│   └── CommandHelp (Available commands)
└── StatusBar (Current mode, shortcuts)
```

## Implementation Phases

### Phase 1: Core Infrastructure
**Goal**: Set up basic Ink app structure
**Files**: 
- `src/app/cli/components/SaikiApp.tsx`
- `src/app/cli/components/hooks/useAgent.ts`
- `src/app/cli/ink-cli.ts` (new entry point)

**Key Features**:
- Basic React component structure
- Agent integration hook
- Event subscription setup
- Simple input/output display

### Phase 2: Event Integration  
**Goal**: Replace CLISubscriber with React state management
**Files**:
- `src/app/cli/components/hooks/useAgentEvents.ts`
- `src/app/cli/components/ChatArea.tsx`
- `src/app/cli/components/StreamingResponse.tsx`

**Key Features**:
- Convert agent events to React state updates
- Streaming response display with automatic layout
- Error handling and display

### Phase 3: Interactive Features
**Goal**: Rich input handling and tool confirmation
**Files**:
- `src/app/cli/components/InputArea.tsx`
- `src/app/cli/components/ToolConfirmation.tsx`
- `src/app/cli/components/CommandPalette.tsx`

**Key Features**:
- Tab completion for commands
- Interactive tool confirmation with visual feedback
- Command history navigation
- Keyboard shortcuts (Ctrl+C, Ctrl+L, etc.)

### Phase 4: Advanced UI
**Goal**: Professional terminal interface
**Files**:
- `src/app/cli/components/Header.tsx`
- `src/app/cli/components/StatusBar.tsx`
- `src/app/cli/components/HelpModal.tsx`

**Key Features**:
- Real-time connection status
- Tool loading indicators
- Contextual help system
- Settings interface

### Phase 5: Testing & Polish
**Goal**: Comprehensive testing and UX improvements
**Files**:
- `src/app/cli/components/__tests__/`
- Performance optimizations
- Accessibility improvements

## Detailed Component Specifications

### SaikiApp.tsx (Main Component)
```typescript
interface SaikiAppProps {
  agent: SaikiAgent;
  headless?: boolean;
  prompt?: string;
}

interface AppState {
  mode: 'chat' | 'tool-confirmation' | 'help';
  connectionStatus: 'connecting' | 'connected' | 'error';
  toolsLoaded: boolean;
  messages: Message[];
  currentInput: string;
  isStreaming: boolean;
}
```

### useAgentEvents Hook
```typescript
interface AgentEventState {
  isThinking: boolean;
  streamingText: string;
  pendingTool: ToolExecutionDetails | null;
  error: Error | null;
  conversationReset: boolean;
}

function useAgentEvents(agent: SaikiAgent): AgentEventState {
  // Subscribe to agent events
  // Convert to React state updates
  // Handle cleanup on unmount
}
```

### ChatArea Component
```typescript
interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: any;
}

interface ChatAreaProps {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
  isThinking: boolean;
}
```

### ToolConfirmation Component  
```typescript
interface ToolConfirmationProps {
  tool: ToolExecutionDetails;
  onApprove: () => void;
  onDeny: () => void;
  onAlwaysApprove: () => void;
}
```

## Migration Strategy

### Step 1: Parallel Implementation
- Create new Ink-based CLI alongside existing one
- Add `--ui=ink` flag to enable new interface
- Maintain backward compatibility

### Step 2: Feature Parity
- Implement all existing CLI features in Ink
- Add comprehensive tests
- Performance benchmarking

### Step 3: Enhanced Features
- Add features not possible with readline:
  - Real-time status updates
  - Better tool confirmation UX
  - Command auto-completion
  - Visual progress indicators

### Step 4: Migration
- Make Ink CLI the default
- Deprecate old CLI with migration notice
- Remove old implementation after stabilization period

## Implementation Examples

### Basic SaikiApp Structure
```typescript
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { SaikiAgent } from '@core/index.js';
import { Header } from './Header.js';
import { ChatArea } from './ChatArea.js';
import { InputArea } from './InputArea.js';
import { useAgentEvents } from '../hooks/useAgentEvents.js';

interface SaikiAppProps {
  agent: SaikiAgent;
}

export function SaikiApp({ agent }: SaikiAppProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<'chat' | 'help'>('chat');
  
  const eventState = useAgentEvents(agent);
  
  const handleUserInput = async (input: string) => {
    if (input.startsWith('/')) {
      // Handle commands
      await handleCommand(input);
    } else {
      // Send to agent
      await agent.run(input);
    }
  };
  
  return (
    <Box flexDirection="column" height="100%">
      <Header 
        connectionStatus={agent.clientManager.getClients().size > 0 ? 'connected' : 'error'}
        toolCount={Object.keys(await agent.clientManager.getAllTools()).length}
      />
      
      <Box flexGrow={1}>
        {mode === 'chat' ? (
          <ChatArea 
            messages={messages}
            streamingText={eventState.streamingText}
            isStreaming={eventState.isStreaming}
            isThinking={eventState.isThinking}
          />
        ) : (
          <HelpModal onClose={() => setMode('chat')} />
        )}
      </Box>
      
      <InputArea 
        onSubmit={handleUserInput}
        disabled={eventState.isStreaming}
      />
    </Box>
  );
}
```

### Event Integration Hook
```typescript
import { useState, useEffect } from 'react';
import { SaikiAgent } from '@core/index.js';

export function useAgentEvents(agent: SaikiAgent) {
  const [isThinking, setIsThinking] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const eventBus = agent.agentEventBus;
    
    const handleThinking = () => setIsThinking(true);
    const handleChunk = ({ content }: { content: string }) => {
      setStreamingText(prev => prev + content);
      setIsThinking(false);
    };
    const handleResponse = ({ content }: { content: string }) => {
      setStreamingText('');
      setIsThinking(false);
      // Add to message history
    };
    const handleError = ({ error }: { error: Error }) => {
      setError(error);
      setIsThinking(false);
      setStreamingText('');
    };
    
    eventBus.on('llmservice:thinking', handleThinking);
    eventBus.on('llmservice:chunk', handleChunk);
    eventBus.on('llmservice:response', handleResponse);
    eventBus.on('llmservice:error', handleError);
    
    return () => {
      eventBus.off('llmservice:thinking', handleThinking);
      eventBus.off('llmservice:chunk', handleChunk);
      eventBus.off('llmservice:response', handleResponse);
      eventBus.off('llmservice:error', handleError);
    };
  }, [agent]);
  
  return { isThinking, streamingText, error };
}
```

## Benefits After Migration

### For Users
1. **Better Visual Feedback**: Real-time progress indicators, connection status
2. **Improved Navigation**: Keyboard shortcuts, command completion  
3. **Enhanced Tool Confirmation**: Clear visual interface for approving tools
4. **Responsive Layout**: Automatically adapts to terminal size
5. **Error Recovery**: Better error display and recovery options

### For Developers  
1. **Maintainable Code**: Component-based architecture, clear separation of concerns
2. **Testable**: Components can be unit tested with ink-testing-library
3. **Extensible**: Easy to add new UI features and components
4. **Type Safety**: Full TypeScript support throughout
5. **Debugging**: React DevTools support for terminal apps

## Timeline Estimate
- **Phase 1**: 1-2 weeks (basic structure)
- **Phase 2**: 1-2 weeks (event integration) 
- **Phase 3**: 2-3 weeks (interactive features)
- **Phase 4**: 1-2 weeks (advanced UI)
- **Phase 5**: 1-2 weeks (testing & polish)

**Total**: 6-11 weeks for complete migration

## Next Steps
1. Add Ink dependencies to package.json
2. Create basic component structure
3. Implement core SaikiApp component
4. Set up event integration hooks
5. Create parallel CLI entry point for testing

This migration will significantly improve the CLI experience while maintaining all existing functionality and adding powerful new capabilities. 