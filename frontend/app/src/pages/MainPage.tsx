import React, { useEffect, useState, useCallback } from 'react';
import { Container, Button, Box, Grid, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ChatInterface from '../components/ChatInterface';
import OrderSummary from '../components/OrderSummary';
import AiAgentAvatar, { AgentStatus } from '../components/AiAgentAvatar';
import useVoiceRecognition from '../hooks/useVoiceRecognition';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { useChatStore } from '../store/chatStore';
import { useOrderStore } from '../store/orderStore';
import axios from 'axios';

const MainPage = () => {
  const { transcript, listening, startListening, stopListening, resetTranscript } = useVoiceRecognition();
  const { speak } = useTextToSpeech();
  const { messages, addMessage } = useChatStore();
  const { setOrder } = useOrderStore(); // Use the new setOrder function
  
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [inputValue, setInputValue] = useState('');

  // 페이지에 들어오면 바로 음성 인식 시작
  useEffect(() => {
    startListening();
    return () => {
      stopListening();
      window.speechSynthesis.cancel();
    };
  }, [startListening, stopListening]);

  useEffect(() => {
    setAgentStatus(listening ? 'listening' : 'idle');
  }, [listening]);

  // 사용자 메시지 처리 로직 (백엔드 API v2에 맞게 수정)
  const processUserCommand = useCallback(async (command: string) => {
    if (!command) return;

    setAgentStatus('thinking');

    try {
      const response = await axios.post('/api/orders/chat/', {
        message: command,
        history: messages.slice(-10), // Send last 10 messages as history
        currentState: useOrderStore.getState(), // Pass current order state
      });

      const { reply, currentOrder } = response.data;

      addMessage({ sender: 'bot', text: reply });
      speak(reply);
      setAgentStatus('speaking');

      if (currentOrder) {
        setOrder(currentOrder); // Update order state from backend response
      }

    } catch (error) {
      console.error("Error sending command to backend:", error);
      const errorText = "죄송합니다, 서버와 통신 중 오류가 발생했습니다.";
      addMessage({ sender: 'bot', text: errorText });
      speak(errorText);
      setAgentStatus('idle');
    }
  }, [messages, addMessage, setOrder, speak]);

  // 음성 인식 결과 처리
  useEffect(() => {
    if (transcript) {
      addMessage({ sender: 'user', text: transcript });
      processUserCommand(transcript);
      resetTranscript();
    }
  }, [transcript, addMessage, processUserCommand, resetTranscript]);

  // 텍스트 입력 처리
  const handleTextInputSend = () => {
    addMessage({ sender: 'user', text: inputValue });
    processUserCommand(inputValue);
    setInputValue('');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <AiAgentAvatar status={agentStatus} />
          <ChatInterface />
          <Box sx={{ mt: 2, display: 'flex', gap: 1}}>
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
          </Box>
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Button variant="contained" onClick={startListening} disabled={listening} sx={{ mr: 1 }}>
              음성인식 시작
            </Button>
            <Button variant="contained" color="secondary" onClick={stopListening} disabled={!listening}>
              음성인식 중지
            </Button>
          </Box>
        </Grid>
        <Grid item xs={12} md={5}>
          <OrderSummary />
        </Grid>
      </Grid>
    </Container>
  );
};

export default MainPage;
