import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Container, Grid, CircularProgress, Divider } from '@mui/material';
import { useOrderStore, OrderItem as OrderItemType } from '../store/orderStore';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import useVoiceRecognition from '../hooks/useVoiceRecognition'; // 음성 인식 훅 추가
import axios from 'axios';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import AiAgentAvatar, { AgentStatus } from '../components/AiAgentAvatar';
import VoiceInputIndicator from '../components/VoiceInputIndicator'; // VoiceInputIndicator import

const PaymentPage = () => {
  const navigate = useNavigate();
  const { orderId, items, storeName, setOrder, calculateTotalPrice } = useOrderStore();
  const totalPrice = calculateTotalPrice();
  const { speak, speaking } = useTextToSpeech();
  const { transcript, listening, startListening, stopListening, resetTranscript } = useVoiceRecognition(); // 음성 인식 훅 사용

  const [agentMessage, setAgentMessage] = useState("결제 방법을 선택해주세요.");
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [paymentStatus, setPaymentStatus] = useState<'selecting' | 'processing' | 'success' | 'failed'>('selecting');
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For silence detection
  const SPEECH_PAUSE_THRESHOLD_MS = 1500; // 1.5 seconds of silence to consider speech ended

  // 페이지 로드 시 주문 내역과 결제 방법 질문을 음성으로 안내
  useEffect(() => {
    const itemsSummary = items.map(item => `${item.name} ${item.quantity}개`).join(', ');
    const initialGreeting = `주문 내역은 ${storeName}에서 ${itemsSummary}, 총 결제 금액은 ${totalPrice.toLocaleString()}원입니다. 결제는 카드 결제, QR 결제 중에 어떤 것으로 하시겠습니까?`;
    
    setAgentMessage(initialGreeting);
    speak(initialGreeting);
    
    // TTS가 끝난 후 음성 인식을 시작하도록 타이머 설정
    const speechEndTimeout = setTimeout(() => {
      if (paymentStatus === 'selecting' && !listening) {
        startListening();
      }
    }, 500); // TTS 시작 후 0.5초 뒤에 음성 인식 시작 시도

    return () => {
      clearTimeout(speechEndTimeout);
      stopListening();
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 페이지 최초 로드 시 한 번만 실행

  // AI 에이전트와 통신하는 함수
  const sendPaymentCommand = useCallback(async (command: string) => {
    if (!command) return; // 빈 명령은 전송하지 않음
    setAgentStatus('thinking');
    try {
      const { ...orderData } = useOrderStore.getState();
      const response = await axios.post('https://ai-agentic-kiosk-production.up.railway.app/api/orders/chat/', {
        message: command,
        currentState: orderData,
        history: [{ sender: 'user', text: command }]
      });

      const { reply, action, currentOrder } = response.data; // eslint-disable-line @typescript-eslint/no-unused-vars

      setAgentMessage(reply);
      speak(reply);

      if (action === 'navigate_to_home') {
        setPaymentStatus('success');
        setTimeout(() => {
          setOrder({});
          navigate('/');
        }, 4000);
      } else if (action === 'navigate_to_order') {
        navigate('/order');
      }
    } catch (error) {
      const errorMsg = "결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      setAgentMessage(errorMsg);
      speak(errorMsg);
      setPaymentStatus('failed');
    }
  }, [navigate, setOrder, speak]);

  // 결제 방법 선택 핸들러
  const handlePaymentMethodSelect = useCallback((method: 'card' | 'qr') => {
    if (paymentStatus !== 'selecting') return;

    const command = method === 'card' ? '카드로 결제할게요' : 'QR코드로 결제할게요';
    sendPaymentCommand(command);
    setPaymentStatus('processing');

    setTimeout(() => {
      sendPaymentCommand('결제 성공');
    }, 5000);
  }, [paymentStatus, sendPaymentCommand]);

  // 음성 명령으로 결제 방법 선택 (즉시 처리)
  useEffect(() => {
    if (transcript && listening) { // listening 중일 때만 즉시 처리
      if (transcript.includes('카드')) {
        handlePaymentMethodSelect('card');
        resetTranscript();
        stopListening(); // 명령 처리 후 음성 인식 중지
      } else if (transcript.includes('큐알') || transcript.toLowerCase().includes('qr')) {
        handlePaymentMethodSelect('qr');
        resetTranscript();
        stopListening(); // 명령 처리 후 음성 인식 중지
      }
    }
  }, [transcript, listening, handlePaymentMethodSelect, resetTranscript, stopListening]);

  // 침묵 감지 및 자동 전송 로직
  useEffect(() => {
    if (transcript && !speaking && listening) { // transcript가 있고, AI가 말하고 있지 않으며, 듣고 있을 때
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }

      speechTimeoutRef.current = setTimeout(() => {
        console.log(`[PaymentPage Silence Detection] User paused. Processing command: "${transcript}"`);
        sendPaymentCommand(transcript);
        resetTranscript();
        stopListening(); // 전송 후 음성 인식 중지
      }, SPEECH_PAUSE_THRESHOLD_MS);
    }

    return () => {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }
    };
  }, [transcript, speaking, listening, sendPaymentCommand, resetTranscript, stopListening]);

  // 결제 취소 핸들러
  const handleCancelPayment = () => {
    sendPaymentCommand('결제 취소');
  };

  // 음성 입출력 및 에이전트 상태 관리
  useEffect(() => {
    if (speaking) {
      setAgentStatus('speaking');
      if (listening) stopListening();
    } else {
      // AI가 말을 멈췄을 때
      if (paymentStatus === 'selecting' && !listening) {
        startListening();
      }

      // 현재 상태에 따라 에이전트 상태를 설정
      if (listening) {
        setAgentStatus('listening');
      } else if (paymentStatus === 'processing') {
        setAgentStatus('thinking');
      } else {
        setAgentStatus('idle');
      }
    }
  }, [speaking, listening, paymentStatus, startListening, stopListening]);


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
      <VoiceInputIndicator listening={listening} onStop={stopListening} />
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