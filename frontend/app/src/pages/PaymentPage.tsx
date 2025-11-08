import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Container, Grid, CircularProgress, Divider } from '@mui/material';
import { useOrderStore, OrderItem as OrderItemType } from '../store/orderStore';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import axios from 'axios';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import AiAgentAvatar, { AgentStatus } from '../components/AiAgentAvatar';

const PaymentPage = () => {
  const navigate = useNavigate();
  const { orderId, items, totalPrice, storeName, setOrder } = useOrderStore();
  const { speak, speaking } = useTextToSpeech();

  const [agentMessage, setAgentMessage] = useState("결제 방법을 선택해주세요.");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('speaking');
  const [paymentStatus, setPaymentStatus] = useState<'selecting' | 'processing' | 'success' | 'failed'>('selecting');

  // 페이지 로드 시 첫 안내 메시지 음성 출력
  useEffect(() => {
    speak(agentMessage);
  }, [agentMessage, speak]);

  // AI 에이전트와 통신하는 함수
  const sendPaymentCommand = useCallback(async (command: string) => {
    setAgentStatus('thinking');
    try {
      const { ...orderData } = useOrderStore.getState();
      const response = await axios.post('https://ai-agentic-kiosk-production.up.railway.app/api/orders/chat/', {
        message: command,
        currentState: orderData,
        history: [{ sender: 'user', text: command }] // 간단한 history 제공
      });

      const { reply, action, currentOrder } = response.data;

      setAgentMessage(reply);
      setAgentStatus('speaking');
      speak(reply);

      if (action === 'navigate_to_home') {
        setPaymentStatus('success');
        setTimeout(() => {
          setOrder({}); // 주문 정보 초기화
          navigate('/');
        }, 4000);
      } else if (action === 'navigate_to_order') {
        navigate('/order');
      } else {
         // In case the order state is updated (e.g. status change)
        if (currentOrder) {
          setOrder(currentOrder);
        }
      }
    } catch (error) {
      const errorMsg = "결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      setAgentMessage(errorMsg);
      setAgentStatus('idle');
      speak(errorMsg);
      setPaymentStatus('failed');
    }
  }, [navigate, setOrder, speak]);

  // 결제 방법 선택 핸들러
  const handlePaymentMethodSelect = (method: 'card' | 'qr') => {
    if (paymentStatus !== 'selecting') return;

    const command = method === 'card' ? '카드로 결제할게요' : 'QR코드로 결제할게요';
    sendPaymentCommand(command);
    setPaymentStatus('processing');

    // 결제 시뮬레이션
    setTimeout(() => {
      // 실제 결제 연동이 성공했다고 가정
      sendPaymentCommand('결제 성공');
    }, 5000); // 5초 후 결제 성공
  };

  // 결제 취소 핸들러
  const handleCancelPayment = () => {
    sendPaymentCommand('결제 취소');
  };

  useEffect(() => {
    if (speaking) {
      setAgentStatus('speaking');
    } else if (paymentStatus === 'processing') {
      setAgentStatus('thinking');
    } else {
      setAgentStatus('idle');
    }
  }, [speaking, paymentStatus]);


  if (!orderId) {
    return (
      <Container maxWidth="sm" sx={{ textAlign: 'center', mt: 10 }}>
        <Typography variant="h5">잘못된 접근입니다.</Typography>
        <Typography sx={{ mt: 2 }}>주문 정보가 없습니다. 홈으로 돌아갑니다.</Typography>
        <Button variant="contained" sx={{ mt: 4 }} onClick={() => navigate('/')}>홈으로</Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 4 }}>
        <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold' }}>
          결제하기
        </Typography>
        <Box sx={{ my: 3, textAlign: 'center' }}>
            <AiAgentAvatar status={agentStatus} />
            <Typography variant="h6" sx={{ mt: 2, color: 'primary.main', minHeight: '3rem' }}>
                {agentMessage}
            </Typography>
        </Box>
        <Divider sx={{ my: 3 }} />
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>주문 내역 ({storeName})</Typography>
            <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
              {items.map((item: OrderItemType, index: number) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>{item.name} x {item.quantity}</Typography>
                  <Typography>{(item.price * item.quantity).toLocaleString()}원</Typography>
                </Box>
              ))}
            </Paper>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>총 결제 금액</Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{totalPrice.toLocaleString()}원</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom align="center">결제 방법 선택</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              {paymentStatus === 'selecting' && (
                <>
                  <Button
                    variant="contained"
                    startIcon={<CreditCardIcon />}
                    onClick={() => handlePaymentMethodSelect('card')}
                    sx={{ py: 2 }}
                  >
                    카드 결제
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<QrCode2Icon />}
                    onClick={() => handlePaymentMethodSelect('qr')}
                    sx={{ py: 2 }}
                  >
                    QR 결제
                  </Button>
                </>
              )}
              {paymentStatus === 'processing' && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={60} />
                  <Typography sx={{ mt: 2 }}>결제 진행 중...</Typography>
                </Box>
              )}
              {paymentStatus === 'success' && (
                <Box sx={{ textAlign: 'center', py: 4, color: 'success.main' }}>
                  <Typography variant="h5">결제 완료!</Typography>
                </Box>
              )}
               {paymentStatus === 'failed' && (
                <Box sx={{ textAlign: 'center', py: 4, color: 'error.main' }}>
                  <Typography variant="h5">결제 실패</Typography>
                </Box>
              )}
            </Box>
            <Button
              variant="outlined"
              color="error"
              onClick={handleCancelPayment}
              sx={{ mt: 3, width: '100%' }}
              disabled={paymentStatus === 'processing' || paymentStatus === 'success'}
            >
              결제 취소
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default PaymentPage;