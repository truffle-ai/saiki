'use client';

import React, { useState, useCallback } from 'react';
import { useChat, Message } from './hooks/useChat';
import MessageList from './MessageList';
import InputArea from './InputArea';
import ConnectServerModal from './ConnectServerModal';
import ServersPanel from './ServersPanel';
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, Server, Download } from "lucide-react";
import { cn } from '@/lib/utils';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';

/**
 * Renders the main chat application interface with WebSocket communication, server management, and configuration export features.
 *
 * Provides a chat area with real-time messaging, a collapsible servers panel, and dialogs for connecting to servers and exporting configuration as YAML. The WebSocket URL is dynamically determined for network accessibility.
 *
 * @remark
 * If the WebSocket URL uses 'localhost', it is replaced with the current browser hostname to support networked access. Exporting configuration triggers a client-side download of the YAML file fetched from the server.
 */
export default function ChatApp() {
  // Determine WebSocket URL; replace localhost with actual host for network access
  let wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
  if (typeof window !== 'undefined') {
    try {
      const urlObj = new URL(wsUrl);
      if (urlObj.hostname === 'localhost') {
        urlObj.hostname = window.location.hostname;
        wsUrl = urlObj.toString();
      }
    } catch (e) {
      console.warn('Invalid WS URL:', wsUrl);
    }
  }
  const { messages, sendMessage } = useChat(wsUrl);

  const [isModalOpen, setModalOpen] = useState(false);
  const [isServersPanelOpen, setServersPanelOpen] = useState(false);
  const [isExportOpen, setExportOpen] = useState(false);
  const [exportName, setExportName] = useState('saiki-config');

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
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [exportName]);

  const handleSend = useCallback((content: string, imageData?: { base64: string; mimeType: string }) => {
    sendMessage(content, imageData);
  }, [sendMessage]);

  return (
    <div className="flex h-screen bg-background">
      <main className="flex-1 flex flex-col relative">
        <header className="flex justify-end items-center p-4 border-b border-border bg-background z-10">
          <Button variant="outline" onClick={() => setServersPanelOpen(open => !open)} className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span>Servers</span>
            {isServersPanelOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          {/* Export Config Dialog */}
          <Dialog open={isExportOpen} onOpenChange={setExportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2 ml-2">
                <Download className="h-4 w-4" />
                <span>Export</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Configuration</DialogTitle>
                <DialogDescription>Download the current config and servers as YAML.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="exportName">Filename</Label>
                <Input id="exportName" value={exportName} onChange={(e) => setExportName(e.target.value)} />
              </div>
              <DialogFooter>
                <Button onClick={handleDownload}>Download YAML</Button>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <MessageList messages={messages} />
        </div>
        <div className="p-4 border-t border-border">
          <InputArea onSend={handleSend} />
        </div>
        <ConnectServerModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} />
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