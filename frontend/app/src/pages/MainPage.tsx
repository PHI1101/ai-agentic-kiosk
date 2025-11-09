import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Box, Grid, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ChatInterface from '../components/ChatInterface';
import OrderSummary from '../components/OrderSummary';
import AiAgentAvatar, { AgentStatus } from '../components/AiAgentAvatar';
import useVoiceRecognition from '../hooks/useVoiceRecognition';
import { useChatStore } from '../store/chatStore';
import { useOrderStore } from '../store/orderStore';
import { useTextToSpeech } from '../hooks/useTextToSpeech'; // Import useTextToSpeech
import axios from 'axios';

const MainPage = () => {
  const navigate = useNavigate();
  const { transcript, listening, startListening, stopListening, resetTranscript } = useVoiceRecognition();
  const { messages, addMessage } = useChatStore();
  // No need to select state here, as we use getState() in callbacks
  const { speak, speaking } = useTextToSpeech();
  
  const [conversationState, setConversationState] = useState<any>({});
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [inputValue, setInputValue] = useState('');
  const processedTranscriptRef = useRef<string | null>(null);

  useEffect(() => {
    if (speaking) {
      setAgentStatus('speaking');
    } else {
      setAgentStatus(listening ? 'listening' : 'idle');
    }
  }, [listening, speaking]);

  const processUserCommand = useCallback(async (command: string) => {
    if (!command) return;

    setAgentStatus('thinking');
    try {
      // Get the latest state directly from the store to avoid stale state issues
      const { orderId, storeName, items } = useOrderStore.getState();
      const orderData = { orderId, storeName, items };

      const response = await axios.post('https://ai-agentic-kiosk-production.up.railway.app/api/orders/chat/', {
        message: command,
        history: messages.slice(-10),
        currentState: orderData,
        conversationState: conversationState,
      });

      const { reply, currentOrder, conversationState: newConversationState, action } = response.data;

      if (currentOrder) {
        // setOrder is the action from the store, it's safe to call
        useOrderStore.getState().setOrder(currentOrder);
      }

      if (newConversationState) {
        setConversationState(newConversationState);
      }

      addMessage({ sender: 'assistant', text: reply });
      setAgentStatus('speaking');
      speak(reply); // Now speak is available

      // Navigate to payment page if backend requests it
      if (action === 'navigate_to_payment') {
        navigate('/payment');
      } else if (action === 'navigate_to_order') { // Added for payment_cancel action
        navigate('/order');
      }

      resetTranscript();

    } catch (error) {
      console.error("Error sending command to backend:", error);
      setAgentStatus('idle');
      let errorText = "죄송합니다, 서버와 통신 중 오류가 발생했습니다.";
      if (axios.isAxiosError(error) && error.response) {
        errorText = `오류: ${error.response.data.error || error.response.data.detail || error.message}`;
      }
      addMessage({ sender: 'assistant', text: errorText });
      resetTranscript();
    }
  }, [messages, addMessage, resetTranscript, conversationState, navigate, speak]); // Simplified dependency array

  useEffect(() => {
    if (!listening && transcript && transcript !== processedTranscriptRef.current) {
      addMessage({ sender: 'user', text: transcript });
      processUserCommand(transcript);
      processedTranscriptRef.current = transcript;
    }
    if (!listening && !transcript && processedTranscriptRef.current) {
        processedTranscriptRef.current = null;
    }
  }, [listening, transcript, addMessage, processUserCommand]);

  const handleTextInputSend = () => {
    if (!inputValue) return;
    addMessage({ sender: 'user', text: inputValue });
    processUserCommand(inputValue);
    setInputValue('');
  };

  const handleToggleListening = () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

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
          <ChatInterface />
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
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
            <IconButton color={listening ? "error" : "primary"} onClick={handleToggleListening}>
              {listening ? <MicOffIcon /> : <MicIcon />}
            </IconButton>
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
