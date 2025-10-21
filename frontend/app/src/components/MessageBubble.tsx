import React from 'react';
import { Paper, Typography } from '@mui/material';

interface MessageBubbleProps {
  text: string;
  sender: 'user' | 'ai';
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ text, sender }) => {
  const isUser = sender === 'user';

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        mb: 2,
        maxWidth: '80%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        bgcolor: isUser ? 'primary.main' : 'background.paper',
        color: isUser ? 'primary.contrastText' : 'text.primary',
        borderRadius: isUser ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
      }}
    >
      <Typography variant="body1">{text}</Typography>
    </Paper>
  );
};

export default MessageBubble;
