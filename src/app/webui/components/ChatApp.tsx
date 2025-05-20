'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useChatContext } from './hooks/ChatContext';
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
import { Textarea } from './ui/textarea';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';

export default function ChatApp() {
  const { messages, sendMessage } = useChatContext();

  const [isModalOpen, setModalOpen] = useState(false);
  const [isServersPanelOpen, setServersPanelOpen] = useState(false);
  const [isExportOpen, setExportOpen] = useState(false);
  const [exportName, setExportName] = useState('saiki-config');
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportContent, setExportContent] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

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

  return (
    <div className="flex h-screen bg-background">
      <main className="flex-1 flex flex-col relative">
        <header className="flex justify-between items-center p-4 border-b border-border bg-background z-10">
          <div className="flex items-center space-x-1">
            <img src="/logo.png" alt="Saiki Logo" className="mt-1 h-7 w-7" />
            <span className="font-semibold text-xl">Saiki</span>
          </div>
          <div className="flex items-center">
            <Button variant="outline" onClick={() => setServersPanelOpen(open => !open)} className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <span>Servers</span>
              {isServersPanelOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
            <Dialog open={isExportOpen} onOpenChange={setExportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center space-x-2 ml-2">
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Export Agent Configuration</DialogTitle>
                  <DialogDescription>
                    Download your current Saiki agent configuration, including connected servers and model settings, to a YAML file.
                    This file can be used to run the same agent setup via the CLI or share it with others.
                  </DialogDescription>
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
          <MessageList messages={messages} />
        </div>
        <div className="p-4 border-t border-border">
          <InputArea onSend={handleSend} isSending={isSendingMessage} />
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