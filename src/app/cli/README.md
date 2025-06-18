# Simplified Saiki CLI

The Saiki CLI provides a clean, ChatGPT-like interactive experience for AI-powered conversations with real-time streaming responses.

## 🚀 Quick Start

```bash
# Start interactive CLI
saiki

# One-shot command
saiki "What's the weather like today?"
```

## 🎯 Features

### Real-time Streaming
- **Inline Responses**: AI responses stream directly in the terminal
- **No Boxes**: Clean, inline text without borders or boxes
- **Real-time Feedback**: See responses as they're generated
- **Thinking Indicator**: Simple visual feedback during processing

### Interactive Chat
- **Continuous Conversation**: ChatGPT-like experience
- **Slash Commands**: Built-in commands for common actions
- **Clean Interface**: Focused on conversation
- **Keyboard Shortcuts**: Intuitive navigation

### Available Commands
- `/help` - Show available commands
- `/clear` - Clear conversation history  
- `/status` - Show connection status and model info
- `/exit` - Exit the CLI

## 💬 Example Session

```
🚀 Saiki CLI ready! Start chatting below.
Commands: /help, /clear, /exit
──────────────────────────────────────────────────────
💬 You: Hello! Can you help me with Python?
🤔 🤖 Hello! I'd be happy to help you with Python. What specifically would you like assistance with? Whether it's:

- Learning Python basics
- Debugging existing code
- Writing new functions or scripts
- Understanding specific concepts
- Working with libraries and frameworks

Just let me know what you're working on!

💬 You: /status
🔌 Status:
──────────────────────────────
Connected servers: 2
Model: gpt-4o-mini
Log level: info
──────────────────────────────

💬 You: Write a function to calculate fibonacci numbers
🤔 🤖 Here's a Python function to calculate Fibonacci numbers with multiple approaches:

```python
def fibonacci_recursive(n):
    """Calculate the nth Fibonacci number using recursion."""
    if n <= 1:
        return n
    return fibonacci_recursive(n - 1) + fibonacci_recursive(n - 2)

def fibonacci_iterative(n):
    """Calculate the nth Fibonacci number using iteration (more efficient)."""
    if n <= 1:
        return n
    
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b

# Example usage
print(fibonacci_iterative(10))  # Output: 55
```

The iterative version is much more efficient for larger numbers!

💬 You: /exit
👋 Goodbye!
```

## 🎨 Visual Features

### Streaming Experience
- **Real-time Text**: See responses as they're generated
- **Thinking Indicator**: 🤔 appears while AI is processing
- **Color Coding**: 
  - 💬 Blue for user input
  - 🤖 Green for AI responses
  - 🔧 Cyan for tool usage
  - ✅ Green for tool completion
  - ❌ Red for errors

### Clean Interface
- **No Borders**: Responses flow naturally in the terminal
- **Minimal UI**: Focus on the conversation
- **Clear Separation**: Visual separators between different content types
- **Consistent Formatting**: Predictable layout and styling

## 🛠️ Advanced Usage

### Configuration
The CLI respects all existing Saiki configuration:

```bash
# Use specific model
saiki --model gpt-4o

# Custom config file
saiki --config-file ./my-config.yml

# Set log level
SAIKI_LOG_LEVEL=debug saiki
```

### MCP Server Integration
- **Automatic Discovery**: Tools from connected MCP servers are available
- **Real-time Status**: Live connection monitoring
- **Tool Feedback**: Visual indicators when tools are used
- **Error Reporting**: Clear feedback on connection issues

### Keyboard Shortcuts
- `Ctrl+C` - Exit gracefully
- `Ctrl+D` - Exit gracefully
- `↑/↓` - Command history navigation
- `Tab` - No autocomplete (readline default)

## 🔧 Technical Details

### Streaming Implementation
The CLI uses the Saiki event system to provide real-time streaming:

- **Event Subscription**: Listens to `llmservice:chunk` events
- **Inline Display**: Writes chunks directly to `process.stdout`
- **State Management**: Tracks streaming state for clean output
- **Error Handling**: Graceful handling of streaming interruptions

### Event Handling
- `llmservice:thinking` - Shows thinking indicator
- `llmservice:chunk` - Streams response text
- `llmservice:toolCall` - Shows tool usage
- `llmservice:toolResult` - Shows tool completion
- `llmservice:response` - Finalizes response
- `llmservice:error` - Displays errors
- `saiki:conversationReset` - Handles conversation clearing

## 📊 Performance

### Optimizations
- **Minimal Overhead**: Lightweight streaming implementation
- **Fast Startup**: Quick initialization
- **Efficient Memory**: Proper cleanup and state management
- **Real-time Updates**: No buffering delays

## 🔄 Migration from Old CLI

The simplified CLI is fully backward compatible:

**Unchanged:**
- ✅ `saiki "one-shot command"` works exactly the same
- ✅ All configuration options respected
- ✅ Environment variables honored
- ✅ MCP server integration preserved

**Improved:**
- ✅ Better streaming experience
- ✅ Cleaner visual interface
- ✅ Simplified command structure
- ✅ More responsive interactions

## 🚀 Future Enhancements

Potential improvements for the CLI:
- Command autocomplete with Tab
- Syntax highlighting for code blocks
- Copy/paste improvements
- Session persistence
- Customizable themes

---

*The simplified CLI focuses on what matters most: a clean, fast, interactive chat experience with real-time streaming responses.* 