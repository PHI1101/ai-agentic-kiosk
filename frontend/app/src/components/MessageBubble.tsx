import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

interface MessageBubbleProps {
  sender: 'user' | 'bot';
  text: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ sender, text }) => {
  const isUser = sender === 'user';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 1,
      }}
    >
      <Paper
        elevation={1}
        sx={{
          p: 1.5,
          backgroundColor: isUser ? 'primary.main' : 'grey.200',
          color: isUser ? 'primary.contrastText' : 'text.primary',
          borderRadius: isUser ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
          maxWidth: '80%',
        }}
      >
        <Typography variant="body1">{text}</Typography>
      </Paper>
    </Box>
  );
};

export default MessageBubble;
