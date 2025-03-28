# MCP-Runtime Roadmap

This document outlines the planned features and enhancements for the MCP-Runtime project.

## High Priority

- **Conversation Tracking with Multiple Servers**: Enhance the conversation history to track which server handled each interaction, improving context awareness and enabling better tool selection.
- **Error Recovery**: Improve error handling and recovery mechanisms when tool calls fail.
- **Performance Optimization**: Reduce latency in multi-server scenarios by optimizing how tools are discovered and called.
- **Multiple model support**: Onboard other providers other than openai. Consider using Vercel AI SDK.

## Medium Priority

- **Server Health Monitoring**: Implement health checks for connected servers to detect when a server becomes unresponsive and gracefully handle reconnection attempts.
- **Dynamic Server Connection**: Allow adding/removing servers during an active session without restarting the AI CLI.
- **Tool Usage Analytics**: Track which tools are being used most frequently and from which servers to help with optimization and debugging.
- **Connection Caching**: Cache server connections for faster startup when reconnecting to previously used servers.
- **Model information per tool**: Allow the config file to specify which model should be used to run tools from an mcp server. This might be useful - some servers might be better on some models??

## Low Priority

- **Tool Name Conflict Resolution**: Implement a strategy for handling tools with identical names from different servers, such as automatically prefixing tool names with server identifiers or providing a more sophisticated mapping system.
- **Server-Specific Context**: Allow the LLM to maintain separate contexts for different servers while still being able to orchestrate cross-server workflows.
- **Interactive Server Configuration**: Provide a user-friendly way to create and edit server configurations.
- **Tool Documentation**: Generate comprehensive documentation about available tools from all connected servers.
- **Add timeouts for tool calls**: Keep a timeout for tool calls
