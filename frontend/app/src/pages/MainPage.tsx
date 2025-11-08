import React, { useEffect, useState, useCallback } from 'react';
import { Container, Button, Box, Grid, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ChatInterface from '../components/ChatInterface';
import OrderSummary from '../components/OrderSummary';
import AiAgentAvatar, { AgentStatus } from '../components/AiAgentAvatar';
import useVoiceRecognition from '../hooks/useVoiceRecognition';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { useChatStore } from '../store/chatStore';
import { useOrderStore } from '../store/orderStore';
import axios from 'axios';

const MainPage = () => {
  const { transcript, listening, startListening, stopListening, resetTranscript } = useVoiceRecognition();
  const { speak } = useTextToSpeech();
  // Updated to include conversation state management
  const { messages, addMessage, conversationState, setConversationState } = useChatStore();
  const { setOrder } = useOrderStore();
  
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [inputValue, setInputValue] = useState('');

  // Start listening on component mount
  useEffect(() => {
    startListening();
    return () => {
      stopListening();
      window.speechSynthesis.cancel();
    };
  }, [startListening, stopListening]);

  useEffect(() => {
    setAgentStatus(listening ? 'listening' : 'idle');
  }, [listening]);

  // Main logic to process user commands
  const processUserCommand = useCallback(async (command: string) => {
    if (!command) return;

    setAgentStatus('thinking');

    try {
      // Exclude functions from the order store state
      const { setOrder, clearCart, ...orderData } = useOrderStore.getState();

      const response = await axios.post('https://ai-agentic-kiosk-production.up.railway.app/api/orders/chat/', {
        message: command,
        history: messages.slice(-10), // Send last 10 messages
        currentState: orderData,       // Send current order state
        conversationState: conversationState, // Send current conversation state
      });

      // Destructure response data
      const { reply, currentOrder, conversationState: newConversationState } = response.data;

      // Add assistant's reply to chat and speak it
      addMessage({ sender: 'assistant', text: reply });
      speak(reply);
      setAgentStatus('speaking');

      // Update order state if it has changed
      if (currentOrder) {
        setOrder(currentOrder);
      }

      // Update conversation state if it has changed
      if (newConversationState) {
        setConversationState(newConversationState);
      }

      resetTranscript();

    } catch (error) {
      console.error("Error sending command to backend:", error);
      const errorText = "죄송합니다, 서버와 통신 중 오류가 발생했습니다.";
      addMessage({ sender: 'assistant', text: errorText });
      speak(errorText);
      setAgentStatus('idle');
      resetTranscript();
    }
  }, [messages, addMessage, setOrder, speak, resetTranscript, conversationState, setConversationState]);

  // Process voice recognition results
  useEffect(() => {
    if (transcript) {
      addMessage({ sender: 'user', text: transcript });
      processUserCommand(transcript);
    }
  }, [transcript, addMessage, processUserCommand]);

  // Process text input
  const handleTextInputSend = () => {
    if (!inputValue) return;
    addMessage({ sender: 'user', text: inputValue });
    processUserCommand(inputValue);
    setInputValue('');
  };

  // Handle order confirmation from OrderSummary
  const handleConfirmOrder = useCallback(() => {
    processUserCommand("결제할게요"); // Trigger payment intent
  }, [processUserCommand]);

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
          <OrderSummary onConfirmOrder={handleConfirmOrder} />
        </Grid>
      </Grid>
    </Container>
  );
};

export default MainPage;
