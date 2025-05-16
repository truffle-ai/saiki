'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { X, PlusCircle, Server, ListChecks, ChevronRight, RefreshCw, AlertTriangle, ChevronDown, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// --- Interfaces copied/adapted from PlaygroundView.tsx ---
interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: any;
  enum?: Array<string | number | boolean>;
  format?: string;
}

interface JsonSchema {
  type?: 'object';
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface McpServer {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'unknown';
  // other relevant details
}

interface McpTool {
  id: string;
  name: string;
  description?: string;
  inputSchema?: JsonSchema | null;
  // other relevant details
}
// --- End of Interfaces ---

interface ServersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConnectModal: () => void;
  variant?: 'overlay' | 'inline';
}

const API_BASE_URL = '/api'; /**
 * Displays and manages a panel for viewing MCP servers and their available tools.
 *
 * The panel supports both overlay and inline display variants. It fetches the list of servers from the API when opened, allows users to select a server, and displays the tools available on the selected server. The panel provides options to refresh the server list, connect a new server, and access the MCP Playground. It handles loading states, errors, and conditional rendering based on server connection status and user interaction.
 *
 * @param isOpen - Whether the panel is visible.
 * @param onClose - Callback to close the panel.
 * @param onOpenConnectModal - Callback to open the modal for connecting a new server.
 * @param variant - Display variant, either 'overlay' or 'inline' (defaults to 'overlay').
 *
 * @returns The rendered servers panel UI, or null if not open in overlay mode.
 *
 * @remark
 * The component automatically selects the first connected server (if any) when the panel opens, or the first server if none are connected. Tools are only fetched for connected servers.
 */

