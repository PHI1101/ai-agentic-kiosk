import React, { useEffect } from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import useVoiceRecognition from '../hooks/useVoiceRecognition';
import { useTextToSpeech } from '../hooks/useTextToSpeech';

const HomePage = () => {
  const navigate = useNavigate();
  const { transcript, startListening, stopListening, resetTranscript } = useVoiceRecognition();
  const { speak } = useTextToSpeech();

  // Updated welcome text to reflect the service name "보이스 오더"
  const welcomeText = "안녕하세요! AI 키오스크 '보이스 오더'입니다. 주문을 쉽고 편리하게 도와드릴게요. '주문 시작'이라고 말씀하시거나 아래 버튼을 눌러주세요.";

  // Read the welcome message and start voice recognition on page load
  useEffect(() => {
    speak(welcomeText);
    startListening();
    return () => {
      stopListening();
      window.speechSynthesis.cancel(); // Stop speech when leaving the page
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect "주문 시작" (Start Order) voice command
  useEffect(() => {
    if (transcript.includes('주문 시작')) {
      navigate('/order');
      resetTranscript(); // Reset transcript after command is detected and acted upon
    }
  }, [transcript, navigate, resetTranscript]); // Add resetTranscript to dependency array

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
          보이스 오더
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
          {/* Dynamically split the welcome text for better formatting */}
          {welcomeText.split('. ').map((line, index) => (
            <React.Fragment key={index}>{line}{index < 2 && '.'}<br /></React.Fragment>
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
