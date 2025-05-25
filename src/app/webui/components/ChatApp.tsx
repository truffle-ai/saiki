'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useChatContext } from './hooks/ChatContext';
import MessageList from './MessageList';
import InputArea from './InputArea';
import ConnectServerModal from './ConnectServerModal';
import ServersPanel from './ServersPanel';
import { Button } from "./ui/button";
import { Server, Download, Wrench, Keyboard, AlertTriangle } from "lucide-react";
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import LLMSelector from './LLMSelector';
import Link from 'next/link';

export default function ChatApp() {
  const { messages, sendMessage } = useChatContext();

  const [isModalOpen, setModalOpen] = useState(false);
  const [isServersPanelOpen, setServersPanelOpen] = useState(false);
  const [isExportOpen, setExportOpen] = useState(false);
  const [exportName, setExportName] = useState('saiki-config');
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportContent, setExportContent] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Enhanced features
  const [messageCount, setMessageCount] = useState(0);
  const [sessionStartTime] = useState(Date.now());
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    setMessageCount(messages.length);
  }, [messages]);

  useEffect(() => {
    if (isExportOpen) {
      fetch('/api/config.yaml')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch configuration');
          return res.text();
        })
        .then((text) => {
          setExportContent(text);
          setExportError(null);
        })
        .catch((err) => {
          console.error('Preview fetch failed:', err);
          setExportError(err instanceof Error ? err.message : 'Preview fetch failed');
        });
    } else {
      setExportContent('');
      setExportError(null);
      setCopySuccess(false);
    }
  }, [isExportOpen]);

  const handleDownload = useCallback(async () => {
    try {
      const res = await fetch('/api/config.yaml');
      if (!res.ok) throw new Error('Failed to fetch configuration');
      const yamlText = await res.text();
      const blob = new Blob([yamlText], { type: 'application/x-yaml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${exportName}.yml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportOpen(false);
      setExportError(null);
    } catch (err) {
      console.error('Export failed:', err);
      setExportError(err instanceof Error ? err.message : 'Export failed');
    }
  }, [exportName]);

  const handleCopy = useCallback(async () => {
    try {
      const res = await fetch('/api/config.yaml');
      if (!res.ok) throw new Error('Failed to fetch configuration');
      const yamlText = await res.text();
      await navigator.clipboard.writeText(yamlText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      setExportError(null);
    } catch (err) {
      console.error('Copy failed:', err);
      setExportError(err instanceof Error ? err.message : 'Copy failed');
    }
  }, [setCopySuccess, setExportError]);

  const handleSend = useCallback(async (content: string, imageData?: { base64: string; mimeType: string }) => {
    setIsSendingMessage(true);
    try {
      await sendMessage(content, imageData);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSendingMessage(false);
    }
  }, [sendMessage]);

  const formatSessionDuration = () => {
    const duration = Date.now() - sessionStartTime;
    const minutes = Math.floor(duration / 60000);
    return minutes > 0 ? `${minutes}m` : 'Just started';
  };

  const quickActions = [
    {
      title: "What Can You Do?",
      description: "See your capabilities",
      action: () => handleSend("What tools and skills do you have? What kinds of tasks can you help me with?"),
      icon: "🤔"
    },
    {
      title: "Create Snake Game",
      description: "Build & open in browser",
      action: () => handleSend("Create a snake game in a new directory with HTML, CSS, and JavaScript, then open it in the browser for me to play."),
      icon: "🐍"
    },
    {
      title: "What is Saiki?",
      description: "Learn about this platform",
      action: () => handleSend("Tell me about Saiki. What is it, how does it work, and what makes it special for AI agent development?"),
      icon: "💡"
    },
    {
      title: "Learn MCP",
      description: "Understand protocols",
      action: () => handleSend("Explain how MCP (Model Context Protocol) works and show me practical examples of tool integrations."),
      icon: "📚"
    }
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K to open servers panel
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setServersPanelOpen(prev => !prev);
      }
      // Ctrl/Cmd + P to open playground
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.open('/playground', '_blank');
      }
      // Ctrl/Cmd + E to export config
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setExportOpen(true);
      }
      // Ctrl/Cmd + ? to show shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(true);
      }
      // Escape to close panels
      if (e.key === 'Escape') {
        if (isServersPanelOpen) setServersPanelOpen(false);
        else if (isExportOpen) setExportOpen(false);
        else if (showShortcuts) setShowShortcuts(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isServersPanelOpen, isExportOpen, showShortcuts]);

  return (
    <div className="flex h-screen bg-background">
      <main className="flex-1 flex flex-col relative">
        {/* Simplified Header */}
        <header className="shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="flex justify-between items-center px-4 py-3">
            <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground">
                  <img src="/logo.png" alt="Saiki" className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <h1 className="text-base font-semibold tracking-tight">Saiki</h1>
                  <div className="flex items-center space-x-2">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      "bg-green-500"
                    )}></div>
                    <span className="text-xs text-muted-foreground">Default Session</span>
                  </div>
                </div>
            </div>
              
              {/* Session Status - More Minimal */}
              {messageCount > 0 && (
                <div className="hidden md:flex items-center space-x-2 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <span>{formatSessionDuration()}</span>
                  <span className="text-muted-foreground/50">•</span>
                  <span>{messageCount} msgs</span>
                </div>
              )}
          </div>
          
            {/* Minimal Action Bar */}
            <div className="flex items-center space-x-1">
            <LLMSelector />

            <Button 
              variant="ghost" 
              size="sm" 
                onClick={() => setServersPanelOpen(!isServersPanelOpen)}
                className={cn(
                  "h-8 px-2 text-xs transition-colors",
                  isServersPanelOpen && "bg-muted"
                )}
              >
                <Server className="h-3.5 w-3.5" />
                <span className="hidden sm:inline ml-1.5">Tools</span>
            </Button>
            
            <Button 
                variant="ghost"
                size="sm"
                asChild
                className="h-8 px-2 text-xs"
              >
                <Link href="/playground" target="_blank">
                  <Wrench className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1.5">Play</span>
                </Link>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setExportOpen(true)}
              className="h-8 px-2 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1.5">Export</span>
            </Button>
            
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShortcuts(true)}
                className="h-8 w-8 p-0"
              >
                <Keyboard className="h-3.5 w-3.5" />
                </Button>
                  </div>
          </div>
        </header>
        
        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Content */}
          <div className="flex-1 flex flex-col">
            {messages.length === 0 ? (
              /* Welcome Screen - Clean Design */
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-2xl mx-auto text-center space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary">
                      <img src="/logo.png" alt="Saiki" className="w-8 h-8" />
                </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-semibold tracking-tight">Welcome to Saiki</h2>
                      <p className="text-muted-foreground text-base">
                        Build powerful AI agents with integrated tools and seamless workflows
                      </p>
                    </div>
                  </div>

                  {/* Quick Actions Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={action.action}
                        className="group p-4 text-left rounded-xl border border-border/50 bg-card hover:bg-muted/50 transition-all duration-200 hover:border-border hover:shadow-minimal"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">{action.icon}</span>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm group-hover:text-foreground transition-colors">
                              {action.title}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {action.description}
                            </p>
                          </div>
                      </div>
                    </button>
                  ))}
                </div>
                
                  {/* Quick Tips */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>💡 Try <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘K</kbd> for tools, <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘P</kbd> for playground</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Messages Area */
              <div className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto">
                  <MessageList 
                    messages={messages}
                  />
                </div>
              </div>
            )}
            
            {/* Input Area */}
            <div className="shrink-0 border-t border-border/50 bg-background/80 backdrop-blur-xl">
              <div className="p-4">
                <InputArea
                  onSend={handleSend}
                  isSending={isSendingMessage}
                />
              </div>
            </div>
          </div>

          {/* Servers Panel - Slide Animation */}
          <div className={cn(
            "shrink-0 transition-all duration-300 ease-in-out border-l border-border/50 bg-card",
            isServersPanelOpen ? "w-80" : "w-0 overflow-hidden"
          )}>
            {isServersPanelOpen && (
              <ServersPanel
                isOpen={isServersPanelOpen}
                onClose={() => setServersPanelOpen(false)}
                onOpenConnectModal={() => setModalOpen(true)}
                variant="inline"
              />
            )}
          </div>
        </div>
        
        {/* Connect Server Modal */}
        <ConnectServerModal 
          isOpen={isModalOpen} 
          onClose={() => setModalOpen(false)} 
        />

        {/* Export Configuration Modal */}
        <Dialog open={isExportOpen} onOpenChange={setExportOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Download className="h-5 w-5" />
                <span>Export Configuration</span>
              </DialogTitle>
              <DialogDescription>
                Download your agent configuration for Claude Desktop or other MCP clients
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="filename">File name</Label>
                <Input
                  id="filename"
                  value={exportName}
                  onChange={(e) => setExportName(e.target.value)}
                  placeholder="saiki-config"
                  className="font-mono"
                />
              </div>
              
              {exportError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Export Error</AlertTitle>
                  <AlertDescription>{exportError}</AlertDescription>
                </Alert>
              )}
              
              {exportContent && (
                <div className="space-y-2">
                  <Label>Configuration Preview</Label>
                  <Textarea
                    value={exportContent}
                    readOnly
                    className="h-32 font-mono text-xs bg-muted/30"
                  />
                </div>
              )}
        </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleCopy} className="flex items-center space-x-2">
                <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
              </Button>
              <Button onClick={handleDownload} className="flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Download</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Shortcuts Modal */}
        <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Keyboard className="h-5 w-5" />
                <span>Keyboard Shortcuts</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-3">
              {[
                { key: '⌘ K', desc: 'Toggle tools panel' },
                { key: '⌘ P', desc: 'Open playground' },
                { key: '⌘ E', desc: 'Export config' },
                { key: '⌘ /', desc: 'Show shortcuts' },
                { key: 'Esc', desc: 'Close panels' },
              ].map((shortcut, index) => (
                <div key={index} className="flex justify-between items-center py-1">
                  <span className="text-sm text-muted-foreground">{shortcut.desc}</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {shortcut.key}
                </Badge>
              </div>
              ))}
            </div>
            
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
} 