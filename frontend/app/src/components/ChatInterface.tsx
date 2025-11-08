import React, { useEffect, useRef } from 'react';
import { Box, Paper, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import { useChatStore } from '../store/chatStore';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import MessageBubble from './MessageBubble';

interface ChatInterfaceProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  handleTextInputSend: () => void;
  listening: boolean;
  startListening: () => void;
  stopListening: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  inputValue,
  setInputValue,
  handleTextInputSend,
  listening,
  startListening,
  stopListening,
}) => {
  const { messages } = useChatStore();
  const { speak } = useTextToSpeech();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to the latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Speak the latest assistant message
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.sender === 'assistant') {
      speak(lastMessage.text);
    }
  }, [messages, speak]);

  const handleToggleListening = () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <Paper elevation={3} sx={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {messages.map((msg, index) => (
          <MessageBubble key={index} sender={msg.sender} text={msg.text} />
        ))}
        <div ref={messagesEndRef} />
      </Box>
      <Box sx={{ p: 2, borderTop: '1px solid #ddd', display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="텍스트로 입력..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleTextInputSend()}
        />
        <IconButton color="primary" onClick={handleTextInputSend} disabled={!inputValue}>
          <SendIcon />
        </IconButton>
        <IconButton color={listening ? "error" : "primary"} onClick={handleToggleListening}>
          {listening ? <MicOffIcon /> : <MicIcon />}
        </IconButton>
      </Box>
    </Paper>
  );
};

export default ChatInterface;