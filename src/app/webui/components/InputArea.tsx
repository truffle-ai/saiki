'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Paperclip, SendHorizontal, X, Loader2, Bot, ChevronDown, AlertCircle, Zap } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { useChatContext } from './hooks/ChatContext';
import { Switch } from './ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip';

interface InputAreaProps {
  onSend: (content: string, imageData?: { base64: string; mimeType: string }) => void;
  isSending?: boolean;
}

export default function InputArea({ onSend, isSending }: InputAreaProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get current session context to ensure model switch applies to the correct session
  const { currentSessionId, isStreaming, setStreaming } = useChatContext();
  
  // LLM selector state
  const [currentModel, setCurrentModel] = useState('Loading...');
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [modelSwitchError, setModelSwitchError] = useState<string | null>(null);
  
  // TODO: Populate using LLM_REGISTRY by exposing an API endpoint
  const coreModels = [
    { name: 'Claude 4 Sonnet', provider: 'anthropic', model: 'claude-4-sonnet-20250514' },
    { name: 'GPT-4o', provider: 'openai', model: 'gpt-4o' },
    { name: 'GPT-4.1 Mini', provider: 'openai', model: 'gpt-4.1-mini' },
    { name: 'Gemini 2.5 Pro', provider: 'google', model: 'gemini-2.5-pro' },
  ];

  // Fetch current LLM configuration
  useEffect(() => {
    const fetchCurrentModel = async () => {
      try {
        // Include session ID in the request to get the model for the specific session
        const url = currentSessionId 
          ? `/api/llm/current?sessionId=${currentSessionId}` 
          : '/api/llm/current';
        
        const response = await fetch(url);
        if (response.ok) {
          const config = await response.json();
          // Try to match with core models first
          const matchedModel = coreModels.find(m => m.model === config.config.model);
          if (matchedModel) {
            setCurrentModel(matchedModel.name);
          } else {
            // Fallback to provider/model display
            setCurrentModel(`${config.config.provider}/${config.config.model}`);
          }
        }
      } catch (error) {
        console.error('Failed to fetch current model:', error);
        setCurrentModel('Unknown');
      }
    };

    fetchCurrentModel();
  }, [currentSessionId]); // Re-fetch whenever the session changes

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120;
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [text, adjustTextareaHeight]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !imageData) return;
    onSend(trimmed, imageData ?? undefined);
    setText('');
    setImageData(null);
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.overflowY = 'hidden';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      console.error("Selected file is not an image.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const result = reader.result as string;
        const commaIndex = result.indexOf(',');
        if (commaIndex === -1) throw new Error("Invalid Data URL format");

        const meta = result.substring(0, commaIndex);
        const base64 = result.substring(commaIndex + 1);

        const mimeMatch = meta.match(/data:(.*);base64/);
        const mimeType = mimeMatch ? mimeMatch[1] : file.type;

        if (!mimeType) throw new Error("Could not determine MIME type");

        setImageData({ base64, mimeType });
      } catch (error) {
          console.error("Error processing image:", error);
          setImageData(null);
      }
    };
    reader.onerror = (error) => {
        console.error("FileReader error:", error);
        setImageData(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = () => setImageData(null);

  const triggerFileInput = () => fileInputRef.current?.click();

  const handleModelSwitch = async (model: { name: string; provider: string; model: string }) => {
    setIsLoadingModel(true);
    setModelSwitchError(null); // Clear any previous errors
    try {
      const requestBody: any = {
        provider: model.provider,
        model: model.model,
        router: 'vercel'
      };

      // Include current session ID to ensure model switch applies to the correct session
      // If there's no active session, it will fall back to the default session behavior
      if (currentSessionId) {
        requestBody.sessionId = currentSessionId;
      }

      const response = await fetch('/api/llm/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setCurrentModel(model.name);
        setModelSwitchError(null); // Clear any errors on success
      } else {
        // Handle new structured error format
        let errorMessage = 'Failed to switch model';
        if (result.errors && result.errors.length > 0) {
          const primaryError = result.errors[0];
          errorMessage = primaryError.message;
          
          // For API key errors, show the suggested action
          if (primaryError.type === 'missing_api_key' && primaryError.suggestedAction) {
            errorMessage += `. ${primaryError.suggestedAction}`;
          }
        } else if (result.error) {
          // Fallback to old format
          errorMessage = result.error;
        }
        
        console.error('Failed to switch model:', errorMessage);
        setModelSwitchError(errorMessage);
        
        // Auto-clear error after 10 seconds
        setTimeout(() => setModelSwitchError(null), 10000);
      }
    } catch (error) {
      console.error('Network error while switching model:', error);
      const errorMessage = 'Network error while switching model';
      setModelSwitchError(errorMessage);
      
      // Auto-clear error after 10 seconds
      setTimeout(() => setModelSwitchError(null), 10000);
    } finally {
      setIsLoadingModel(false);
    }
  };

  // Clear model switch error when user starts typing
  useEffect(() => {
    if (text && modelSwitchError) {
      setModelSwitchError(null);
    }
  }, [text, modelSwitchError]);

  const showClearButton = text.length > 0 || !!imageData;

  return (
    <div
      id="input-area"
      className="flex flex-col gap-2 w-full"
    >
      {/* Model Switch Error Alert */}
      {modelSwitchError && (
        <Alert variant="destructive" className="mb-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{modelSwitchError}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModelSwitchError(null)}
              className="h-auto p-1 ml-2"
            >
              <X className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-end gap-2 w-full">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={triggerFileInput} 
          className="flex-shrink-0 text-muted-foreground hover:text-primary rounded-full p-2"
          aria-label="Attach image"
        >
          <Paperclip className="h-8 w-8" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          id="image-upload"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />

        <div className="flex-1 flex flex-col w-full">
          {imageData && (
            <div className="relative mb-1.5 w-fit border border-border rounded-lg p-1 bg-muted/50 group">
              <img
                src={`data:${imageData.mimeType};base64,${imageData.base64}`}
                alt="preview"
                className="h-20 w-auto rounded-md"
              />
              <Button
                variant="destructive"
                size="icon"
                onClick={removeImage}
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Saiki anything..."
              rows={1}
              className="resize-none min-h-[42px] w-full border-input bg-transparent focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 rounded-lg p-2.5 pr-32 text-sm"
            />
            
            {/* Controls - Model Selector and Streaming Toggle */}
            <div className="absolute bottom-1.5 right-2 flex items-center gap-2">
              {/* Streaming Toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-pointer">
                      <Zap className={`h-3 w-3 ${isStreaming ? 'text-blue-500' : 'text-muted-foreground'}`} />
                      <Switch
                        checked={isStreaming}
                        onCheckedChange={setStreaming}
                        className="scale-75"
                        aria-label="Toggle streaming"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{isStreaming ? 'Streaming enabled' : 'Streaming disabled'}</p>
                    <p className="text-xs opacity-75">
                      {isStreaming ? 'Responses will stream in real-time' : 'Responses will arrive all at once'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {/* Model Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    disabled={isLoadingModel}
                  >
                    <Bot className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">
                      {isLoadingModel ? '...' : currentModel}
                    </span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {coreModels.map((model) => (
                    <DropdownMenuItem 
                      key={model.model}
                      onClick={() => handleModelSwitch(model)}
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      {model.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    // TODO: Implement proper model viewer UI
                    console.log('View all models clicked');
                  }}>
                    View all models
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <Button 
          type="submit" 
          size="icon" 
          onClick={handleSend} 
          disabled={!text.trim() && !imageData} 
          className="flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full p-2 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70"
          aria-label="Send message"
        >
          <SendHorizontal className="h-5 w-5" />
        </Button>

        {showClearButton && !isSending && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => { 
              setText(''); 
              setImageData(null); 
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.overflowY = 'hidden';
              }
            }}
            className="flex-shrink-0 text-muted-foreground hover:text-destructive rounded-full p-2 ml-1"
            aria-label="Clear input"
          >
            <X className="h-5 w-5" />
          </Button>
        )}

        {isSending && (
           <div className="flex-shrink-0 p-2 ml-1">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
           </div>
        )}
      </div>
    </div>
  );
} 