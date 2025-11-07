import React from 'react';
import { Box, Paper } from '@mui/material';
import { useChatStore } from '../store/chatStore';
import MessageBubble from './MessageBubble';

const ChatInterface = () => {
  const { messages } = useChatStore();

  return (
    <Paper elevation={3} sx={{ p: 2, height: '500px', overflowY: 'auto' }}>
      <Box>
        {messages.map((msg, index) => (
          <MessageBubble key={index} sender={msg.sender} text={msg.text} />
        ))}
      </Box>
    </Paper>
  );
};

export default ChatInterface;
