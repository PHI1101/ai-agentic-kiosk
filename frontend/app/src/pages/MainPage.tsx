import React, { useEffect, useState, useCallback } from 'react';
import { Container, Box, Grid } from '@mui/material';
import ChatInterface from '../components/ChatInterface';
import OrderSummary from '../components/OrderSummary';
import AiAgentAvatar, { AgentStatus } from '../components/AiAgentAvatar';
import useVoiceRecognition from '../hooks/useVoiceRecognition';
import { useChatStore } from '../store/chatStore';
import { useOrderStore } from '../store/orderStore';
import axios from 'axios';

const MainPage = () => {
  const { transcript, listening, startListening, stopListening, resetTranscript } = useVoiceRecognition();
  const { messages, addMessage, conversationState, setConversationState } = useChatStore();
  const { setOrder } = useOrderStore();
  
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [inputValue, setInputValue] = useState('');

  // Automatically start listening on component mount
  useEffect(() => {
    startListening();
    return () => {
      stopListening();
      window.speechSynthesis.cancel();
    };
  }, [startListening, stopListening]);

  // Update agent status based on listening state
  useEffect(() => {
    setAgentStatus(listening ? 'listening' : 'idle');
  }, [listening]);

  // Main logic to process user commands
  const processUserCommand = useCallback(async (command: string) => {
    if (!command) return;

    setAgentStatus('thinking');

    try {
      const { ...orderData } = useOrderStore.getState();

      const response = await axios.post('https://ai-agentic-kiosk-production.up.railway.app/api/orders/chat/', {
        message: command,
        history: messages.slice(-10),
        currentState: orderData,
        conversationState: conversationState,
      });

      const { reply, currentOrder, conversationState: newConversationState } = response.data;

      // Add assistant's reply to chat. Speaking is handled by ChatInterface.
      addMessage({ sender: 'assistant', text: reply });
      setAgentStatus('speaking'); // Status is now managed here, speaking is done in child

      if (currentOrder) {
        setOrder(currentOrder);
      }

      if (newConversationState) {
        setConversationState(newConversationState);
      }

      resetTranscript();

    } catch (error) {
      console.error("Error sending command to backend:", error);
      setAgentStatus('idle');
      let errorText = "죄송합니다, 서버와 통신 중 오류가 발생했습니다.";
      if (axios.isAxiosError(error) && error.response) {
        // More specific error handling can be added here
        errorText = `오류: ${error.response.data.error || error.response.data.detail || error.message}`;
      }
      addMessage({ sender: 'assistant', text: errorText });
      resetTranscript();
    }
  }, [messages, addMessage, resetTranscript, conversationState, setConversationState, setOrder]);

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
    processUserCommand("결제할게요");
  }, [processUserCommand]);

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Box sx={{ mb: 2, textAlign: 'center' }}>
            <AiAgentAvatar status={agentStatus} />
          </Box>
          <ChatInterface
            inputValue={inputValue}
            setInputValue={setInputValue}
            handleTextInputSend={handleTextInputSend}
            listening={listening}
            startListening={startListening}
            stopListening={stopListening}
          />
        </Grid>
        <Grid item xs={12} md={5}>
          <OrderSummary onConfirmOrder={handleConfirmOrder} />
        </Grid>
      </Grid>
    </Container>
  );
};

export default MainPage;