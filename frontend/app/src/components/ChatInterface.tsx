import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, TextField, IconButton, Paper, Typography, List } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import SendIcon from '@mui/icons-material/Send';
import useChatStore from '../store/chatStore';
import useVoiceRecognition from '../hooks/useVoiceRecognition';
import MessageBubble from './MessageBubble';
import axios from 'axios';

const ChatInterface: React.FC = () => {
  const { messages, addMessage, setCurrentOrder } = useChatStore(); // Get setCurrentOrder from global store
  const [inputValue, setInputValue] = useState('');
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
      const apiUrl = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
      const response = await axios.post(`${apiUrl}/api/orders/chat/`, {
        history: messages,
        message: text,
        currentState: useChatStore.getState().currentOrder, // Pass current global order state
      });

      const aiResponse = response.data.reply;
      addMessage({ text: aiResponse, sender: 'ai' });

      if (response.data.currentOrder) {
        setCurrentOrder(response.data.currentOrder); // Update global order state
      }

    } catch (error) {
      console.error("Error communicating with the AI backend:", error);
      const errorMessage = '죄송합니다, AI 서버와 통신하는 중 오류가 발생했습니다.';
      addMessage({ text: errorMessage, sender: 'ai' });
    }
  }, [addMessage, messages, setCurrentOrder]); // Add setCurrentOrder to dependencies

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
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
  );
};

export default ChatInterface;
