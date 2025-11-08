import React, { useEffect, useRef } from 'react';
import { Box, Paper } from '@mui/material';
import { useChatStore } from '../store/chatStore';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import MessageBubble from './MessageBubble';

const ChatInterface = () => {
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

  return (
    <Paper elevation={3} sx={{ p: 2, height: '500px', overflowY: 'auto' }}>
      <Box>
        {messages.map((msg, index) => (
          <MessageBubble key={index} sender={msg.sender} text={msg.text} />
        ))}
        <div ref={messagesEndRef} />
      </Box>
    </Paper>
  );
};

export default ChatInterface;
