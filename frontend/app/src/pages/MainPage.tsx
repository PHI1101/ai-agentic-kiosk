import React, { useEffect, useState, useCallback } from 'react';
import { Container, Button, Box, Grid, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ChatInterface from '../components/ChatInterface';
import OrderSummary from '../components/OrderSummary';
import AiAgentAvatar, { AgentStatus } from '../components/AiAgentAvatar';
import useVoiceRecognition from '../hooks/useVoiceRecognition';
import { useChatStore } from '../store/chatStore';
import { useOrderStore } from '../store/orderStore';
import axios from 'axios';

interface PendingOrderItem {
  name: string;
  price: number;
}

const MainPage = () => {
  const { transcript, listening, startListening, stopListening, resetTranscript } = useVoiceRecognition();
  const { addMessage } = useChatStore();
  const { addItem } = useOrderStore();
  
  const [pendingItem, setPendingItem] = useState<PendingOrderItem | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [inputValue, setInputValue] = useState('');

  // 페이지에 들어오면 바로 음성 인식 시작
  useEffect(() => {
    startListening();
    return () => {
      stopListening();
    };
  }, [startListening, stopListening]);

  useEffect(() => {
    setAgentStatus(listening ? 'listening' : 'idle');
  }, [listening]);

  // 사용자 메시지 처리 로직을 공통 함수로 분리
  const processUserCommand = useCallback((command: string) => {
    if (!command) return;

    setAgentStatus('thinking');

    if (pendingItem && (command.includes('네') || command.includes('예'))) {
      addItem(pendingItem);
      addMessage({ sender: 'bot', text: `${pendingItem.name}을(를) 장바구니에 추가했습니다. 더 필요하신 것이 있으신가요?` });
      setPendingItem(null);
      setAgentStatus('speaking');
    } else if (pendingItem && (command.includes('아니요') || command.includes('아니오'))) {
      addMessage({ sender: 'bot', text: '알겠습니다. 다른 것을 주문하시겠어요?' });
      setPendingItem(null);
      setAgentStatus('speaking');
    } else {
      axios.post('/api/orders/process_command/', { command })
        .then(response => {
          const { action, item, price, response: botResponse } = response.data;
          addMessage({ sender: 'bot', text: botResponse });
          setAgentStatus('speaking');
          if (action === 'confirm_order' && item && price) {
            setPendingItem({ name: item, price: price });
          }
        })
        .catch(error => {
          console.error("Error sending command to backend:", error);
          addMessage({ sender: 'bot', text: "죄송합니다, 오류가 발생했습니다." });
          setAgentStatus('idle');
        });
    }
  }, [addMessage, addItem, pendingItem]);

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
