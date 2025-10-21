import React from 'react';
import { Container, Typography } from '@mui/material';
import ChatInterface from '../components/ChatInterface';

const MainPage: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ pt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        AI Agentic Kiosk
      </Typography>
      <ChatInterface />
    </Container>
  );
};

export default MainPage;
