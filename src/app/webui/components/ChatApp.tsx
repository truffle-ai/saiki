'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useChatContext } from './hooks/ChatContext';
import MessageList from './MessageList';
import InputArea from './InputArea';
import ConnectServerModal from './ConnectServerModal';
import ServersPanel from './ServersPanel';
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, Server, Download, Wrench, History, Keyboard } from "lucide-react";
import { cn } from '@/lib/utils';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
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

  return (
    <div className="flex h-screen bg-background">
      <main className="flex-1 flex flex-col relative">
        <header className="flex justify-between items-center p-4 border-b border-border bg-background z-10">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <img src="/logo.png" alt="Saiki Logo" className="mt-1 h-7 w-7" />
              <span className="font-semibold text-xl">Saiki</span>
            </div>
            {/* Session Info */}
            <div className="hidden sm:flex items-center space-x-2 text-sm text-muted-foreground">
              <History className="h-3 w-3" />
              <span>{formatSessionDuration()}</span>
              {messageCount > 0 && (
                <>
                  <span>•</span>
                  <Badge variant="secondary" className="text-xs">
                    {messageCount} messages
                  </Badge>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Quick Access to Playground */}
            <Button variant="ghost" size="sm" asChild className="hidden md:flex">
              <Link href="/playground" title="Open Playground (Ctrl+P)">
                <Wrench className="h-4 w-4 mr-2" />
                <span>Playground</span>
              </Link>
            </Button>

            {/* LLM Model Selector */}
            <LLMSelector />

            {/* Keyboard Shortcuts */}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowShortcuts(true)}
              className="hidden sm:flex"
              title="Keyboard Shortcuts (Ctrl+/)"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setServersPanelOpen(open => !open)} 
              className="flex items-center space-x-2"
              title="Toggle Servers Panel (Ctrl+K)"
            >
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline">Servers</span>
              {isServersPanelOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            
            <Dialog open={isExportOpen} onOpenChange={setExportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center space-x-2" title="Export Configuration (Ctrl+E)">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Export Configuration</DialogTitle>
                  <DialogDescription>Download the current config and servers as YAML.</DialogDescription>
                </DialogHeader>
                {exportError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{exportError}</AlertDescription>
                  </Alert>
                )}
                {copySuccess && (
                  <Alert className="mb-4">
                    <AlertTitle>Copied to clipboard</AlertTitle>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="exportName">Filename</Label>
                  <Input id="exportName" value={exportName} onChange={(e) => setExportName(e.target.value)} />
                </div>
                {exportContent && (
                  <div className="mt-4">
                    <Label className='mb-2'>Preview</Label>
                    <Textarea readOnly value={exportContent} className="font-mono text-xs" rows={10} />
                  </div>
                )}
                <DialogFooter>
                  <Button onClick={handleDownload}>Download YAML</Button>
                  <Button variant="outline" onClick={handleCopy}>Copy YAML</Button>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messageCount === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-xl w-full px-4">
                <div className="mb-6">
                  <img src="/logo.png" alt="Saiki Logo" className="h-16 w-16 mx-auto opacity-50" />
                </div>
                <h3 className="text-2xl font-semibold mb-2">Welcome to Saiki</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Your AI Agent development playground. Start chatting or connect MCP servers to expand capabilities.
                </p>
                
                {/* Quick Actions */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10 max-w-6xl mx-auto">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={action.action}
                      className="flex flex-col items-center gap-3 p-4 bg-card border border-border rounded-xl hover:shadow-lg hover:border-primary/30 transition-all text-center group"
                    >
                      <div className="text-3xl">{action.icon}</div>
                      <div>
                        <h4 className="font-semibold text-sm group-hover:text-primary mb-1">{action.title}</h4>
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="outline" size="sm" onClick={() => setServersPanelOpen(true)}>
                    <Server className="h-4 w-4 mr-2" />
                    Connect Servers
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/playground">
                      <Wrench className="h-4 w-4 mr-2" />
                      Try Playground
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
          <MessageList messages={messages} />
        </div>
        
        <div className="p-4 border-t border-border">
          <InputArea onSend={handleSend} isSending={isSendingMessage} />
        </div>
        <ConnectServerModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} />

        {/* Keyboard Shortcuts Dialog */}
        <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Keyboard className="h-5 w-5" />
                Keyboard Shortcuts
              </DialogTitle>
              <DialogDescription>Speed up your workflow with these shortcuts</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm">Toggle Servers Panel</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + K
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm">Open Playground</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + P
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm">Export Configuration</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + E
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm">Show Shortcuts</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + /
                </Badge>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm">Close Panels</span>
                <Badge variant="secondary" className="font-mono text-xs">Escape</Badge>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Got it</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <div className={cn(
        "h-full flex-shrink-0 transition-all duration-300 ease-in-out",
        isServersPanelOpen ? "w-80 border-l border-border shadow-xl" : "w-0 border-none shadow-none",
        "overflow-hidden"
      )}>
        <ServersPanel
          isOpen={isServersPanelOpen}
          variant="inline"
          onClose={() => setServersPanelOpen(false)}
          onOpenConnectModal={() => setModalOpen(true)}
        />
      </div>
    </div>
  );
} 