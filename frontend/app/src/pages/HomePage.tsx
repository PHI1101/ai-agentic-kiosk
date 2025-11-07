import React, { useEffect } from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import useVoiceRecognition from '../hooks/useVoiceRecognition';
import { useTextToSpeech } from '../hooks/useTextToSpeech';

const HomePage = () => {
  const navigate = useNavigate();
  const { transcript, startListening, stopListening } = useVoiceRecognition();
  const { speak } = useTextToSpeech();

  const welcomeText = "안녕하세요! 저는 여러분의 주문을 쉽고 편리하게 도와드릴 AI 에이전트입니다. 주문 시작이라고 말씀하시거나 아래 버튼을 눌러주세요.";

  // 페이지에 들어오면 안내 문구 읽어주기 및 음성 인식 시작
  useEffect(() => {
    speak(welcomeText);
    startListening();
    return () => {
      stopListening();
      window.speechSynthesis.cancel(); // 페이지 벗어날 때 음성 중지
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "주문 시작" 음성 명령 감지
  useEffect(() => {
    if (transcript.includes('주문 시작')) {
      navigate('/order');
    }
  }, [transcript, navigate]);

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
          {welcomeText.split('. ').map((line, index) => (
            <React.Fragment key={index}>{line}{index < 1 && '.'}<br /></React.Fragment>
          ))}
        </Typography>
        <Button variant="contained" size="large" onClick={handleOrderStart}>
          주문 시작하기
        </Button>
      </Box>
    </Container>
  );
};

export default HomePage;
