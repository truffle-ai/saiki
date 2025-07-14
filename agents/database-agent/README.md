# Database Agent

An AI agent that provides natural language access to database operations and analytics. This approach changes how we interact with data - instead of learning SQL syntax, building query interfaces, or designing complex dashboards, users can simply ask for what they need in natural language.

## Setup

```bash
cd database-agent
./setup-database.sh
npm start -- --agent database-agent.yml
```

## Example Interactions

- "Show me all users"
- "Create a new user named John Doe with email john@example.com"
- "Find products under $100"
- "Generate a sales report by category"

## Capabilities

- **Data Queries**: Natural language database queries and reporting
- **Data Management**: Create, update, and delete records
- **Analytics**: Generate insights and business intelligence
- **Schema Operations**: Table creation and database structure management

## How It Works

The agent connects to a SQLite database via MCP server and:
- Interprets natural language requests into SQL queries
- Validates data before operations
- Provides formatted results and insights
- Handles errors gracefully with helpful suggestions

This agent demonstrates intelligent database interaction through conversation. 