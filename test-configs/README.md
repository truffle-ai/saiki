# Storage Configuration Testing Guide

This directory contains test configurations for manually testing different storage providers in Saiki.

## Prerequisites

1. **Build and Link Saiki**:
   ```bash
   # Build the project
   npm run build 
   
   # Link for global usage (optional, for CLI testing)
   npm link
   ```

2. **Environment Setup**:
   ```bash
   # Set your OpenAI API key
   export OPENAI_API_KEY="your-api-key-here"
   
   # Or create a .env file in the project root:
   echo "OPENAI_API_KEY=your-api-key-here" > .env
   ```

## Test Configurations

### 1. No MCP Servers (`no-mcp-test.yml`)
- **Purpose**: Test Saiki with only built-in LLM capabilities (no external tools)
- **Data**: Basic memory storage for sessions
- **Use Case**: Minimal configuration, testing core functionality without dependencies

**Run Test**:
```bash
saiki --agent test-configs/no-mcp-test.yml
```

**Test Scenarios**:
- Verify agent starts without any MCP servers
- Test basic conversation functionality
- Confirm no external tools are available
- Validate minimal configuration requirements

### 2. Memory Storage (`memory-storage-test.yml`)
- **Purpose**: Test basic functionality without persistence
- **Data**: Stored in RAM only, lost on restart
- **Use Case**: Development, testing, temporary sessions

**Run Test**:
```bash
saiki --agent test-configs/memory-storage-test.yml
```

**Test Scenarios**:
- Create sessions and send messages
- Restart agent → verify all data is lost
- Test session cleanup and timeouts

### 3. File Storage (`file-storage-test.yml`)
- **Purpose**: Test persistent file-based storage
- **Data**: Stored in `./test-storage-data/` directory
- **Use Case**: Simple persistence, single-instance deployments

**Run Test**:
```bash
saiki --agent test-configs/file-storage-test.yml
```

**Test Scenarios**:
- Create sessions and messages
- Check files created in `./test-storage-data/`
- Restart agent → verify data persists
- Test backup file creation

### 4. SQLite Storage (`sqlite-storage-test.yml`)
- **Purpose**: Test database-based storage
- **Data**: SQLite database files in `./test-storage-data/`
- **Use Case**: Production deployments, complex queries

**Run Test**:
```bash
saiki --agent test-configs/sqlite-storage-test.yml
```

**Test Scenarios**:
- Create multiple sessions with various message types
- Inspect database with SQLite browser
- Test concurrent access
- Verify data integrity after crashes

### 5. Mixed Storage (`mixed-storage-test.yml`)
- **Purpose**: Demonstrate mixed storage strategies
- **Data**: Different storage types for different data (SQLite + File + Memory)
- **Use Case**: Optimized storage strategy for different data types

**Run Test**:
```bash
saiki --agent test-configs/mixed-storage-test.yml
```

**Test Scenarios**:
- Verify each storage type works correctly
- Test persistence patterns
- Validate performance characteristics

## Storage Configuration Examples

### **Memory Storage** (no files created):
```yaml
storage:
  cache:
    type: "memory"
    # Optional settings:
    # maxSize: 1000
    # ttl: 3600000  # 1 hour
  database:
    type: "memory"
```

### **File Storage** (SQLite database for persistence):
```yaml
storage:
  cache:
    type: "memory"
  database:
    type: "sqlite"
    path: "./data/saiki.db"
```

### **Redis Cache with SQLite Database**:
```yaml
storage:
  cache:
    type: "redis"
    host: "localhost"
    port: 6379
    password: "your_redis_password"  # Optional
    database: 0  # Redis database number
  database:
    type: "sqlite"
    path: "./data/saiki.db"
```

### **Production Setup** (Redis + PostgreSQL):
```yaml
storage:
  cache:
    type: "redis"
    host: "localhost"
    port: 6379
    password: "your_redis_password"
    database: 0
  database:
    type: "postgres"
    host: "localhost"
    port: 5432
    connectionString: "postgresql://user:password@localhost:5432/saiki"
    maxConnections: 20
    idleTimeoutMillis: 30000
    connectionTimeoutMillis: 2000
```

## Manual Testing Workflow

### Basic Functionality Test
1. **Start Agent**:
   ```bash
   saiki --agent test-configs/[config-file].yml
   ```

2. **Create Test Session**:
   ```bash
   # In another terminal
   curl -X POST http://localhost:3000/api/sessions \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "test-session-1"}'
   ```

3. **Send Test Messages**:
   ```bash
   curl -X POST http://localhost:3000/api/sessions/test-session-1/messages \
     -H "Content-Type: application/json" \
     -d '{"content": "Hello, this is a test message", "role": "user"}'
   ```

4. **List Sessions**:
   ```bash
   curl http://localhost:3000/api/sessions
   ```

5. **Get Session History**:
   ```bash
   curl http://localhost:3000/api/sessions/test-session-1/messages
   ```

### Persistence Testing
1. **Create Data**: Follow basic functionality test
2. **Stop Agent**: `Ctrl+C` or kill process
3. **Restart Agent**: Same command as step 1
4. **Verify Data**: Check if sessions and messages persist

### Performance Testing
1. **Create Multiple Sessions**:
   ```bash
   for i in {1..10}; do
     curl -X POST http://localhost:3000/api/sessions \
       -H "Content-Type: application/json" \
       -d "{\"sessionId\": \"test-session-$i\"}"
   done
   ```

2. **Send Bulk Messages**:
   ```bash
   for i in {1..10}; do
     for j in {1..5}; do
       curl -X POST http://localhost:3000/api/sessions/test-session-$i/messages \
         -H "Content-Type: application/json" \
         -d "{\"content\": \"Message $j in session $i\", \"role\": \"user\"}"
     done
   done
   ```

### Error Handling Testing
1. **File Corruption** (File Storage):
   - Corrupt `./test-storage-data/sessions.json`
   - Restart agent and verify recovery

2. **Database Corruption** (SQLite):
   - Corrupt database file
   - Test backup restoration

3. **Disk Space** (File/SQLite):
   - Fill up disk space
   - Verify graceful handling

## Monitoring and Debugging

### Log Files
- **Memory**: Console only
- **File**: `./test-storage-data/agent.log`
- **SQLite**: `./test-storage-data/sqlite-agent.log`

### Data Inspection
- **File Storage**: Check JSON files in `./test-storage-data/`
- **SQLite**: Use SQLite browser or CLI:
  ```bash
  sqlite3 ./test-storage-data/saiki-test.db
  .tables
  .schema sessions
  SELECT * FROM sessions;
  ```

### Performance Monitoring
- Watch file sizes grow
- Monitor memory usage
- Check database query performance

## Cleanup

After testing, clean up test data:
```bash
rm -rf ./test-storage-data/
```

## Common Issues and Solutions

1. **Port Already in Use**: Change port in config or kill existing process
2. **Permission Errors**: Check file/directory permissions
3. **API Key Issues**: Verify `OPENAI_API_KEY` is set correctly
4. **Database Locked**: Ensure no other processes are using SQLite file

## Next Steps

After manual testing, consider:
- Automated integration tests
- Load testing with multiple concurrent users
- Backup/restore procedures
- Migration between storage providers 