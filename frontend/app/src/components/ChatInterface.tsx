import React, { useState, useEffect, useRef } from 'react';
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

import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew'; // New import for accessibility icon

const ChatInterface: React.FC = () => {
  const { messages, addMessage } = useChatStore();
  const { transcript, isListening, startListening, stopListening, resetTranscript, hasSupport } = useVoiceRecognition();
  const [inputValue, setInputValue] = useState('');
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder | null>(null);
  const [remainingPickupTime, setRemainingPickupTime] = useState<number | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [isVisuallyImpairedMode, setIsVisuallyImpairedMode] = useState(false); // New state for visually impaired mode

  useEffect(() => {
    if (transcript) {
      setInputValue(transcript);
    }
  }, [transcript]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages]);

  // TTS (Text-to-Speech) 로직
  useEffect(() => {
    if (isVisuallyImpairedMode && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'ai') {
        // 기존 음성 중지
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(lastMessage.text);
        utterance.lang = 'ko-KR'; // 한국어 설정
        window.speechSynthesis.speak(utterance);
      }
    } else {
      // 시각 장애인 모드가 비활성화되면 음성 중지
      window.speechSynthesis.cancel();
    }
  }, [messages, isVisuallyImpairedMode]);

  // 픽업 시간 카운트다운 로직
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (currentOrder && currentOrder.status === 'completed' && currentOrder.pickupTimeDate) {
      const pickupDate = new Date(currentOrder.pickupTimeDate);
      const updateRemainingTime = () => {
        const now = new Date();
        const diffMinutes = Math.ceil((pickupDate.getTime() - now.getTime()) / (1000 * 60));
        if (diffMinutes >= 0) { // 0분일 때도 표시되도록 수정
          setRemainingPickupTime(diffMinutes);
        } else {
          setRemainingPickupTime(0);
          if (timer) clearInterval(timer);
        }
      };
      updateRemainingTime(); // 즉시 업데이트
      timer = setInterval(updateRemainingTime, 60 * 1000); // 1분마다 업데이트
    } else {
      setRemainingPickupTime(null);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [currentOrder]);

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;

    addMessage({ text: inputValue, sender: 'user' });

    try {
      const response = await axios.post('http://localhost:3001/api/process-command', { message: inputValue });
      addMessage({ text: response.data.reply, sender: 'ai' });
      setCurrentOrder(response.data.currentOrder); // currentOrder 상태 업데이트
    } catch (error) {
      console.error('Error sending message to backend:', error);
      addMessage({ text: '죄송합니다. 서버와 통신 중 오류가 발생했습니다.', sender: 'ai' });
    }

    setInputValue('');
    resetTranscript();
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
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
        <Box sx={{ p: 2, borderTop: '1px solid #ddd', display: 'flex', alignItems: 'center' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="메시지를 입력하거나 마이크 버튼을 누르세요..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          {hasSupport ? (
            <IconButton color={isListening ? 'secondary' : 'primary'} onClick={handleMicClick} sx={{ ml: 1 }}>
              <MicIcon />
            </IconButton>
          ) : (
            <Typography variant="caption" color="error" sx={{ ml: 1 }}>음성 인식을 지원하지 않는 브라우저입니다.</Typography>
          )}
          <IconButton color="primary" onClick={handleSendMessage} sx={{ ml: 1 }}>
            <SendIcon />
          </IconButton>
          <IconButton
            color={isVisuallyImpairedMode ? 'secondary' : 'default'}
            onClick={() => setIsVisuallyImpairedMode(!isVisuallyImpairedMode)}
            sx={{ ml: 1 }}
            aria-label="시각 장애인 모드 토글"
          >
            <AccessibilityNewIcon />
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