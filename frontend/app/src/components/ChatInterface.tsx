import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, TextField, IconButton, Paper, Typography, List, ListItem, ListItemText, Divider } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import SendIcon from '@mui/icons-material/Send';
import useChatStore from '../store/chatStore';
import useVoiceRecognition from '../hooks/useVoiceRecognition';
import MessageBubble from './MessageBubble';
import axios from 'axios';

// Type definitions for order state
interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface CurrentOrder {
  orderId: number | null;
  storeName: string | null;
  items: OrderItem[];
  totalPrice: number;
  status: string;
}

const ChatInterface: React.FC = () => {
  const { messages, addMessage } = useChatStore();
  const [inputValue, setInputValue] = useState('');
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const lastMessageCount = useRef(messages.length);
  const hasInitialMessageBeenAdded = useRef(false);
  const [conversationState, setConversationState] = useState<string>('INITIAL'); // New state for conversation flow

  // Function to send message to backend and update state
  const sendMessage = useCallback(async (text: string) => {
    if (text.trim() === '') return;

    const userMessage = { text, sender: 'user' as const };
    addMessage(userMessage);
    setInputValue('');

    let reply = "죄송합니다. 무슨 말씀이신지 잘 모르겠어요.";
    let updatedOrder = currentOrder;

    switch (conversationState) {
      case 'INITIAL':
        if (text.includes('가게') || text.includes('주변')) {
          reply = '현재 고객님 주변에는 \'김밥천국\', \'버거킹\', \'스타벅스\'가 있습니다. 어느 가게를 선택하시겠어요? (예: 김밥천국)';
          setConversationState('WAITING_FOR_STORE_SELECTION');
        } else {
          reply = '안녕하세요! 주문을 도와드릴 AI 키오스크입니다. 주변에 어떤 가게가 있는지 알려드릴까요? (예: 주변 가게 알려줘)';
        }
        break;
      case 'WAITING_FOR_STORE_SELECTION':
        if (text.includes('김밥천국')) {
          reply = '\'김밥천국\'을 선택하셨습니다. 김밥천국의 메뉴는 김밥, 라면, 떡볶이, 돈까스 등이 있습니다. 무엇을 주문하시겠어요? (예: 김밥 한 줄 주세요)';
          updatedOrder = { orderId: 1, storeName: '김밥천국', items: [], totalPrice: 0, status: 'pending' };
          setConversationState('STORE_SELECTED');
        } else if (text.includes('버거킹')) {
          reply = '\'버거킹\'을 선택하셨습니다. 버거킹의 메뉴는 햄버거, 감자튀김, 콜라 등이 있습니다. 무엇을 주문하시겠어요? (예: 햄버거 하나 주세요)';
          updatedOrder = { orderId: 2, storeName: '버거킹', items: [], totalPrice: 0, status: 'pending' };
          setConversationState('STORE_SELECTED');
        } else if (text.includes('스타벅스')) {
          reply = '\'스타벅스\'를 선택하셨습니다. 스타벅스의 메뉴는 아메리카노, 라떼, 샌드위치 등이 있습니다. 무엇을 주문하시겠어요? (예: 아메리카노 한 잔 주세요)';
          updatedOrder = { orderId: 3, storeName: '스타벅스', items: [], totalPrice: 0, status: 'pending' };
          setConversationState('STORE_SELECTED');
        } else {
          reply = '어떤 가게를 선택하시겠어요? (예: 김밥천국)';
        }
        break;
      case 'STORE_SELECTED':
      case 'WAITING_FOR_ORDER':
        // Handle ordering for 김밥천국
        if (updatedOrder?.storeName === '김밥천국') {
          if (text.includes('김밥')) {
            const item: OrderItem = { name: '김밥', quantity: 1, price: 3000 };
            updatedOrder = { ...updatedOrder, items: [...(updatedOrder?.items || []), item], totalPrice: (updatedOrder?.totalPrice || 0) + item.price };
            reply = `김밥 1개를 주문에 추가했습니다. 현재 총 금액은 ${updatedOrder.totalPrice.toLocaleString()}원입니다. 더 주문하시겠어요? (예: 라면 하나 추가 / 결제할게요)`;
            setConversationState('WAITING_FOR_ORDER');
          } else if (text.includes('라면')) {
            const item: OrderItem = { name: '라면', quantity: 1, price: 4000 };
            updatedOrder = { ...updatedOrder, items: [...(updatedOrder?.items || []), item], totalPrice: (updatedOrder?.totalPrice || 0) + item.price };
            reply = `라면 1개를 주문에 추가했습니다. 현재 총 금액은 ${updatedOrder.totalPrice.toLocaleString()}원입니다. 더 주문하시겠어요? (예: 김밥 하나 추가 / 결제할게요)`;
            setConversationState('WAITING_FOR_ORDER');
          } else if (text.includes('결제') || text.includes('주문할게요')) {
            if (updatedOrder && updatedOrder.items.length > 0) {
              reply = `총 금액은 ${updatedOrder.totalPrice.toLocaleString()}원입니다. 어떤 방식으로 결제하시겠어요? (예: 카드로 결제할게요)`;
              setConversationState('WAITING_FOR_PAYMENT_METHOD');
            } else {
              reply = '주문하신 메뉴가 없습니다. 메뉴를 먼저 선택해주세요. (예: 김밥 한 줄 주세요)';
            }
          } else {
            reply = '주문할 메뉴를 말씀해주세요. (예: 김밥 한 줄 주세요)';
          }
        }
        // Handle ordering for 버거킹
        else if (updatedOrder?.storeName === '버거킹') {
          if (text.includes('햄버거')) {
            const item: OrderItem = { name: '햄버거', quantity: 1, price: 7000 };
            updatedOrder = { ...updatedOrder, items: [...(updatedOrder?.items || []), item], totalPrice: (updatedOrder?.totalPrice || 0) + item.price };
            reply = `햄버거 1개를 주문에 추가했습니다. 현재 총 금액은 ${updatedOrder.totalPrice.toLocaleString()}원입니다. 더 주문하시겠어요? (예: 감자튀김 추가 / 결제할게요)`;
            setConversationState('WAITING_FOR_ORDER');
          } else if (text.includes('감자튀김')) {
            const item: OrderItem = { name: '감자튀김', quantity: 1, price: 2500 };
            updatedOrder = { ...updatedOrder, items: [...(updatedOrder?.items || []), item], totalPrice: (updatedOrder?.totalPrice || 0) + item.price };
            reply = `감자튀김 1개를 주문에 추가했습니다. 현재 총 금액은 ${updatedOrder.totalPrice.toLocaleString()}원입니다. 더 주문하시겠어요? (예: 콜라 추가 / 결제할게요)`;
            setConversationState('WAITING_FOR_ORDER');
          } else if (text.includes('콜라')) {
            const item: OrderItem = { name: '콜라', quantity: 1, price: 2000 };
            updatedOrder = { ...updatedOrder, items: [...(updatedOrder?.items || []), item], totalPrice: (updatedOrder?.totalPrice || 0) + item.price };
            reply = `콜라 1개를 주문에 추가했습니다. 현재 총 금액은 ${updatedOrder.totalPrice.toLocaleString()}원입니다. 더 주문하시겠어요? (예: 햄버거 추가 / 결제할게요)`;
            setConversationState('WAITING_FOR_ORDER');
          } else if (text.includes('결제') || text.includes('주문할게요')) {
            if (updatedOrder && updatedOrder.items.length > 0) {
              reply = `총 금액은 ${updatedOrder.totalPrice.toLocaleString()}원입니다. 어떤 방식으로 결제하시겠어요? (예: 카드로 결제할게요)`;
              setConversationState('WAITING_FOR_PAYMENT_METHOD');
            } else {
              reply = '주문하신 메뉴가 없습니다. 메뉴를 먼저 선택해주세요. (예: 햄버거 하나 주세요)';
            }
          } else {
            reply = '주문할 메뉴를 말씀해주세요. (예: 햄버거 하나 주세요)';
          }
        }
        // Handle ordering for 스타벅스
        else if (updatedOrder?.storeName === '스타벅스') {
          if (text.includes('아메리카노')) {
            const item: OrderItem = { name: '아메리카노', quantity: 1, price: 4500 };
            updatedOrder = { ...updatedOrder, items: [...(updatedOrder?.items || []), item], totalPrice: (updatedOrder?.totalPrice || 0) + item.price };
            reply = `아메리카노 1개를 주문에 추가했습니다. 현재 총 금액은 ${updatedOrder.totalPrice.toLocaleString()}원입니다. 더 주문하시겠어요? (예: 라떼 추가 / 결제할게요)`;
            setConversationState('WAITING_FOR_ORDER');
          } else if (text.includes('라떼')) {
            const item: OrderItem = { name: '라떼', quantity: 1, price: 5000 };
            updatedOrder = { ...updatedOrder, items: [...(updatedOrder?.items || []), item], totalPrice: (updatedOrder?.totalPrice || 0) + item.price };
            reply = `라떼 1개를 주문에 추가했습니다. 현재 총 금액은 ${updatedOrder.totalPrice.toLocaleString()}원입니다. 더 주문하시겠어요? (예: 샌드위치 추가 / 결제할게요)`;
            setConversationState('WAITING_FOR_ORDER');
          } else if (text.includes('샌드위치')) {
            const item: OrderItem = { name: '샌드위치', quantity: 1, price: 6000 };
            updatedOrder = { ...updatedOrder, items: [...(updatedOrder?.items || []), item], totalPrice: (updatedOrder?.totalPrice || 0) + item.price };
            reply = `샌드위치 1개를 주문에 추가했습니다. 현재 총 금액은 ${updatedOrder.totalPrice.toLocaleString()}원입니다. 더 주문하시겠어요? (예: 아메리카노 추가 / 결제할게요)`;
            setConversationState('WAITING_FOR_ORDER');
          } else if (text.includes('결제') || text.includes('주문할게요')) {
            if (updatedOrder && updatedOrder.items.length > 0) {
              reply = `총 금액은 ${updatedOrder.totalPrice.toLocaleString()}원입니다. 어떤 방식으로 결제하시겠어요? (예: 카드로 결제할게요)`;
              setConversationState('WAITING_FOR_PAYMENT_METHOD');
            } else {
              reply = '주문하신 메뉴가 없습니다. 메뉴를 먼저 선택해주세요. (예: 아메리카노 한 잔 주세요)';
            }
          } else {
            reply = '주문할 메뉴를 말씀해주세요. (예: 아메리카노 한 잔 주세요)';
          }
        }
        else {
          reply = '선택하신 가게의 메뉴를 말씀해주세요.';
        }
        break;
      case 'WAITING_FOR_PAYMENT_METHOD':
        if (text.includes('카드') || text.includes('신용카드')) {
          reply = '카드 결제가 완료되었습니다. 주문 번호는 123번이며, 픽업은 15분 뒤인 11시 45분부터 가능합니다. 감사합니다!';
          setConversationState('INITIAL'); // Reset conversation
          updatedOrder = null; // Clear order
        } else if (text.includes('현금')) {
          reply = '현금 결제가 완료되었습니다. 주문 번호는 123번이며, 픽업은 15분 뒤인 11시 45분부터 가능합니다. 감사합니다!';
          setConversationState('INITIAL');
          updatedOrder = null;
        } else if (text.includes('페이팔') || text.includes('PayPal')) {
          reply = '페이팔 결제가 완료되었습니다. 주문 번호는 123번이며, 픽업은 15분 뒤인 11시 45분부터 가능합니다. 감사합니다!';
          setConversationState('INITIAL');
          updatedOrder = null;
        } else {
          reply = '어떤 결제 방식을 선택하시겠어요? (예: 카드로 결제할게요)';
        }
        break;
      default:
        reply = '죄송합니다. 현재 상태에서는 이해할 수 없는 요청입니다. (예: 주변 가게 알려줘)';
        break;
    }

    addMessage({ text: reply, sender: 'ai' });
    if (updatedOrder) {
      setCurrentOrder(updatedOrder);
    }
  }, [addMessage, currentOrder, conversationState]);

  const { transcript, isListening, startListening, stopListening, speak } = useVoiceRecognition({ onSend: sendMessage });

  // Automatically start listening and add initial greeting
  useEffect(() => {
    if (!hasInitialMessageBeenAdded.current) {
      startListening();
      const greeting = "안녕하세요! 주문을 도와드릴 AI 키오스크입니다. 주변에 어떤 가게가 있는지 알려드릴까요?";
      addMessage({ text: greeting, sender: 'ai' });
      hasInitialMessageBeenAdded.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Speak the latest AI message
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.sender === 'ai' && messages.length > lastMessageCount.current) {
      speak(lastMessage.text);
    }
    lastMessageCount.current = messages.length;
  }, [messages, speak]);

  const handleManualSend = () => {
    sendMessage(inputValue);
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    }
    else {
      startListening();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 120px)' }}>
      <Paper elevation={4} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', mr: 2 }}>
        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
          <List>
            {messages.map((msg, index) => (
              <MessageBubble key={index} text={msg.text} sender={msg.sender} />
            ))}
          </List>
          <div ref={messagesEndRef} />
        </Box>
        {isListening && (
          <Box sx={{ p: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'action.hover' }}>
            <Typography variant="body2" color="primary">...듣는 중...</Typography>
          </Box>
        )}
        <Box sx={{ p: 2, borderTop: '1px solid #ddd', display: 'flex', alignItems: 'center' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="메시지를 입력하거나 음성으로 말하세요..."
            value={transcript || inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleManualSend()}
            disabled={isListening && transcript !== ''}
          />
          <IconButton color={isListening ? 'secondary' : 'primary'} onClick={handleMicClick} sx={{ ml: 1 }}>
            <MicIcon />
          </IconButton>
          <IconButton color="primary" onClick={handleManualSend} sx={{ ml: 1 }}>
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>

      <Paper elevation={4} sx={{ width: 300, p: 2, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom>주문 현황</Typography>
        <Divider sx={{ mb: 2 }} />
        {currentOrder && currentOrder.storeName && (
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            가게: {currentOrder.storeName}
          </Typography>
        )}
        {currentOrder && currentOrder.items.length > 0 ? (
          <>
            <List dense sx={{ flexGrow: 1, overflowY: 'auto' }}>
              {currentOrder.items.map((item, index) => (
                <ListItem key={index} disablePadding>
                  <ListItemText
                    primary={`${item.name} ${item.quantity}개`}
                  />
                  <Typography variant="body2">{(item.price * item.quantity).toLocaleString()}원</Typography>
                </ListItem>
              ))}
            </List>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              총 금액: {currentOrder.totalPrice.toLocaleString()}원
            </Typography>
            <Typography variant="body2" color="text.secondary">
              상태: {currentOrder.status}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">주문 내역이 없습니다.</Typography>
        )}
      </Paper>
    </Box>
  );
};

export default ChatInterface;
