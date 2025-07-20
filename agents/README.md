# Saiki Agents

This directory contains various AI agent configurations and implementations built with Saiki. Each agent demonstrates different capabilities and use cases for declarative AI agent development.

## Available Agents

### 🎨 Image Editor Agent
An AI agent that provides comprehensive image editing and processing capabilities through natural language. This agent can analyze, transform, and enhance images using computer vision techniques.

**Quick Start:**
```bash
cd image-editor-agent
./setup-python-server.sh
npm start -- --agent image-editor-agent-python.yml
```

**Capabilities:**
- Image analysis and metadata extraction
- Resize, crop, and format conversion
- Apply filters and effects (blur, sharpen, vintage, etc.)
- Adjust brightness, contrast, and color properties
- Add text overlays and annotations
- Computer vision features (face detection, edge detection)
- Batch processing capabilities

**Example Interactions:**
- "Resize this image to 800x600 pixels"
- "Apply a vintage filter to make it look old"
- "Add text 'Hello World' in red at the top"
- "Detect faces in this image"

### 🎵 Music Agent
An AI agent that creates, analyzes, and manipulates music through natural language. This agent can generate melodies, analyze music theory, and process audio files.

**Quick Start:**
```bash
cd music-agent
./setup-python-server.sh
npm start -- --agent music-agent.yml
```

**Capabilities:**
- Generate melodies and chord progressions
- Analyze music theory and structure
- Process and manipulate audio files
- Create drum patterns and rhythms
- Transcribe and analyze existing music
- Export to various audio formats

**Example Interactions:**
- "Create a happy melody in C major"
- "Generate a drum pattern for a rock song"
- "Analyze the chord progression in this song"
- "Create a 4-bar melody with a jazz feel"

### 🗄️ Database Agent
An AI agent that provides natural language access to database operations and analytics. This simplifies database interaction - instead of building forms and queries, users can simply ask for what they need in plain language.

**Quick Start:**
```bash
cd database-agent
./setup-database.sh
npm start -- --agent database-agent.yml
```

**Capabilities:**
- Natural language query generation
- Data insertion and updates
- Report generation and analytics
- Schema exploration and understanding
- Complex query optimization

**Example Interactions:**
- "Show me all users"
- "Create a new user named John Doe with email john@example.com"
- "Find products under $100"
- "Generate a sales report by category"

### 📄 Talk2PDF Agent
An AI agent that can read, analyze, and extract information from PDF documents through natural language interaction.

**Quick Start:**
```bash
cd talk2pdf-agent
npm start -- --agent talk2pdf-agent.yml
```

**Capabilities:**
- PDF text extraction and analysis
- Document summarization
- Information retrieval from PDFs
- Question answering about document content
- Multi-page document processing

**Example Interactions:**
- "Summarize this PDF document"
- "What are the main points in section 3?"
- "Extract all email addresses from this document"
- "Find information about pricing in this PDF"

### 🎯 Triage Demo Agents
A collection of specialized agents demonstrating customer support and business process automation. This includes agents for billing, escalation, product information, and technical support.

**Quick Start:**
```bash
cd triage-demo
npm start -- --agent triage-agent.yml
```

**Available Agents:**
- **Billing Agent**: Handles payment inquiries and billing issues
- **Escalation Agent**: Manages customer escalations and complex issues
- **Product Info Agent**: Provides product information and recommendations
- **Technical Support Agent**: Assists with technical problems and troubleshooting

**Example Interactions:**
- "I need help with my billing statement"
- "I want to escalate this issue to a manager"
- "What features are included in the Pro plan?"
- "I'm having trouble logging into my account"

## Configuration Guide

Saiki uses YAML configuration files to define tool servers and AI settings. Each agent has its own configuration file that specifies:

1. **MCP Servers**: Tool servers that provide specific capabilities
2. **LLM Configuration**: AI model settings and provider configuration
3. **System Prompts**: Agent behavior and personality definitions

### Basic Configuration Structure

```yaml
mcpServers:
  # Tool server definitions
  example_server:
    type: stdio
    command: npx
    args: ["-y", "@example/mcp-server"]
    env:
      API_KEY: $EXAMPLE_API_KEY

llm:
  provider: openai
  model: gpt-4o-mini
  apiKey: $OPENAI_API_KEY
  temperature: 0.1
```

### Environment Variables

Set up your environment variables in a `.env` file:

```bash
# AI Provider Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Tool-specific keys
STRIPE_SECRET_KEY=your_stripe_key
GITHUB_PERSONAL_ACCESS_TOKEN=your_github_token
```

## Getting Started

1. **Choose an agent** from the available options above
2. **Navigate to the agent directory** and follow the setup instructions
3. **Configure environment variables** as needed
4. **Run the agent** using the provided commands
5. **Interact naturally** with the agent through conversation

## Development

To create your own agent:

1. **Define your tools** using MCP servers
2. **Configure the LLM** settings
3. **Write system prompts** that define agent behavior
4. **Test and iterate** on the agent's capabilities

See the [declarative agent development guide](../docs/docs/concepts/declarative-agent-development.md) for detailed information on building agents with Saiki.

## Examples Directory

Check the `examples/` directory for additional agent configurations including:
- Email and Slack integration
- Notion workspace management
- Website design and development
- Research and analysis

## Support

For questions and support:
- Check the [documentation](../docs/docs/)
- Review the [tutorials](../docs/docs/tutorials/)
- Explore the [examples](../examples/) directory 