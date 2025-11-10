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
  const wasListeningBeforeTTS = useRef(false);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For silence detection
  const SPEECH_PAUSE_THRESHOLD_MS = 1500; // 1.5 seconds of silence to consider speech ended

  // Start listening on component mount for accessibility
  useEffect(() => {
    console.log("[MainPage Mount] Calling startListening()");
    startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect to handle STT <> TTS interaction
  useEffect(() => {
    console.log(`[STT/TTS Effect] speaking: ${speaking}, listening: ${listening}, wasListeningBeforeTTS.current: ${wasListeningBeforeTTS.current}`);

    // When TTS starts speaking
    if (speaking) {
      // Clear any speech timeout if TTS starts
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }

      // If STT was listening when speak() was called, and it's still listening, stop it.
      // wasListeningBeforeTTS.current is set in processUserCommand before speak()
      if (wasListeningBeforeTTS.current && listening) {
        console.log("[STT/TTS Effect] TTS started, STT was listening. Stopping STT.");
        stopListening();
      }
    }
    // When TTS stops speaking
    else {
      // If STT was listening before TTS started (and was stopped by TTS), reactivate it.
      if (wasListeningBeforeTTS.current) {
        console.log("[STT/TTS Effect] TTS finished, STT was listening before. Restarting STT.");
        startListening();
        wasListeningBeforeTTS.current = false; // Reset the flag
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speaking]);

  // Effect for silence detection and automatic submission (Problem 3)
  useEffect(() => {
    if (listening && transcript) {
      // Clear any existing timeout
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }

      // Set a new timeout
      speechTimeoutRef.current = setTimeout(() => {
        console.log("[Silence Detection] Speech paused, stopping listening for processing.");
        stopListening(); // This will trigger the processing useEffect
      }, SPEECH_PAUSE_THRESHOLD_MS);
    } else if (!listening && speechTimeoutRef.current) {
      // If listening stops, clear the timeout
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }

    return () => {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }
    };
  }, [listening, transcript, stopListening]); // Add stopListening to dependencies

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
      // Capture listening state before speak() is called
      wasListeningBeforeTTS.current = listening; // <--- Set here

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
  }, [messages, addMessage, resetTranscript, conversationState, navigate, speak, listening]); // Added 'listening' to dependencies

  // Original useEffect for processing transcript (Problem 1)
  useEffect(() => {
    if (!listening && transcript && transcript !== processedTranscriptRef.current) {
      console.log("[Transcript Processing] Processing new transcript:", transcript);
      addMessage({ sender: 'user', text: transcript });
      processUserCommand(transcript);
      processedTranscriptRef.current = transcript;
    }
    if (!listening && !transcript && processedTranscriptRef.current) {
        console.log("[Transcript Processing] Clearing processedTranscriptRef.");
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
