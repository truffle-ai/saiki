---
sidebar_position: 6
---

# Declarative Agent Development

Saiki introduces a **declarative paradigm** for AI agent development that fundamentally changes how developers think about building intelligent systems. Instead of writing imperative code to define workflows, you declare what your agent should be capable of through configuration.

## What is Declarative Development?

**Declarative development** means you describe **what** you want your system to do, not **how** to do it. The system figures out the execution details dynamically.

This pattern is familiar in other domains:
- **SQL**: You declare what data you want, not how to fetch it
- **CSS**: You declare how elements should look, not how to render them  
- **Infrastructure as Code**: You declare your desired infrastructure state, not the steps to build it

Saiki applies this same principle to AI agents. Instead of writing code to handle every possible user interaction, you declare the agent's capabilities and let the AI figure out how to fulfill user requests.

### Traditional Workflow Approach vs. Declarative Agent Approach

| Aspect | Traditional Workflows | Declarative Agents |
|--------|---------------------|-------------------|
| **Development Style** | Write step-by-step code | Configure capabilities |
| **Flexibility** | Fixed, predefined flows | Dynamic, adaptive behavior |
| **Tool Integration** | Hard-coded API calls | Declarative MCP server connections |
| **User Interaction** | Form-based or button-driven | Natural language conversation |
| **Error Handling** | Predefined error paths | Intelligent problem-solving |
| **Maintenance** | Code changes for new features | Configuration updates |

## The Four Core Declarations

When building a Saiki agent, you make four key declarations that define its behavior:

### 1. **Declare Your Tools**

You specify which external services and capabilities your agent should have access to through MCP (Model Context Protocol) servers:

```yaml
mcpServers:
  database:
    type: stdio
    command: npx
    args: ["-y", "@executeautomation/database-server", "./data.db"]
  
  payments:
    type: stdio
    command: npx
    args: ["-y", "@stripe/mcp"]
    env:
      STRIPE_SECRET_KEY: $STRIPE_SECRET_KEY
```

**What you're doing**: Telling the agent "you have access to a database and payment processing"
**What you're NOT doing**: Writing code to connect to APIs, handle authentication, or manage data formats

### 2. **Declare Your Agent's Behavior**

You define the agent's personality, capabilities, and interaction patterns through system prompts:

```yaml
systemPrompt:
  contributors:
    - id: primary
      type: static
      priority: 0
      content: |
        You are a Customer Service Agent that can:
        - Process customer information and create accounts
        - Handle payments and manage subscriptions  
        - Access customer data and generate reports
        - Provide intelligent assistance and problem-solving
        
        Always validate information before processing and explain what you're doing.
```

**What you're doing**: Defining the agent's role and interaction style
**What you're NOT doing**: Writing conversation flows, decision trees, or response templates

### 3. **Declare Your Context Sources**

You specify what background information and knowledge the agent should have. These are combined with the behavior declaration into a single context window for the LLM:

```yaml
systemPrompt:
  contributors:
    - id: policies
      type: static
      priority: 5
      content: |
        Company Policies:
        - Free trial: 14 days
        - Refunds require manager approval
        - Enterprise plans include priority support
        - All data is encrypted and secure
    
    - id: dateTime
      type: dynamic
      priority: 10
      source: dateTime
      enabled: true
```

**What you're doing**: Providing the agent with domain knowledge, business rules, and dynamic context
**What you're NOT doing**: Hard-coding these rules into application logic or managing context manually

**How Contributors Work**: All `contributors` under `systemPrompt` are combined into a single context window sent to the LLM. The `priority` field determines the order, and `type` determines whether content is static (always included) or dynamic (generated on-demand).

### 4. **Declare Your LLM Configuration**

You specify which AI model and settings to use for the agent's reasoning and responses:

```yaml
llm:
  provider: openai
  model: gpt-4o-mini
  apiKey: $OPENAI_API_KEY
  temperature: 0.1  # Lower for more consistent behavior
  maxOutputTokens: 2000
```

**What you're doing**: Choosing the AI model and configuring its behavior parameters
**What you're NOT doing**: Managing model selection logic or handling API rate limits

## What Gets Automated

When you make these declarations, Saiki automatically handles:

- **Tool Discovery**: The agent learns what tools are available and their capabilities
- **Request Routing**: The agent decides which tools to use for each user request
- **Error Handling**: The agent can try alternative approaches when things fail
- **Conversation Management**: The agent maintains context and asks clarifying questions
- **Data Formatting**: The agent handles the translation between user language and tool APIs
- **Multi-step Orchestration**: The agent can chain multiple tools together to complete complex tasks
- **Context Management**: The agent intelligently combines static and dynamic context sources
- **Model Selection**: The agent uses the specified LLM for all reasoning and generation

## A Complete Example: Customer Onboarding Agent

Let's see how these four declarations work together to create a powerful customer onboarding system.

### The Problem
Traditional customer onboarding requires building:
- User registration forms
- Payment processing integration  
- Account creation workflows
- Email notification systems
- Error handling for each step
- UI for different scenarios (success, failure, validation errors)

