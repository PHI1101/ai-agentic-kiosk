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
  storeName:string | null;
  items: OrderItem[];
  totalPrice: number;
  status: string;
}

const ChatInterface: React.FC = () => {
  const { messages, addMessage } = useChatStore();
  const [inputValue, setInputValue] = useState('');
  // The order state is kept for UI display, but is not updated by the new AI logic.
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const lastMessageCount = useRef(messages.length);
  const hasInitialMessageBeenAdded = useRef(false);

  // Function to send message to the new AI backend
  const sendMessage = useCallback(async (text: string) => {
    if (text.trim() === '') return;

    const userMessage = { text, sender: 'user' as const };
    addMessage(userMessage);
    setInputValue('');

    try {
      // Call the new AI backend endpoint
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
      const response = await axios.post(`${apiUrl}/api/orders/chat/`, {
        history: messages,
        message: text
      });

      const aiResponse = response.data.reply;
      addMessage({ text: aiResponse, sender: 'ai' });

      // Note: The logic to update 'currentOrder' has been removed.
      // The conversation flow is now managed by the AI.
      // For future improvements, the AI could return structured data to update the order status.

    } catch (error) {
      console.error("Error communicating with the AI backend:", error);
      const errorMessage = '죄송합니다, AI 서버와 통신하는 중 오류가 발생했습니다.';
      addMessage({ text: errorMessage, sender: 'ai' });
    }
  }, [addMessage]);

  const { transcript, isListening, startListening, stopListening, speak } = useVoiceRecognition({ onSend: sendMessage });

  // Automatically start listening and add initial greeting
  useEffect(() => {
    if (!hasInitialMessageBeenAdded.current) {
      startListening();
      const greeting = "안녕하세요! 주문을 도와드릴 AI 키오스크입니다. 무엇을 도와드릴까요?";
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