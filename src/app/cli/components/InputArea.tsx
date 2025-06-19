import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface InputAreaProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function InputArea({ onSubmit, disabled = false, placeholder = "Type your message..." }: InputAreaProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (value: string) => {
    if (value.trim() && !disabled) {
      onSubmit(value);
      setInput('');
    }
  };

  return (
    <Box 
      borderStyle="single" 
      borderColor={disabled ? "gray" : "green"}
      paddingX={1}
    >
      <Text color={disabled ? "gray" : "green"}>{'> '}</Text>
      <TextInput
        value={input}
        placeholder={disabled ? "Please wait..." : placeholder}
        onChange={setInput}
        onSubmit={handleSubmit}
        showCursor={!disabled}
      />
    </Box>
  );
} 