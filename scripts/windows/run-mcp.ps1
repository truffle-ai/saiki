# MCP Host and Client CLI Tool Runner
function Show-Menu {
    Clear-Host
    Write-Host "MCP Host and Client CLI Tool Runner" -ForegroundColor Cyan
    Write-Host "===================================" -ForegroundColor Cyan
    Write-Host
    Write-Host "Choose an option:"
    Write-Host "1. Start MCP Host (stdio transport)"
    Write-Host "2. Start MCP Host (SSE transport on port 3001)"
    Write-Host "3. Connect to MCP Host with Client (stdio)"
    Write-Host "4. Connect to MCP Host with Client (SSE)"
    Write-Host "5. Start Multi-Server Client Interface"
    Write-Host "6. Rebuild Project"
    Write-Host "7. Exit"
    Write-Host
}

function Check-Dependencies {
    # Check if npm is installed
    try {
        $npmVersion = npm --version
        Write-Host "npm version $npmVersion found."
    }
    catch {
        Write-Host "Error: npm is not installed or not in the PATH." -ForegroundColor Red
        Write-Host "Please install Node.js and npm before running this script."
        Read-Host "Press Enter to exit"
        exit 1
    }

    # Check if the project is built
    if (-not (Test-Path "dist")) {
        Write-Host "Building the project..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Failed to install dependencies." -ForegroundColor Red
            Read-Host "Press Enter to continue"
            return
        }
        
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Failed to build the project." -ForegroundColor Red
            Read-Host "Press Enter to continue"
            return
        }
        Write-Host "Project built successfully." -ForegroundColor Green
        Write-Host
    }
}

function Start-StdioHost {
    Write-Host "Starting MCP Host with stdio transport in a new window..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-Command `"cd '$PWD'; node dist/host.js stdio; Read-Host 'Press Enter to exit'`""
    Start-Sleep -Seconds 2
}

function Start-SSEHost {
    Write-Host "Starting MCP Host with SSE transport in a new window on port 3001..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-Command `"cd '$PWD'; node dist/host.js sse; Read-Host 'Press Enter to exit'`""
    Start-Sleep -Seconds 2
}

function Start-StdioClient {
    Write-Host "Starting MCP Client with stdio transport in a new window..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-Command `"cd '$PWD'; node dist/client.js stdio 'node dist/host.js stdio'; Read-Host 'Press Enter to exit'`""
    Start-Sleep -Seconds 2
}

function Start-SSEClient {
    Write-Host "Starting MCP Client with SSE transport in a new window..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-Command `"cd '$PWD'; node dist/client.js sse http://localhost:3001; Read-Host 'Press Enter to exit'`""
    Start-Sleep -Seconds 2
}

function Start-MultiClient {
    Write-Host "Starting Multi-Server Client Interface in a new window..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-Command `"cd '$PWD'; node dist/client.js multi; Read-Host 'Press Enter to exit'`""
    Start-Sleep -Seconds 2
}

function Rebuild-Project {
    Write-Host "Rebuilding the project..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to build the project." -ForegroundColor Red
    }
    else {
        Write-Host "Project rebuilt successfully." -ForegroundColor Green
    }
    Read-Host "Press Enter to continue"
}

# Main script
Check-Dependencies

do {
    Show-Menu
    $choice = Read-Host "Enter your choice (1-7)"
    
    switch ($choice) {
        "1" { Start-StdioHost }
        "2" { Start-SSEHost }
        "3" { Start-StdioClient }
        "4" { Start-SSEClient }
        "5" { Start-MultiClient }
        "6" { Rebuild-Project }
        "7" { 
            Write-Host "Exiting..." -ForegroundColor Yellow
            exit 0 
        }
        default { 
            Write-Host "Invalid choice. Please try again." -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
} while ($true)