### The Declarative Solution

**1. Declare the Tools**
```yaml
mcpServers:
  # Customer database
  sqlite:
    type: stdio
    command: npx
    args: ["-y", "@executeautomation/database-server", "./data/customers.db"]
  
  # Payment processing
  stripe:
    type: stdio
    command: npx
    args: ["-y", "@stripe/mcp"]
    env:
      STRIPE_SECRET_KEY: $STRIPE_SECRET_KEY
  
  # Email notifications
  email:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-email"]
```

**2. Declare the Agent's Behavior**
```yaml
systemPrompt:
  contributors:
    - id: primary
      type: static
      priority: 0
      content: |
        You are a Customer Onboarding Agent that handles complete customer journeys.
        
        Your process:
        1. Collect customer information (name, email, company, plan preference)
        2. Validate the information and ask for clarification if needed
        3. Create customer record in database
        4. Set up Stripe customer and process initial payment
        5. Send welcome email with account details
        6. Confirm everything is set up correctly
        
        Always explain what you're doing and confirm each step with the customer.
```

**3. Declare the Context**
```yaml
systemPrompt:
  contributors:
    - id: policies
      type: static
      priority: 5
      content: |
        Business Rules:
        - Free trial: 14 days, no credit card required
        - Pro plan: $29/month, includes priority support
        - Enterprise plan: $99/month, includes custom integrations
        - All plans include 30-day money-back guarantee
    
    - id: dateTime
      type: dynamic
      priority: 10
      source: dateTime
      enabled: true
```

**4. Declare the LLM**
```yaml
llm:
  provider: openai
  model: gpt-4o-mini
  apiKey: $OPENAI_API_KEY
  temperature: 0.1  # Consistent behavior for business processes
  maxOutputTokens: 2000
```

### The Result

With these four declarations, users can now interact naturally:

**User**: "I want to sign up for the Pro plan. My name is Sarah Johnson, email sarah@techstartup.com, and we're a 10-person team."

**Agent**: "I'll help you get set up with the Pro plan. Let me collect your information and process everything for you.

First, let me create your customer record... ✅ Done
Now I'll set up your Stripe customer profile... ✅ Done  
Processing your Pro plan payment ($29/month)... ✅ Payment successful
Sending your welcome email with account details... ✅ Email sent

You're all set! Your Pro plan is active and you have access to priority support. I've sent account details to sarah@techstartup.com. Is there anything else you need help with?"

### What Just Happened

The agent automatically:
- **Understood the request** from natural language
- **Collected missing information** (company name, payment method)
- **Orchestrated multiple tools** (database, payments, email)
- **Handled the entire workflow** without predefined steps
- **Provided clear feedback** at each stage
- **Maintained context** throughout the conversation
- **Used the specified LLM** for reasoning and response generation

## Advanced Declarative Patterns

### **Dynamic Context Sources**
Beyond static policies, you can include dynamic context that updates automatically:

```yaml
systemPrompt:
  contributors:
    - id: userProfile
      type: dynamic
      priority: 15
      source: userProfile
      enabled: true
    
    - id: systemStatus
      type: dynamic
      priority: 20
      source: systemStatus
      enabled: true
```

### **Tool-Specific Behavior**
You can declare behavior patterns for specific tools:

```yaml
systemPrompt:
  contributors:
    - id: databaseBehavior
      type: static
      priority: 5
      content: |
        When working with the database:
        - Always validate data before insertion
        - Use transactions for multi-step operations
        - Provide clear error messages for constraint violations
```

### **Environment-Specific Configuration**
Different environments can use different declarations:

```yaml
# Development
llm:
  provider: openai
  model: gpt-4o-mini
  temperature: 0.3  # More creative for testing

# Production  
llm:
  provider: openai
  model: gpt-4o
  temperature: 0.1  # More consistent for production
```

## Why This Approach Works

### **For Complex Systems**
Traditional workflows break down when you need to handle edge cases, user variations, or changing requirements. Declarative agents adapt dynamically because they understand the goal, not just the steps.

### **For Natural Interaction**  
Users don't think in terms of forms and buttons. They think in terms of goals: "I want to upgrade my plan" or "Help me add team members." Declarative agents work the way users naturally communicate.

### **For Rapid Development**
You focus on what matters (business logic, user experience) while the AI handles the complexity (tool integration, error handling, conversation management).

### **For Maintainability**
Configuration changes are easier to review, test, and deploy than code changes. The declarative approach makes system behavior explicit and version-controlled.

## When to Use Declarative Agents

**Perfect For:**
- Complex business processes with multiple tools and services
- Systems where user needs vary significantly
- Natural language interfaces to existing systems
- Rapid prototyping of intelligent workflows
- Systems requiring intelligent error handling and recovery

**Not Ideal For:**
- Simple, linear processes with fixed steps
- High-frequency operations where speed is critical
- Systems requiring precise, deterministic behavior
- Legacy systems that can't be wrapped in MCP servers

The declarative approach represents a fundamental shift from **"how to do it"** to **"what should be possible"** - enabling developers to build more intelligent, flexible, and user-friendly systems. 