export default function ServersPanel({ isOpen, onClose, onOpenConnectModal, variant = 'overlay' }: ServersPanelProps) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(false);
  const [isLoadingTools, setIsLoadingTools] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [isToolsExpanded, setIsToolsExpanded] = useState(false); // State for tools section collapse

  const handleError = (message: string, area: 'servers' | 'tools') => {
    console.error(`ServersPanel Error (${area}):`, message);
    if (area === 'servers') setServerError(message);
    if (area === 'tools') setToolsError(message);
  };

  const fetchServers = useCallback(async () => {
    setIsLoadingServers(true);
    setServerError(null);
    setServers([]); // Clear existing servers
    setSelectedServerId(null); // Reset selected server
    setTools([]); // Clear tools
    setToolsError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/mcp/servers`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch servers' }));
        throw new Error(errorData.message || errorData.error || `Server List: ${response.statusText}`);
      }
      const data = await response.json();
      const fetchedServers = data.servers || [];
      setServers(fetchedServers);
      if (fetchedServers.length > 0) {
        // Auto-select the first connected server if available
        const firstConnected = fetchedServers.find((s: McpServer) => s.status === 'connected');
        if (firstConnected) {
          setSelectedServerId(firstConnected.id);
        } else if (fetchedServers.length > 0) {
          setSelectedServerId(fetchedServers[0].id); // Select first server if none are connected
        }
      } else {
        console.log("No MCP servers found or returned from API.");
      }
    } catch (err: any) {
      handleError(err.message, 'servers');
    } finally {
      setIsLoadingServers(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) { // Fetch servers when panel becomes visible
      fetchServers();
    }
  }, [isOpen, fetchServers]);

  const handleServerSelect = useCallback(async (serverId: string, isNewSelection: boolean) => {
    setSelectedServerId(serverId);
    if (isNewSelection) { // Only expand if it's a genuinely new server selection
      setIsToolsExpanded(true);
    }
    const server = servers.find(s => s.id === serverId);
    setTools([]);
    setToolsError(null);

    if (!server || server.status !== 'connected') {
      console.warn(`Server "${server?.name || serverId}" is not connected or not found. Cannot fetch tools.`);
      // Tools list will be empty, UI should reflect server status
      return;
    }

    setIsLoadingTools(true);
    try {
      const response = await fetch(`${API_BASE_URL}/mcp/servers/${serverId}/tools`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Failed to fetch tools for ${server.name}` }));
        throw new Error(errorData.message || errorData.error || `Tool List (${server.name}): ${response.statusText}`);
      }
      const data = await response.json();
      setTools(data.tools || []);
      if (!data.tools || data.tools.length === 0) {
        console.log(`No tools found for server "${server.name}".`);
      }
    } catch (err: any) {
      handleError(err.message, 'tools');
    } finally {
      setIsLoadingTools(false);
    }
  }, [servers]);
  
  // Effect to fetch tools when selectedServerId changes and is valid
  useEffect(() => {
    if (selectedServerId) {
      handleServerSelect(selectedServerId, true); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [selectedServerId]); 

  const selectedServer = servers.find(s => s.id === selectedServerId);

  // For overlay variant, unmount if not open. Inline variant handles visibility via parent.
  if (variant === 'overlay' && !isOpen) {
    return null;
  }

  // Determine wrapper classes based on variant
  const overlayClass = cn(
    "fixed top-0 right-0 z-40 h-screen w-80 bg-card border-l border-border shadow-xl transition-transform transform flex flex-col",
    isOpen ? "translate-x-0" : "translate-x-full"
  );
  // Simplified for inline: parent div in ChatApp will handle width, border, shadow transitions.
  const inlineClass = cn("h-full w-full flex flex-col bg-card");

  return (
    <aside className={variant === 'overlay' ? overlayClass : inlineClass}>
      {/* Panel Header */}
      <div className="flex items-center justify-between p-3 border-b border-border flex-shrink-0">
        <h2 className="text-lg font-semibold text-card-foreground">Servers & Tools</h2>
        <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" onClick={fetchServers} disabled={isLoadingServers} aria-label="Refresh servers">
                <RefreshCw className={cn("h-4 w-4 text-muted-foreground", isLoadingServers && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
                <X className="h-5 w-5 text-muted-foreground" />
            </Button>
        </div>
      </div>

      {/* Connect New Server Button - Moved to top */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <Button onClick={() => { onClose(); onOpenConnectModal();}} className="w-full py-2.5">
          <PlusCircle className="mr-2 h-4 w-4" />
          Connect New Server
        </Button>
      </div>

      {/* MCP Playground Button - Positioned below Connect New Server */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <Button variant="outline" className="w-full py-2.5" asChild>
          <Link href="/playground">
            <Terminal className="mr-2 h-4 w-4" />
            MCP Playground
          </Link>
        </Button>
      </div>

      {/* Servers List Section */}
      <div className="overflow-y-auto p-3 space-y-2 flex-shrink-0">
        <h3 className="px-1 text-sm font-medium text-muted-foreground mb-1">SERVERS</h3>
        {isLoadingServers && <p className="text-sm text-muted-foreground px-1 py-2">Loading servers...</p>}
        {serverError && !isLoadingServers && (
          <div className="p-2 bg-destructive/10 rounded-md text-destructive text-sm flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0"/> 
            <span><strong>Error:</strong> {serverError}</span>
          </div>
        )}
        {!isLoadingServers && !serverError && servers.length === 0 && (
          <p className="text-sm text-muted-foreground px-1 py-2">No servers available.</p>
        )}
        {servers.map((server) => (
          <Button
            key={server.id}
            variant={selectedServerId === server.id ? 'secondary' : 'ghost'}
            className="w-full justify-start items-center h-10 px-3 text-left"
            onClick={() => {
              const isNewSelection = selectedServerId !== server.id;
              // No need to call handleServerSelect directly here, the useEffect for selectedServerId will trigger it.
              // setSelectedServerId will trigger the useEffect, which calls handleServerSelect.
              // We just need to ensure the isNewSelection logic is robust there or handle expansion here.
              // For simplicity and direct user action: expand here, and effect handles data.
              if (isNewSelection) setIsToolsExpanded(true);
              setSelectedServerId(server.id); 
            }}
          >
            <Server className={cn(
                "h-4 w-4 mr-2.5 flex-shrink-0",
                server.status === 'connected' ? 'text-green-500' :
                server.status === 'disconnected' ? 'text-slate-500' :
                'text-yellow-500'
            )} />
            <span className="flex-1 truncate text-sm font-normal group-hover:font-medium">{server.name}</span>
            {server.status !== 'connected' && <span className='ml-auto text-xs text-muted-foreground/70 normal-case'>({server.status})</span>}
            {selectedServerId === server.id && server.status === 'connected' && <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />}
          </Button>
        ))}
      </div>

      {/* Selected Server Tools Section (conditionally rendered and takes remaining space) */}
      <div className="flex-1 overflow-y-auto p-3 border-t border-border space-y-2 bg-background/20 min-h-0">
        {selectedServer ? (
            <button // Changed h3 to button for clickability and accessibility
                className="w-full flex items-center justify-between px-1 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1" 
                onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                aria-expanded={isToolsExpanded}
                aria-controls="tools-list-section"
            >
                <span>
                    AVAILABLE TOOLS <span className="font-semibold">({selectedServer.name})</span>
                </span>
                <ChevronDown className={cn("h-5 w-5 transition-transform", isToolsExpanded && "rotate-180")} />
            </button>
        ) : (
            <p className="text-sm text-muted-foreground px-1 py-10 text-center">Select a server to view its tools.</p>
        )}
        
        {selectedServer && selectedServer.status !== 'connected' && !isToolsExpanded && (
            // Show a brief non-expanded message if server is not connected
            <p className="px-1 text-xs text-amber-700 dark:text-amber-500">Server not connected. Expand to see details.</p>
        )}

        {/* Collapsible content area for tools */}
        {isToolsExpanded && (
            <div id="tools-list-section" className="mt-2 space-y-2">
                {selectedServer && selectedServer.status !== 'connected' && (
                    <div className="p-2 bg-amber-500/10 rounded-md text-amber-700 dark:text-amber-400 text-sm flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0"/> 
                        <span>Server "{selectedServer.name}" is {selectedServer.status}. Tools may be unavailable or outdated.</span>
                    </div>
                )}

                {isLoadingTools && selectedServer?.status === 'connected' && (
                    <p className="text-sm text-muted-foreground px-1 py-2">Loading tools for {selectedServer.name}...</p>
                )}

                {toolsError && !isLoadingTools && selectedServer?.status === 'connected' && (
                    <div className="p-2 bg-destructive/10 rounded-md text-destructive text-sm flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0"/> 
                        <span><strong>Error loading tools:</strong> {toolsError}</span>
                    </div>
                )}

                {selectedServer && selectedServer.status === 'connected' && !isLoadingTools && !toolsError && tools.length === 0 && (
                  <p className="text-sm text-muted-foreground px-1 py-2">No tools available for {selectedServer.name}.</p>
                )}

                {selectedServer && selectedServer.status === 'connected' && !isLoadingTools && tools.length > 0 && (
                  tools.map((tool) => (
                    <div 
                      key={tool.id} 
                      className="p-3 rounded-md bg-card hover:bg-muted/60 border border-border/80 hover:border-border cursor-default shadow-sm transition-all duration-150 hover:shadow-md"
                    >
                      <div className="flex items-center">
                        <ListChecks className="h-4 w-4 mr-2.5 text-primary flex-shrink-0" />
                        <p className="text-sm font-medium text-card-foreground truncate">{tool.name}</p>
                      </div>
                      {tool.description && 
                        <p className="text-xs text-muted-foreground mt-1 ml-[26px] leading-relaxed">{tool.description}</p>
                      }
                    </div>
                  ))
                )}
            </div>
        )}
      </div>
    </aside>
  );
} 