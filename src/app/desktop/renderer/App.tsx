import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { marked } from 'marked';

// Define the electronAPI type based on your preload script
declare global {
  interface Window {
    electronAPI: {
      sendMessage: (payload: string | { content: string; imageDataInput?: { image: string; mimeType: string } }) => Promise<string | null>;
      resetConversation: () => Promise<void>;
      onConversationReset: (callback: () => void) => () => void;
      setWindowState: (state: 'search' | 'chat') => void;
      onAgentEvent: (callback: (eventData: AgentEventData) => void) => () => void;
      onScreenshotShortcut: (callback: () => void) => () => void;
      captureScreenshot: () => Promise<{ dataUrl: string; mimeType: string }>;
      notifyImagePreviewVisibility: (isVisible: boolean) => void;
      openImagePreviewWindow: (imageDataUrl: string) => void;
      closeImagePreviewWindow: () => void;
    };
  }
}

// Define a unique ID generator for messages if needed for specific updates
let messageIdCounter = 0;
const nextMessageId = () => `msg-${messageIdCounter++}`;

// New Message Types
interface BaseMessage {
  id: string;
  sender: 'user' | 'agent';
}

interface UserMessage extends BaseMessage {
  type: 'user';
  text: string;
  imageData?: { dataUrl: string; mimeType: string };
}

interface AgentTextMessage extends BaseMessage {
  type: 'agent-text';
  text: string;
}

interface AgentThinkingMessage extends BaseMessage {
  type: 'agent-thinking';
}

interface AgentToolCallMessage extends BaseMessage {
  type: 'agent-tool-call';
  toolName: string;
  args: any;
}

interface AgentToolResultMessage extends BaseMessage {
  type: 'agent-tool-result';
  toolName: string;
  result: any;
  status?: 'success' | 'error'; // Optional: to indicate if tool execution was successful
}

interface AgentErrorMessage extends BaseMessage {
  type: 'agent-error';
  error: string;
}

type ChatMessage =
  | UserMessage
  | AgentTextMessage
  | AgentThinkingMessage
  | AgentToolCallMessage
  | AgentToolResultMessage
  | AgentErrorMessage;

// Agent Event Data from main process
type AgentEventData =
  | { type: 'thinking' }
  | { type: 'response'; text: string }
  | { type: 'toolCall'; toolName: string; args: any }
  | { type: 'toolResult'; toolName: string; result: any }
  | { type: 'error'; message: string };

// Utility function to separate URLs and text content
interface SeparatedContent {
  links: string[];
  textContent: string;
}

const separateLinksAndText = (text: string): SeparatedContent => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const collectedLinks: string[] = [];
  let match;

  // First, collect all link occurrences using a fresh regex object for exec loop
  const linkCollectionRegex = new RegExp(urlRegex);
  while ((match = linkCollectionRegex.exec(text)) !== null) {
    collectedLinks.push(match[0]);
  }

  if (collectedLinks.length === 0) {
    return { links: [], textContent: text.trim() };
  }

  // Construct textContent from segments of text between/around links
  const textSegments: string[] = [];
  let lastIndex = 0;
  // Use a fresh regex object for segmentation pass
  const segmentationRegex = new RegExp(urlRegex);
  while ((match = segmentationRegex.exec(text)) !== null) {
    // Add text part before the current link
    if (match.index > lastIndex) {
      textSegments.push(text.substring(lastIndex, match.index));
    }
    lastIndex = segmentationRegex.lastIndex; // Update lastIndex to the end of the current link
  }
  // Add any remaining text part after the last link
  if (lastIndex < text.length) {
    textSegments.push(text.substring(lastIndex));
  }
  
  const finalTextContent = textSegments.join('').trim().replace(/\s\s+/g, ' ');

  return { links: collectedLinks, textContent: finalTextContent };
};

// Icon Components (Heroicons - Outline)
const PaperAirplaneIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);

const ArrowPathIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const UserCircleIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SparklesIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L1.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.25 12L17 13.75M17 13.75L15.75 15M17 13.75L18.25 15M15.75 15L17 16.25M18.75 12L17.5 10.75M17.5 10.75L15 12.5M17.5 10.75L15 9.5M15 9.5L16.25 11M15 9.5L13.75 8M13.75 8L15 6.25M13.75 8L12.5 9.5M12.5 9.5L15 11.25" />
  </svg>
);

const CogIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m1.5 0H21m-1.5 0H18m1.5-15H5.25m-.75 15V5.25m0 9.75m0 0H1.5M3 5.25H1.5m1.5 0V3m0 2.25V7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
  </svg>
);

const CheckCircleIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExclamationCircleIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
  </svg>
);

const XCircleIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Standard Material Design-like easing curve for smooth acceleration/deceleration
const smoothEase = [0.4, 0, 0.2, 1];
const accordionDuration = 0.35; // Slightly longer for a more noticeable accordion effect

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [uiState, setUiState] = useState<'search' | 'chat'>('search');
  const [currentImageData, setCurrentImageData] = useState<{ dataUrl: string; mimeType: string } | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const inputRef = useRef<null | HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (uiState === 'chat') {
      scrollToBottom();
    }
  }, [messages, uiState]);

  useEffect(() => {
    // Focus input when app becomes visible/active (e.g., shown by shortcut)
    // This is a general approach; Electron's focus on window show also helps.
    inputRef.current?.focus();
    // Request 'search' state on initial mount to ensure correct compact size
    // if main process didn't already set it or if window is reused.
    window.electronAPI.setWindowState('search');
  }, []); // Runs once on mount

  // Listen for screenshot shortcut from main process
  useEffect(() => {
    const cleanupScreenshot = window.electronAPI.onScreenshotShortcut(async () => {
      console.log('[renderer] screenshot-shortcut event received');
      try {
        window.electronAPI.closeImagePreviewWindow(); // Close existing preview if any
        console.log('[renderer] calling captureScreenshot');
        const result = await window.electronAPI.captureScreenshot();
        const screenshotDataUrl = result.dataUrl;
        const screenshotMimeType = result.mimeType;
        console.log('[renderer] captureScreenshot returned dataUrl length:', screenshotDataUrl?.length);
        setCurrentImageData({ dataUrl: screenshotDataUrl, mimeType: screenshotMimeType });
        // No longer managing isImagePreviewExpanded here, main process opens new window
        inputRef.current?.focus();
      } catch (error) {
        console.error('[renderer] error in screenshot handler:', error);
      }
    });
    return () => { cleanupScreenshot(); };
  }, []);

  // Effect to handle agent events
  useEffect(() => {
    const cleanupAgentEvents = window.electronAPI.onAgentEvent((eventData) => {
      console.log('Agent Event Received:', eventData); // For debugging
      setMessages((prevMessages) => {
        // Remove any existing 'thinking' message before adding a new message
        const filteredMessages = prevMessages.filter(msg => msg.type !== 'agent-thinking');
        
        switch (eventData.type) {
          case 'thinking':
            return [...filteredMessages, { id: nextMessageId(), type: 'agent-thinking', sender: 'agent' }];
          case 'response':
            return [...filteredMessages, { id: nextMessageId(), type: 'agent-text', sender: 'agent', text: eventData.text }];
          case 'toolCall':
            return [...filteredMessages, { id: nextMessageId(), type: 'agent-tool-call', sender: 'agent', toolName: eventData.toolName, args: eventData.args }];
          case 'toolResult':
            // Optionally, distinguish between success/error based on result structure if available
            const status = eventData.result?.error ? 'error' : 'success';
            return [...filteredMessages, { id: nextMessageId(), type: 'agent-tool-result', sender: 'agent', toolName: eventData.toolName, result: eventData.result, status }];
          case 'error':
            return [...filteredMessages, { id: nextMessageId(), type: 'agent-error', sender: 'agent', error: eventData.message }];
          default:
            return prevMessages; // Should not happen if types are exhaustive
        }
      });
    });

    // Cleanup listener on component unmount
    return () => {
      if (cleanupAgentEvents) {
        cleanupAgentEvents();
      }
    };
  }, []); // Empty dependency array to run only on mount and unmount

  // Effect to notify main process about image preview visibility for window resizing
  useEffect(() => {
    if (uiState === 'search') {
      if (currentImageData) {
        window.electronAPI.notifyImagePreviewVisibility(true);
      } else {
        window.electronAPI.notifyImagePreviewVisibility(false);
      }
    }
    // If uiState is 'chat', the window is already large enough, so no specific notification needed for thumbnail alone.
    // When transitioning from chat to search with an image still present (less likely flow but possible),
    // this will correctly notify to shrink only to search+thumbnail size.
  }, [currentImageData, uiState]);

  const handleSendMessage = () => {
    const trimmedInput = inputValue.trim();
    if (trimmedInput === '' && !currentImageData) return;

    if (uiState === 'search') {
      setUiState('chat');
      window.electronAPI.setWindowState('chat');
    }
    
    setMessages((prevMessages) => [
      ...prevMessages,
      { id: nextMessageId(), type: 'user', sender: 'user', text: trimmedInput, imageData: currentImageData },
    ]);
    
    const payload = currentImageData
      ? { content: trimmedInput, imageDataInput: { image: currentImageData.dataUrl, mimeType: currentImageData.mimeType } }
      : trimmedInput;
    
    setInputValue('');
    if (currentImageData) {
      window.electronAPI.closeImagePreviewWindow();
    }
    setCurrentImageData(null);

    window.electronAPI.sendMessage(payload)
      .then((acknowledgment) => {
        console.log('Message submission acknowledged by main process:', acknowledgment);
      })
      .catch (error => {
        console.error("Error during sendMessage call or initial main process handling:", error);
        setMessages((prevMessages) => [
          ...prevMessages,
          { 
            id: nextMessageId(), 
            type: 'agent-error', 
            sender: 'agent', 
            error: error instanceof Error ? error.message : "Failed to send message to agent"
          }
        ]);
      });
  };

  const handleResetConversation = async () => {
    await window.electronAPI.resetConversation();
    setMessages([]);
    setUiState('search');
    window.electronAPI.setWindowState('search');
    if (currentImageData) {
      window.electronAPI.closeImagePreviewWindow();
    }
    setCurrentImageData(null);
    inputRef.current?.focus();
  };
  
  const handleRemoveImage = () => {
    setCurrentImageData(null);
    window.electronAPI.closeImagePreviewWindow();
  };

  const clearChatLocally = useCallback(() => {
    // This is called when main process resets (e.g. if agent initiated it)
    setMessages([]);
    setUiState('search');
    // Main process should already handle its window state if it initiated reset.
    // If we want to ensure renderer syncs window size, call it here too.
    window.electronAPI.setWindowState('search'); // Ensure window shrinks if reset by main process
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const cleanupConversationReset = window.electronAPI.onConversationReset(clearChatLocally);
    return () => { 
      // Assuming onConversationReset returns a cleanup function or is an EventEmitter style 'off'
      // If it's just ipcRenderer.on, preload should return a cleanup.
      // For now, if it's void, this is a placeholder.
      if (typeof cleanupConversationReset === 'function') {
        cleanupConversationReset();
      }
    };
  }, [clearChatLocally]);

  const isInputEmpty = inputValue.trim() === '';

  // Draggable style for the input bar area
  const draggableStyle: React.CSSProperties = { WebkitAppRegion: 'drag' } as React.CSSProperties;
  const nonDraggableStyle: React.CSSProperties = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <div className="flex flex-col h-screen bg-black text-neutral-300 font-sans overflow-hidden rounded-lg">
      {/* Input Area (Now at the top) */}
      <div 
        className={`p-3 bg-neutral-950 shadow-md ${uiState === 'chat' || currentImageData ? 'border-b border-neutral-800/70' : ''}`}
        style={draggableStyle} 
      >
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !(isInputEmpty && !currentImageData) && handleSendMessage()}
            className="flex-grow py-2.5 px-3.5 bg-neutral-800 border border-neutral-700/80 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-neutral-100 placeholder-neutral-500 text-sm transition-all duration-150 shadow-sm hover:border-neutral-600 focus:shadow-[0_0_10px_0_rgba(0,200,255,0.3)]"
            placeholder="Type a message or take a screenshot (Cmd/Ctrl+Shift+S)..."
            style={nonDraggableStyle} 
          />
          <motion.button
            onClick={handleSendMessage}
            title="Send Message"
            disabled={isInputEmpty && !currentImageData}
            className={`flex items-center justify-center p-2.5 rounded-full transition-all duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-950 focus:ring-cyan-500 ${(isInputEmpty && !currentImageData) ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed' : 'bg-cyan-600 text-black hover:bg-cyan-500 active:bg-cyan-700'}`}
            whileHover={{ scale: (isInputEmpty && !currentImageData) ? 1 : 1.05, transition: { duration: 0.1 } }}
            whileTap={{ scale: (isInputEmpty && !currentImageData) ? 1 : 0.95, transition: { duration: 0.1 } }}
            style={nonDraggableStyle} 
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </motion.button>
          <motion.button
            onClick={handleResetConversation}
            title="Reset Conversation"
            className="p-2.5 text-cyan-400 rounded-md hover:bg-neutral-700/50 hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-950 focus:ring-cyan-600 transition-colors duration-150 active:bg-neutral-700"
            whileHover={{ scale: 1.1, transition: { duration: 0.1 } }}
            whileTap={{ scale: 0.9, transition: { duration: 0.1 } }}
            style={nonDraggableStyle} 
          >
            <ArrowPathIcon className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Screenshot Thumbnail Preview Area (below input bar) */}
      {currentImageData && (
        <motion.div 
          className="p-2 bg-neutral-850/90 flex items-center space-x-2" 
          style={nonDraggableStyle}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          <img src={currentImageData.dataUrl} alt="Screenshot Thumbnail" className="w-12 h-12 object-cover rounded-md border border-neutral-700" />
          <button 
            onClick={(e) => { e.stopPropagation(); handleRemoveImage(); }} 
            title="Remove Image" 
            className="p-1 text-neutral-500 hover:text-red-400 focus:outline-none rounded-full hover:bg-neutral-700/50"
            style={nonDraggableStyle}
          >
            <XCircleIcon className="w-5 h-5"/>
          </button>
        </motion.div>
      )}

      {/* Message Display Area (Below input, animates in) */}
      <AnimatePresence>
        {uiState === 'chat' && (
          <motion.div
            className="flex-grow overflow-y-auto p-6 space-y-4 bg-neutral-900/80 border-t border-neutral-800/70"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {
                ease: smoothEase,
                duration: accordionDuration,
              }
            }}
            exit={{
              opacity: 0,
              height: 0,
              transition: {
                ease: smoothEase,
                duration: accordionDuration,
              }
            }}
          >
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className="flex items-start space-x-3"
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease: smoothEase, delay: 0.05 } }}
                  exit={{ opacity: 0, transition: { duration: 0.15, ease: smoothEase } }}
                  layout
                >
                  <div className="flex-shrink-0 w-6 h-6 mt-0.5">
                    {msg.sender === 'user' ? (
                      <UserCircleIcon className="w-full h-full text-neutral-500" />
                    ) : msg.type === 'agent-thinking' ? (
                      <SparklesIcon className="w-full h-full text-yellow-500 animate-pulse" />
                    ) : msg.type === 'agent-tool-call' ? (
                      <CogIcon className="w-full h-full text-blue-400" />
                    ) : msg.type === 'agent-tool-result' && msg.status === 'success' ? (
                      <CheckCircleIcon className="w-full h-full text-green-500" />
                    ) : msg.type === 'agent-tool-result' && msg.status === 'error' ? (
                      <ExclamationCircleIcon className="w-full h-full text-red-500" />
                    ) : msg.type === 'agent-error' ? (
                      <ExclamationCircleIcon className="w-full h-full text-red-500" />
                    ) : (
                      <SparklesIcon className="w-full h-full text-cyan-500" />
                    )}
                  </div>
                  
                  <div className="flex-grow min-w-0">
                    <div
                      className={`break-words text-sm ${
                        msg.sender === 'user'
                          ? 'text-neutral-100 font-medium'
                          : msg.type === 'agent-error'
                          ? 'text-red-400'
                          : msg.type === 'agent-tool-call'
                          ? 'text-blue-300 italic'
                          : msg.type === 'agent-tool-result'
                          ? msg.status === 'error' ? 'text-red-300 italic' : 'text-green-300 italic'
                          : 'text-cyan-400'
                      }`}
                    >
                      {msg.type === 'user' && (
                        <div className="text-content">
                          {msg.sender === 'user' && <span className="text-neutral-500 mr-1.5 select-none">❯</span>}
                          {msg.text}
                          {msg.type === 'user' && msg.imageData && (
                            <div className="mt-2">
                              <img src={msg.imageData.dataUrl} alt="User provided" className="max-w-xs rounded-md" />
                            </div>
                          )}
                        </div>
                      )}
                      {msg.type === 'agent-text' && (
                        (() => {
                          const { links, textContent } = separateLinksAndText(msg.text);

                          return (
                            <div>
                              {links.length > 0 && (
                                <div className="mb-2 overflow-x-auto whitespace-nowrap pb-2 -mb-2 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-800/50">
                                  <div className="flex space-x-3">
                                    {links.map((link, index) => (
                                      <a
                                        key={index}
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-block w-64 h-32 bg-neutral-700/50 hover:bg-neutral-600/70 rounded-lg p-3 text-cyan-100 text-xs transition-all duration-150 shadow-md hover:shadow-lg flex flex-col justify-between group"
                                      >
                                        <div className="flex-grow flex items-center justify-center">
                                          {/* Placeholder for image preview */}
                                          <svg className="w-10 h-10 text-neutral-500 group-hover:text-neutral-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                        </div>
                                        <div className="mt-1">
                                          {/* Placeholder for headline */}
                                          <p className="text-neutral-400 group-hover:text-neutral-200 text-[11px] truncate transition-colors">Link Preview</p>
                                          <p className="text-cyan-300 group-hover:text-cyan-200 font-medium truncate transition-colors">
                                            {link.length > 45 ? link.substring(0, 42) + '...' : link}
                                          </p>
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {textContent && (
                                <div className="markdown-content" dangerouslySetInnerHTML={{ __html: marked(textContent) as string }} />
                              )}
                            </div>
                          );
                        })()
                      )}
                      {msg.type === 'agent-thinking' && <span className="italic text-neutral-400">Saiki is thinking...</span>}
                      {msg.type === 'agent-tool-call' && (
                        <>
                          <strong>Tool Call:</strong> {msg.toolName}
                          <pre className="text-xs whitespace-pre-wrap text-neutral-400 mt-1 p-2 bg-neutral-800/50 rounded">
                            Args: {JSON.stringify(msg.args, null, 2)}
                          </pre>
                        </>
                      )}
                      {msg.type === 'agent-tool-result' && (
                        <>
                          <strong>Tool Result ({msg.toolName}):</strong>
                          <pre className={`text-xs whitespace-pre-wrap mt-1 p-2 bg-neutral-800/50 rounded ${msg.status === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                            {JSON.stringify(msg.result, null, 2)}
                          </pre>
                        </>
                      )}
                      {msg.type === 'agent-error' && (
                        <>
                          <strong>Error:</strong> {msg.error}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App; 