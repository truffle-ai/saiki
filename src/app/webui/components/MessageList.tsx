'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from "@/lib/utils";
import { Message, TextPart, ImagePart } from './hooks/useChat';
import { User, Bot, ChevronsRight, ChevronUp, Loader2, CheckCircle, ChevronRight, Wrench } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
}

// Helper to format timestamp (assuming msg.id is a timestamp or can be parsed as one)
const formatTimestamp = (id: string) => {
  const date = new Date(parseInt(id));
  if (isNaN(date.getTime())) { // If id is not a parsable number for a timestamp
    // Fallback for non-timestamp IDs or if parsing fails.
    // You might want a more robust way to handle various ID formats if they aren't all timestamps.
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/****
 * Renders a scrollable list of chat messages with dynamic styling, avatars, timestamps, and expandable tool call/result details.
 *
 * Displays user, AI, system, and tool messages with appropriate formatting and supports inline images and complex tool outputs. Automatically scrolls to the latest message when new messages arrive. Shows a prompt when the message list is empty.
 *
 * @param messages - Array of chat messages to display.
 */
export default function MessageList({ messages }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const [manuallyExpanded, setManuallyExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
        <ChevronsRight className="w-16 h-16 mb-4 text-primary" />
        <p className="text-lg font-medium">Start a conversation</p>
        <p className="text-sm">Send a message to begin interacting with the AI.</p>
      </div>
    );
  }

  return (
    <div id="message-list-container" className="flex flex-col space-y-3 px-4 py-2">
      {messages.map((msg, idx) => {
        const msgKey = msg.id ?? `msg-${idx}`;
        const isUser = msg.role === 'user';
        const isAi = msg.role === 'ai';
        const isSystem = msg.role === 'system';

        const isLastMessage = idx === messages.length - 1;
        const isToolCall = !!(msg.toolName && msg.toolArgs);
        const isToolResult = !!(msg.toolName && msg.toolResult);
        const isToolRelated = isToolCall || isToolResult;

        const isExpanded = (isToolRelated && isLastMessage) || !!manuallyExpanded[msg.id];

        const toggleManualExpansion = () => {
          if (isToolRelated) {
            setManuallyExpanded(prev => ({
              ...prev,
              [msg.id]: !prev[msg.id]
            }));
          }
        };

        const showAvatar = isUser || isAi;
        const AvatarComponent = isUser ? User : Bot;

        const messageContainerClass = cn(
          "flex items-end w-full",
          isUser ? "justify-end" : "justify-start",
          isSystem && "justify-center"
        );

        // Bubble styling: users and AI are speech bubbles; tools are full-width transient blocks
        const bubbleSpecificClass = cn(
          msg.role === 'tool'
            ? "w-full text-muted-foreground/70 bg-secondary border border-muted/30 rounded-md text-sm"
            : isUser
            ? "p-3 rounded-xl shadow-sm max-w-[75%] bg-primary text-primary-foreground rounded-br-none text-sm"
            : isAi
            ? "p-3 rounded-xl shadow-sm max-w-[75%] bg-card text-card-foreground border border-border rounded-bl-none text-sm"
            : isSystem
            ? "p-3 shadow-none w-full bg-transparent text-xs text-muted-foreground italic text-center border-none"
            : "",
        );

        const contentWrapperClass = "flex flex-col gap-2";
        const timestampStr = formatTimestamp(msg.id);

        return (
          <div key={msgKey} className={messageContainerClass}>
            {isAi && <AvatarComponent className="h-7 w-7 mr-2 mb-1 text-muted-foreground self-start flex-shrink-0" />}
            {msg.role === 'tool' && <Wrench className="h-7 w-7 p-1 mr-3 mt-1 rounded-full border border-border text-muted-foreground self-start flex-shrink-0" />}
            
            <div className={cn("flex flex-col", isUser ? "items-end" : "items-start", isSystem && "w-full items-center")}>
              <div className={bubbleSpecificClass}>
                <div className={contentWrapperClass}>
                  {msg.toolName ? (
                    <div className="p-2 rounded border border-border bg-muted/30 hover:bg-muted/60 cursor-pointer w-full" onClick={toggleManualExpansion}>
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="flex items-center">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 mr-2 text-primary" />
                          ) : (
                            <ChevronRight className="h-4 w-4 mr-2 text-primary" />
                          )}
                          Tool: {msg.toolName}
                        </span>
                        {msg.toolResult ? (
                          <CheckCircle className="mx-2 h-4 w-4 text-green-500" />
                        ) : (
                          <Loader2 className="mx-2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {isExpanded && (
                        <div className="mt-2 space-y-2">
                          <div>
                            <p className="text-xs font-medium">Arguments:</p>
                            <pre className="whitespace-pre-wrap overflow-auto bg-background/50 p-2 rounded text-xs text-muted-foreground">
                              {JSON.stringify(msg.toolArgs, null, 2)}
                            </pre>
                          </div>
                          {msg.toolResult && (
                            <div>
                              <p className="text-xs font-medium">Result:</p>
                              {Array.isArray((msg.toolResult as any).content) ? (
                                (msg.toolResult as any).content.map((part: any, index: number) => {
                                  if (part.type === 'image') {
                                    const src = part.data && part.mimeType
                                      ? `data:${part.mimeType};base64,${part.data}`
                                      : part.image || part.url;
                                    return (
                                      <img key={index} src={src} alt="Tool result image" className="my-1 max-h-48 w-auto rounded border border-border" />
                                    );
                                  }
                                  return (
                                    <pre key={index} className="whitespace-pre-wrap overflow-auto bg-background/50 p-2 rounded text-xs text-muted-foreground my-1">
                                      {typeof part === 'object' ? JSON.stringify(part, null, 2) : String(part)}
                                    </pre>
                                  );
                                })
                              ) : typeof msg.toolResult === 'string' && msg.toolResult.startsWith('data:image') ? (
                                <img src={msg.toolResult} alt="Tool result image" className="my-1 max-h-48 w-auto rounded border border-border" />
                              ) : (
                                <pre className="whitespace-pre-wrap overflow-auto bg-background/50 p-2 rounded text-xs text-muted-foreground">
                                  {typeof msg.toolResult === 'object' ? JSON.stringify(msg.toolResult, null, 2) : String(msg.toolResult)}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {typeof msg.content === 'string' && msg.content.trim() !== '' && (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                      {Array.isArray(msg.content) && msg.content.map((part, partIdx) => {
                        const partKey = `${msgKey}-part-${partIdx}`;
                        if (part.type === 'text') {
                          return <p key={partKey} className="whitespace-pre-wrap">{(part as TextPart).text}</p>;
                        }
                        if (part.type === 'image' && 'base64' in part && 'mimeType' in part) {
                          return (
                            <img
                              key={partKey}
                              src={`data:${(part as ImagePart).mimeType};base64,${(part as ImagePart).base64}`}
                              alt="attachment"
                              className="my-2 max-h-60 w-full rounded-lg border border-border object-contain"
                            />
                          );
                        }
                        return null;
                      })}
                      {isSystem && !msg.content && (
                        <p className="italic">System message</p>
                      )}
                    </>
                  )}
                  {msg.imageData && !Array.isArray(msg.content) && (
                    <img
                      src={`data:${msg.imageData.mimeType};base64,${msg.imageData.base64}`}
                      alt="attachment"
                      className="mt-2 max-h-60 w-full rounded-lg border border-border object-contain"
                    />
                  )}
                </div>
              </div>
              {!isSystem && !isToolRelated && (
                <p className="text-xs text-muted-foreground mt-1 px-1">
                  {timestampStr}
                </p>
              )}
            </div>
            {isUser && <AvatarComponent className="h-7 w-7 ml-2 mb-1 text-muted-foreground self-start flex-shrink-0" />}
          </div>
        );
      })}
      <div key="end-anchor" ref={endRef} className="h-px" />
    </div>
  );
} 