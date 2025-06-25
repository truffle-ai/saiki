'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { AlertTriangle, Wrench, Clock } from 'lucide-react';

interface ToolConfirmationEvent {
    executionId: string;
    toolName: string;
    args: any;
    description?: string;
    timestamp: Date;
}

interface ToolConfirmationHandlerProps {
    websocket?: WebSocket | null;
}

/**
 * WebUI component for handling tool confirmation requests
 * Displays confirmation dialogs and sends responses back through WebSocket
 */
export function ToolConfirmationHandler({ websocket }: ToolConfirmationHandlerProps) {
    const [pendingConfirmation, setPendingConfirmation] = useState<ToolConfirmationEvent | null>(null);
    const [rememberChoice, setRememberChoice] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Handle incoming WebSocket messages
    useEffect(() => {
        if (!websocket) return;

        const handleMessage = (event: MessageEvent) => {
            try {
                const message = JSON.parse(event.data);
                
                if (message.event === 'toolConfirmationRequest') {
                    const confirmationEvent: ToolConfirmationEvent = {
                        ...message.data,
                        timestamp: new Date(message.data.timestamp)
                    };
                    
                    setPendingConfirmation(confirmationEvent);
                    setIsDialogOpen(true);
                    setRememberChoice(false);
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        websocket.addEventListener('message', handleMessage);
        
        return () => {
            websocket.removeEventListener('message', handleMessage);
        };
    }, [websocket]);

    // Send confirmation response
    const sendResponse = useCallback((approved: boolean) => {
        if (!pendingConfirmation || !websocket) return;

        const response = {
            type: 'toolConfirmationResponse',
            data: {
                executionId: pendingConfirmation.executionId,
                approved,
                rememberChoice,
            }
        };

        websocket.send(JSON.stringify(response));
        
        // Close dialog and reset state
        setIsDialogOpen(false);
        setPendingConfirmation(null);
        setRememberChoice(false);
    }, [pendingConfirmation, rememberChoice, websocket]);

    const handleApprove = () => sendResponse(true);
    const handleDeny = () => sendResponse(false);

    // Format arguments for display
    const formatArgs = (args: any): string => {
        if (!args) return 'No arguments';
        
        try {
            return JSON.stringify(args, null, 2);
        } catch {
            return String(args);
        }
    };

    // Auto-close dialog after timeout (optional safety feature)
    useEffect(() => {
        if (!isDialogOpen) return;

        const timeout = setTimeout(() => {
            // Auto-deny after 2 minutes for security
            sendResponse(false);
        }, 120000);

        return () => clearTimeout(timeout);
    }, [isDialogOpen, sendResponse]);

    if (!pendingConfirmation) return null;

    return (
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!open) {
                // If user closes dialog without responding, default to deny
                sendResponse(false);
            }
        }}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        Tool Execution Confirmation
                    </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Tool:</span>
                        <Badge variant="outline">{pendingConfirmation.toolName}</Badge>
                    </div>

                    {pendingConfirmation.description && (
                        <div>
                            <span className="font-medium">Description:</span>
                            <p className="text-sm text-gray-600 mt-1">{pendingConfirmation.description}</p>
                        </div>
                    )}

                    <div>
                        <span className="font-medium">Arguments:</span>
                        <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-auto max-h-48 mt-1">
                            {formatArgs(pendingConfirmation.args)}
                        </pre>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        <span>Requested at: {pendingConfirmation.timestamp.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="remember" 
                            checked={rememberChoice}
                            onCheckedChange={(checked) => setRememberChoice(checked === true)}
                        />
                        <label 
                            htmlFor="remember" 
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Remember this choice for future executions of this tool
                        </label>
                    </div>

                    <div className="bg-yellow-50 p-3 rounded-md">
                        <p className="text-sm text-yellow-800">
                            <strong>Security Notice:</strong> Only approve tools you trust. 
                            Tools can access your system and data according to their permissions.
                        </p>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button 
                        variant="outline" 
                        onClick={handleDeny}
                        className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                    >
                        Deny
                    </Button>
                    <Button 
                        onClick={handleApprove}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        Approve
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}