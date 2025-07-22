# Product Name Research Agent

An AI agent specialized in comprehensive product name research, including domain availability checking, trademark searching, social media handle availability, and competitive analysis.

## Features

- **Domain Availability**: Check multiple TLD extensions for product names
- **Trademark Research**: Search for potential trademark conflicts
- **Social Media Handle Availability**: Verify availability across major platforms
- **Competitive Analysis**: Research existing products with similar names
- **Brand Validation**: Comprehensive scoring and recommendations

## Prerequisites

Ensure you have the domain checker MCP server available:

```bash
# Install the domain checker MCP server
uvx --from git+https://github.com/truffle-ai/mcp-servers --subdirectory src/domain-checker truffle-domain-checker-mcp
```

## Usage

### Start the Agent

```bash
# From the saiki root directory
saiki run agents/product-name-researcher/product-name-researcher.yml
```

### Example Interactions

**Single Product Name Research:**
```
User: I want to research the name "CloudSync" for my new file sync product
Agent: [Performs comprehensive research including domain availability, trademark search, social media handles, and competitive analysis]
```

**Compare Multiple Names:**
```
User: Help me choose between "DataFlow", "InfoStream", and "SyncHub" for my data management tool
Agent: [Compares all three names across multiple criteria and provides recommendations]
```

**Domain-Focused Research:**
```
User: Check domain availability for "myawesomeapp" across all major TLDs
Agent: [Uses domain checker to verify availability across .com, .net, .org, .io, .app, etc.]
```

## Configuration

The agent uses:
- **Domain Checker MCP Server**: For domain availability checking
- **Puppeteer MCP Server**: For web scraping trademark databases and social media
- **Filesystem MCP Server**: For saving research reports

## Research Report

The agent generates comprehensive reports including:

1. **Domain Availability Summary**
   - Available domains with recommendations
   - Pricing information where available
   - Alternative TLD suggestions

2. **Trademark Analysis**
   - Similar trademarks found
   - Risk assessment
   - Recommendations for trademark clearance

3. **Social Media Handle Availability**
   - Major platform availability (Twitter, Instagram, Facebook, LinkedIn)
   - Username alternatives if primary unavailable

4. **Competitive Landscape**
   - Existing products with similar names
   - Market positioning analysis
   - Differentiation opportunities

5. **Overall Recommendation**
   - Scoring across all criteria
   - Risk assessment
   - Next steps recommendations

## Tips for Best Results

- **Be specific about your product**: Include the product category and target market
- **Provide alternatives**: Give multiple name options for comparison
- **Consider your priorities**: Mention if domain availability, trademark clearance, or social media presence is most important
- **Think internationally**: Consider how the name works in different languages and markets