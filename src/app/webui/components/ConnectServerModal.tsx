'use client';

import React, { useState, useEffect } from 'react';
import { McpServerConfig } from '../../../core/config/schemas.js';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConnectServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConnectServerModal({ isOpen, onClose }: ConnectServerModalProps) {
  const [serverName, setServerName] = useState('');
  const [serverType, setServerType] = useState<'stdio' | 'sse'>('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
          setServerName('');
          setServerType('stdio');
          setCommand('');
          setArgs('');
          setUrl('');
          setError(null);
          setIsSubmitting(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!serverName.trim()) {
      setError('Server name is required.');
      setIsSubmitting(false);
      return;
    }

    let config: McpServerConfig;
    if (serverType === 'stdio') {
      if (!command.trim()) {
        setError('Command is required for stdio servers.');
        setIsSubmitting(false);
        return;
      }
      config = {
        type: 'stdio',
        command: command.trim(),
        args: args.split(',').map(s => s.trim()).filter(Boolean),
        env: {},
        timeout: 30000,
      };
    } else {
      if (!url.trim()) {
        setError('URL is required for SSE servers.');
        setIsSubmitting(false);
        return;
      }
      try {
        new URL(url.trim());
      } catch (_) {
        setError('Invalid URL format for SSE server.');
        setIsSubmitting(false);
        return;
      }
      config = {
        type: 'sse',
        url: url.trim(),
        headers: {},
        timeout: 30000,
      };
    }

    try {
      const res = await fetch('/api/connect-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: serverName.trim(), config }),
      });
      const result = await res.json();
      if (!res.ok) {
        // Server returned error JSON in { error: string }
        setError(result.error || `Server returned status ${res.status}`);
        setIsSubmitting(false);
        return;
      }
      console.log('Connect server response:', result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to connect server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Connect New MCP Server</DialogTitle>
          <DialogDescription>
            Configure connection details for a new managed client process.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="serverName" className="text-right">
              Server Name
            </Label>
            <Input
              id="serverName"
              value={serverName}
              onChange={e => setServerName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., My Local Agent"
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="serverType" className="text-right">
              Server Type
            </Label>
            <Select
                value={serverType}
                onValueChange={(value: 'stdio' | 'sse') => setServerType(value)}
                disabled={isSubmitting}
            >
                <SelectTrigger id="serverType" className="col-span-3">
                    <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="stdio">stdio</SelectItem>
                    <SelectItem value="sse">sse</SelectItem>
                </SelectContent>
            </Select>
          </div>

          {serverType === 'stdio' ? (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="command" className="text-right">
                  Command
                </Label>
                <Input
                  id="command"
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., /path/to/executable or python"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="args" className="text-right">
                  Arguments
                </Label>
                <Input
                  id="args"
                  value={args}
                  onChange={e => setArgs(e.target.value)}
                  className="col-span-3"
                  placeholder="Comma-separated, e.g., -m,script.py,--port,8080"
                  disabled={isSubmitting}
                />
              </div>
            </>
          ) : (
             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="url" className="text-right">
                  URL
                </Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., http://localhost:8000/events"
                  required
                  disabled={isSubmitting}
                />
              </div>
          )}
        </form>
         <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
            </DialogClose>
            <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Connecting..." : "Connect"}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 