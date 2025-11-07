import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SmartToyIcon from '@mui/icons-material/SmartToy';

const HomePage = () => {
  const navigate = useNavigate();

  const handleOrderStart = () => {
    navigate('/order');
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          textAlign: 'center',
        }}
      >
        <SmartToyIcon sx={{ fontSize: 80, color: 'primary.main' }} />
        <Typography variant="h3" component="h1" gutterBottom sx={{ mt: 2, fontWeight: 'bold' }}>
          AI 주문 도우미
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
          안녕하세요! 저는 여러분의 주문을 쉽고 편리하게 도와드릴 AI 에이전트입니다.
          <br />
          음성으로 간편하게 주문을 시작해보세요.
        </Typography>
        <Button variant="contained" size="large" onClick={handleOrderStart}>
          주문 시작하기
        </Button>
      </Box>
    </Container>
  );
};

export default HomePage;
