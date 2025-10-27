import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, TextField, IconButton, Paper, Typography, List, ListItem, ListItemText, Divider } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import SendIcon from '@mui/icons-material/Send';
import useChatStore, { Message } from '../store/chatStore';
import useVoiceRecognition from '../hooks/useVoiceRecognition';
import MessageBubble from './MessageBubble';
import axios from 'axios';

interface OrderItem {
  itemId: number;
  name: string;
  quantity: number;
  price: number;
  options: { name: string; price: number }[];
}

interface CurrentOrder {
  storeId: string | null;
  storeName: string | null;
  items: OrderItem[];
  totalPrice: number;
  status: string;
  paymentMethod: string | null;
  pickupTime: string | null;
  pickupTimeDate: string | null; // ISO 8601 형식의 문자열로 받을 예정
}

const ChatInterface: React.FC = () => {
  const { messages, addMessage } = useChatStore();
  const { transcript, isListening, startListening, stopListening, resetTranscript, speak } = useVoiceRecognition();
  const [inputValue, setInputValue] = useState('');
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder | null>(null);
  const [remainingPickupTime, setRemainingPickupTime] = useState<number | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const hasInitialMessageBeenAdded = useRef(false);

  // Initial greeting message
  useEffect(() => {
    if (!hasInitialMessageBeenAdded.current) {
      const greetingMessage = '안녕하세요! 주문을 도와드릴 AI 키오스크입니다. 무엇을 주문하시겠어요?';
      addMessage({ text: greetingMessage, sender: 'ai' });
      speak(greetingMessage); // Speak unconditionally
      hasInitialMessageBeenAdded.current = true;
    }
  }, [addMessage, speak]);

  const handleSendMessage = useCallback(async () => {
    if (inputValue.trim() === '') return;

    addMessage({ text: inputValue, sender: 'user' });

    try {
      const response = await axios.post('/api/process-command', { message: inputValue, currentState: currentOrder });
      addMessage({ text: response.data.reply, sender: 'ai' });
      speak(response.data.reply);
      setCurrentOrder(response.data.currentOrder); // currentOrder 상태 업데이트
    } catch (error) {
      console.error('Error sending message to backend:', error);
      addMessage({ text: '죄송합니다. 서버와 통신 중 오류가 발생했습니다.', sender: 'ai' });
      speak('죄송합니다. 서버와 통신 중 오류가 발생했습니다.');
    }

    setInputValue('');
  }, [inputValue, addMessage, speak, setCurrentOrder, setInputValue]);

  // 음성 입력 자동 전송 로직 (정지 감지) - 모든 모드에서 continuous: true
  useEffect(() => {
    let silenceTimer: NodeJS.Timeout | null = null;
    const SILENCE_THRESHOLD = 1500; // 1.5초 동안 말이 없으면 전송

    // isListening이 true이고, transcript가 있고, 초기 질문 응답 대기 중이 아닐 때만 타이머 작동
    if (isListening && transcript.trim() !== '') {
      // 이전 타이머가 있다면 클리어
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
      // 일정 시간 후 메시지 전송 타이머 시작
      silenceTimer = setTimeout(() => {
        handleSendMessage();
      }, SILENCE_THRESHOLD);
    }

    // 클린업 함수: 컴포넌트 언마운트 또는 의존성 변경 시 타이머 클리어
    return () => {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
    };
  }, [transcript, isListening, handleSendMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages]);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
      // 음성 인식이 중지될 때 TTS도 중지
      window.speechSynthesis.cancel();
    } else {
      resetTranscript();
      startListening();
      const listeningMessage = "듣는 중...";
      addMessage({ text: listeningMessage, sender: 'ai' }); // 채팅 기록에도 추가
      speak(listeningMessage); // Speak unconditionally
    }
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)' }}>
      <Paper elevation={4} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', mr: 2 }}>
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column' }}>
          {messages.map((msg: Message) => (
            <MessageBubble key={msg.id} text={msg.text} sender={msg.sender} />
          ))}
          <div ref={messagesEndRef} />
        </Box>
        {isListening && ( // Moved here, inside the Paper, above the input field's Box
          <Box sx={{ p: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'action.hover' }}>
            <Typography variant="body2" color="primary">
              듣는 중...
            </Typography>
          </Box>
        )}
        <Box sx={{ p: 2, borderTop: '1px solid #ddd', display: 'flex', alignItems: 'center' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="메시지를 입력하거나 마이크 버튼을 누르세요..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <IconButton
                color={isListening ? 'secondary' : 'primary'}
                onClick={handleMicClick}
                sx={{
                  ml: 1,
                  '&.Mui-focusVisible': {
                    outline: '2px solid',
                    outlineColor: (theme) => theme.palette.primary.main,
                    outlineOffset: '2px',
                  },
                }}
              >
                <MicIcon />
              </IconButton>
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            sx={{
              ml: 1,
              '&.Mui-focusVisible': {
                outline: '2px solid',
                outlineColor: (theme) => theme.palette.primary.main,
                outlineOffset: '2px',
              },
            }}
          >
            <SendIcon />
          </IconButton>
          
        </Box>
      </Paper>

      {/* 주문 요약 및 상태 표시 UI */}
      <Paper elevation={4} sx={{ width: 300, p: 2, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom>주문 현황</Typography>
        <Divider sx={{ mb: 2 }} />
        {currentOrder && currentOrder.storeName && (
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            **가게:** {currentOrder.storeName}
          </Typography>
        )}
        {currentOrder && currentOrder.items.length > 0 ? (
          <>
            <List dense sx={{ flexGrow: 1, overflowY: 'auto' }}>
              {currentOrder.items.map((item, index) => (
                <ListItem key={index} disablePadding>
                  <ListItemText
                    primary={`${item.name} ${item.quantity}개`}
                    secondary={item.options.length > 0 ? `옵션: ${item.options.map(o => o.name).join(', ')}` : null}
                  />
                  <Typography variant="body2">{item.price * item.quantity + item.options.reduce((sum, opt) => sum + opt.price, 0)}원</Typography>
                </ListItem>
              ))}
            </List>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              **총 금액:** {currentOrder.totalPrice}원
            </Typography>
            <Typography variant="body2" color="text.secondary">
              **현재 상태:** {currentOrder.status === 'pending' ? '대기 중' :
                            currentOrder.status === 'selecting_store' ? '가게 선택 중' :
                            currentOrder.status === 'selecting_menu' ? '메뉴 선택 중' :
                            currentOrder.status === 'ordered' ? '주문 완료 (결제 대기)' :
                            currentOrder.status === 'payment_requested' ? '결제 요청됨' :
                            currentOrder.status === 'completed' ? `결제 완료 (픽업: ${currentOrder.pickupTime})` :
                            currentOrder.status === 'cancelled' ? '주문 취소됨' : currentOrder.status}
            </Typography>
            {currentOrder.status === 'completed' && remainingPickupTime !== null && (
              <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                **픽업까지 남은 시간:** {remainingPickupTime > 0 ? `${remainingPickupTime}분` : '지금 픽업 가능'}
              </Typography>
            )}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">주문 내역이 없습니다.</Typography>
        )}
      </Paper>
    </Box>
  );
};

export default ChatInterface;