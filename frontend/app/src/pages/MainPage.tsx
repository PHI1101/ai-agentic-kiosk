import React, { useEffect, useState } from 'react';
import { Container, Typography, Button, Box, Grid } from '@mui/material';
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

  useEffect(() => {
    setAgentStatus(listening ? 'listening' : 'idle');
  }, [listening]);

  useEffect(() => {
    if (transcript) {
      addMessage({ sender: 'user', text: transcript });
      setAgentStatus('thinking'); // 사용자가 말한 후 '생각 중' 상태로 변경

      if (pendingItem && (transcript.includes('네') || transcript.includes('예'))) {
        addItem(pendingItem);
        addMessage({ sender: 'bot', text: `${pendingItem.name}을(를) 장바구니에 추가했습니다. 더 필요하신 것이 있으신가요?` });
        setPendingItem(null);
        setAgentStatus('speaking');
      } else if (pendingItem && (transcript.includes('아니요') || transcript.includes('아니오'))) {
        addMessage({ sender: 'bot', text: '알겠습니다. 다른 것을 주문하시겠어요?' });
        setPendingItem(null);
        setAgentStatus('speaking');
      } else {
        const handler = setTimeout(() => {
          axios.post('/api/orders/process_command/', { command: transcript })
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
        }, 500);

        return () => clearTimeout(handler);
      }
      resetTranscript();
    }
  }, [transcript, addMessage, resetTranscript, addItem, pendingItem]);

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <AiAgentAvatar status={agentStatus} />
          <ChatInterface />
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
