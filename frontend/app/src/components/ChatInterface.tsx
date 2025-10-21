import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, IconButton, Paper, Typography, List, ListItem, ListItemText, Divider } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import SendIcon from '@mui/icons-material/Send';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew'; // New import for accessibility icon
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
  const [isVisuallyImpairedMode, setIsVisuallyImpairedMode] = useState(false); // Moved declaration here
  const { transcript, isListening, startListening, stopListening, resetTranscript, hasSupport } = useVoiceRecognition(isVisuallyImpairedMode); // Pass the state
  const [inputValue, setInputValue] = useState('');
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder | null>(null);
  const [remainingPickupTime, setRemainingPickupTime] = useState<number | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  // const [isVisuallyImpairedMode, setIsVisuallyImpairedMode] = useState(false); // Removed original declaration
  const [isAwaitingAccessibilityResponse, setIsAwaitingAccessibilityResponse] = useState(false);
  const initialPromptSentRef = useRef(false); // New ref

  useEffect(() => {
    if (transcript) {
      setInputValue(transcript);
      // 음성 인식이 멈추고 transcript가 있으면 자동으로 메시지 전송 (continuous: false 모드)
      // 단, 초기 접근성 질문에 대한 응답 대기 중이 아닐 때만 자동 전송
      if (!isVisuallyImpairedMode && !isListening && transcript.trim() !== '' && !isAwaitingAccessibilityResponse) {
        handleSendMessage();
      }
    }
  }, [transcript, isListening, isAwaitingAccessibilityResponse, isVisuallyImpairedMode]); // isVisuallyImpairedMode 추가

  // 시각 장애인 모드 (continuous: true)일 때 음성 입력 자동 전송 로직 (정지 감지)
  useEffect(() => {
    let silenceTimer: NodeJS.Timeout | null = null;
    const SILENCE_THRESHOLD = 1500; // 1.5초 동안 말이 없으면 전송

    if (isVisuallyImpairedMode && isListening && transcript.trim() !== '' && !isAwaitingAccessibilityResponse) {
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
  }, [transcript, isVisuallyImpairedMode, isListening, isAwaitingAccessibilityResponse]); // handleSendMessage는 의존성 배열에 포함하지 않음 (렌더링마다 재생성 방지) // isListening과 isAwaitingAccessibilityResponse를 의존성 배열에 추가

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages]);

  // 초기 접근성 안내 메시지
  useEffect(() => {
    if (initialPromptSentRef.current) { // Check ref
      return;
    }

    if (hasSupport) { // hasSupport가 true일 때만 음성 안내 시도
      initialPromptSentRef.current = true; // Set ref to true
      setIsAwaitingAccessibilityResponse(true); // Now awaiting response
      const initialMessage = "안녕하세요. 이 키오스크는 시각, 청각, 지체 장애인을 위한 배리어프리 기능을 제공합니다. 혹시 음성 안내가 필요하시면 '네'라고 말씀해주세요.";
      addMessage({ text: initialMessage, sender: 'ai' });
      
      const utterance = new SpeechSynthesisUtterance(initialMessage);
      utterance.lang = 'ko-KR';
      window.speechSynthesis.speak(utterance);

      startListening();
    }
  }, [hasSupport, addMessage, startListening]); // Removed hasAskedForAccessibility from dependencies

  // TTS (Text-to-Speech) 로직
  useEffect(() => {
    if (isVisuallyImpairedMode && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'ai') {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(lastMessage.text);
        utterance.lang = 'ko-KR';
        window.speechSynthesis.speak(utterance);
      }
    } else {
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
        if (diffMinutes >= 0) {
          setRemainingPickupTime(diffMinutes);
        } else {
          setRemainingPickupTime(0);
          if (timer) clearInterval(timer);
        }
      };
      updateRemainingTime();
      timer = setInterval(updateRemainingTime, 60 * 1000);
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

    // 초기 접근성 질문에 대한 응답 처리
    if (isAwaitingAccessibilityResponse) {
      setIsAwaitingAccessibilityResponse(false); // No longer awaiting
      const userResponse = inputValue.toLowerCase();
      if (userResponse.includes('네') || userResponse.includes('맞습니다')) {
        setIsVisuallyImpairedMode(true);
        addMessage({ text: '네, 시각 장애인 모드를 활성화합니다. 이제부터 음성으로 안내해 드릴게요.', sender: 'ai' });
        setInputValue('');
        resetTranscript();
        // startListening(); // Removed this line
        return;
      } else {
        // 사용자가 '네' 또는 '맞습니다'라고 응답하지 않은 경우, 일반 대화로 진행
        addMessage({ text: '알겠습니다. 일반 모드로 진행합니다.', sender: 'ai' });
        stopListening();
        setInputValue('');
        resetTranscript();
        // Fall through to normal backend communication
      }
    }

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

  // 시각 장애인 모드 활성화 시 마이크 자동 활성화
  useEffect(() => {
    if (isVisuallyImpairedMode && !isListening) {
      startListening();
    }
  }, [isVisuallyImpairedMode, isListening, startListening]);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
      // 음성 인식이 중지될 때 TTS도 중지
      window.speechSynthesis.cancel();
    } else {
      resetTranscript();
      startListening();
      if (isVisuallyImpairedMode) {
        const listeningMessage = "듣는 중...";
        addMessage({ text: listeningMessage, sender: 'ai' }); // 채팅 기록에도 추가
        const utterance = new SpeechSynthesisUtterance(listeningMessage);
        utterance.lang = 'ko-KR';
        window.speechSynthesis.speak(utterance);
      }
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
          {hasSupport ? (
            <>
              <IconButton color={isListening ? 'secondary' : 'primary'} onClick={handleMicClick} sx={{ ml: 1 }}>
                <MicIcon />
              </IconButton>
            </>
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