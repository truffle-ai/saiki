'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Paperclip, SendHorizontal, X, Loader2 } from 'lucide-react';

interface InputAreaProps {
  onSend: (content: string, imageData?: { base64: string; mimeType: string }) => void;
  isSending?: boolean;
}

export default function InputArea({ onSend, isSending }: InputAreaProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const showClearButton = text.length > 0 || !!imageData;

  return (
    <div
      id="input-area"
      className="flex items-end gap-2 w-full p-2 bg-background"
    >
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
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Saiki anything..."
          rows={1}
          className="resize-none min-h-[42px] w-full border-input bg-transparent focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 rounded-lg p-2.5 text-sm"
        />
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
  );
} 