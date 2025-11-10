import React, { useEffect, useRef } from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import useVoiceRecognition from '../hooks/useVoiceRecognition';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { keyframes } from '@emotion/react';
import VoiceInputIndicator from '../components/VoiceInputIndicator'; // VoiceInputIndicator import

// Define keyframes for animations
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const iconPulse = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
`;

const HomePage = () => {
  const navigate = useNavigate();
  const { transcript, listening, startListening, stopListening, resetTranscript } = useVoiceRecognition();
  const { speak, speaking, ttsFinishedNaturally } = useTextToSpeech(); // speaking, ttsFinishedNaturally 추가

  const welcomeText = "안녕하세요! AI 키오스크 '오더피아'입니다. 주문을 쉽고 편리하게 도와드릴게요. '주문 시작'이라고 말씀하시거나 아래 버튼을 눌러주세요.";

  // 초기 환영 메시지 재생
  useEffect(() => {
    speak(welcomeText);
    return () => {
      stopListening();
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // TTS가 끝난 후 음성 인식 시작
  useEffect(() => {
    if (!speaking && ttsFinishedNaturally && !listening) {
      const timer = setTimeout(() => {
        startListening();
      }, 500); // TTS 종료 후 0.5초 딜레이
      return () => clearTimeout(timer);
    }
  }, [speaking, ttsFinishedNaturally, listening, startListening]);

  // 음성 명령 처리
  useEffect(() => {
    if (transcript.includes('주문 시작')) {
      stopListening();
      resetTranscript();
      navigate('/main'); // '/order' 대신 '/main'으로 변경
    }
  }, [transcript, navigate, resetTranscript, stopListening]);

  const handleOrderStart = () => {
    stopListening(); // 버튼 클릭 시 음성 인식 중지
    resetTranscript(); // 트랜스크립트 초기화
    navigate('/main'); // '/order' 대신 '/main'으로 변경
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 2,
      }}
    >
      <VoiceInputIndicator listening={listening} onStop={stopListening} /> {/* VoiceInputIndicator 추가 */}
      <Container maxWidth="sm">
        <Paper
          elevation={12}
          sx={{
            p: { xs: 3, sm: 6 },
            borderRadius: '20px',
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            animation: `${fadeIn} 0.8s ease-out`,
          }}
        >
          <Box sx={{
            animation: `${iconPulse} 2s infinite ease-in-out`,
            display: 'inline-block',
          }}>
            <SmartToyIcon sx={{ fontSize: 100, color: 'primary.main' }} />
          </Box>
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{
              mt: 2,
              fontWeight: 700,
              color: '#333',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            오더피아
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{
              mb: 5,
              fontWeight: 400,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            AI와 함께하는 스마트한 주문, 지금 시작해보세요.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleOrderStart}
            sx={{
              borderRadius: '50px',
              px: 5,
              py: 1.5,
              fontWeight: 600,
              fontSize: '1.1rem',
              fontFamily: "'Poppins', sans-serif",
              background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'scale(1.05)',
                boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.2)',
              },
            }}
          >
            주문 시작하기
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default HomePage;