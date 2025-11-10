/* eslint-disable @typescript-eslint/no-unused-vars */
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
import VoiceInputIndicator from '../components/VoiceInputIndicator';
import { useTextToSpeech } from '../hooks/useTextToSpeech'; // Import useTextToSpeech
import axios from 'axios';

const MainPage = () => {
  const navigate = useNavigate();
  const { transcript, listening, startListening, stopListening, resetTranscript } = useVoiceRecognition();
  const { messages, addMessage } = useChatStore();
  // No need to select state here, as we use getState() in callbacks
  const { speak, speaking } = useTextToSpeech(); // Import useTextToSpeech // eslint-disable-line @typescript-eslint/no-unused-vars
  
  const [conversationState, setConversationState] = useState<any>({});
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [inputValue, setInputValue] = useState('');
  const processedTranscriptRef = useRef<string | null>(null);
  const wasListeningBeforeTTS = useRef(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For silence detection // eslint-disable-line @typescript-eslint/no-unused-vars
  const userManuallyStoppedListeningRef = useRef(false); // New ref to track manual stop
  const SPEECH_PAUSE_THRESHOLD_MS = 1500; // 1.5 seconds of silence to consider speech ended // eslint-disable-line @typescript-eslint/no-unused-vars

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

      // Reset manual stop state before AI speaks, allowing listening to resume automatically after.
      userManuallyStoppedListeningRef.current = false;
      addMessage({ sender: 'assistant', text: reply });
      setAgentStatus('speaking');
      speak(reply);

      // Navigate to payment page if backend requests it
      if (action === 'navigate_to_payment') {
        navigate('/payment');
      } else if (action === 'navigate_to_order') { // Added for payment_cancel action
        navigate('/order');
      }

      resetTranscript();
      setInputValue(''); // Clear the input field after processing voice command

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
  }, [messages, addMessage, resetTranscript, conversationState, navigate, speak]);

  // This effect is responsible for processing the transcript after a pause in speech.
  useEffect(() => {
    if (transcript && !speaking) {
      // Clear any existing timeout to reset the pause detection.
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }

      // Set a new timeout to process the command after a pause.
      speechTimeoutRef.current = setTimeout(() => {
        // Check if the transcript has already been processed to avoid duplicates.
        if (transcript !== processedTranscriptRef.current) {
          console.log(`[Silence Detection] User paused. Processing command: "${transcript}"`);
          
          // Mark the transcript as processed.
          processedTranscriptRef.current = transcript;
          
          // Stop listening to finalize the current speech input.
          stopListening();
          
          // Add the user's message to the chat and send it to the backend.
          addMessage({ sender: 'user', text: transcript });
          processUserCommand(transcript);
          setInputValue(''); // Clear the input field after processing voice command
        }
      }, SPEECH_PAUSE_THRESHOLD_MS);
    }

    // Cleanup function to clear the timeout when the component unmounts or dependencies change.
    return () => {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }
    };
  }, [transcript, speaking, stopListening, addMessage, processUserCommand]);

  // Original useEffect for processing transcript (Problem 1) - now simplified
  useEffect(() => {
    if (!listening && !transcript && processedTranscriptRef.current) {
        console.log("[Transcript Processing] Clearing processedTranscriptRef.");
        processedTranscriptRef.current = null;
    }
  }, [listening, transcript]);

  const handleTextInputSend = () => {
    if (!inputValue) return;
    addMessage({ sender: 'user', text: inputValue });
    processUserCommand(inputValue);
    setInputValue('');
  };

  const handleToggleListening = () => {
    if (listening) {
      console.log("[Manual Control] User stopped listening.");
      userManuallyStoppedListeningRef.current = true;
      stopListening();
    } else {
      console.log("[Manual Control] User started listening.");
      userManuallyStoppedListeningRef.current = false;
      startListening();
    }
  };

  const handleConfirmOrder = useCallback(() => {
    processUserCommand("결제할게요");
  }, [processUserCommand]);

  // Effect for the initial greeting message.
  useEffect(() => {
    const initialMessage = messages[0];
    if (initialMessage && initialMessage.sender === 'assistant') {
      speak(initialMessage.text);
      // Ensure that after the initial message, the system is ready to listen.
      userManuallyStoppedListeningRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, speak]); // messages와 speak를 의존성 배열에 추가

  // 컴포넌트 마운트 시 inputValue 초기화
  useEffect(() => {
    setInputValue('');
  }, []);

  // This effect manages the interplay between speaking and listening.
  useEffect(() => {
    if (speaking) {
      // If the AI is speaking, always stop listening.
      if (listening) {
        console.log("[Auto-Stop] Assistant is speaking. Stopping listening.");
        stopListening();
      }
    } else {
      // If the AI has finished speaking and the user hasn't manually stopped the mic, start listening.
      if (!listening && !userManuallyStoppedListeningRef.current) {
        console.log("[Auto-Start] Assistant finished speaking. Starting listening after a short delay.");
        
        // AI 발화 텍스트 길이에 따라 딜레이 계산
        const lastMessage = messages[messages.length - 1];
        let calculatedDelay = 1000; // 기본 딜레이 1초

        if (lastMessage && lastMessage.sender === 'assistant') {
          const textLength = lastMessage.text.length;
          // 텍스트 길이에 비례하여 딜레이 계산 (예: 10자당 1초)
          // Math.max(1000, ...) : 최소 1초
          // Math.min(..., 15000) : 최대 15초
          calculatedDelay = Math.max(1000, Math.min(textLength * 100, 15000));
        }
        
        const timer = setTimeout(() => {
          startListening();
        }, calculatedDelay);
        return () => clearTimeout(timer); // Cleanup on unmount or re-render
      }
    }
  }, [speaking, listening, startListening, stopListening, messages.length]); // messages.length를 의존성 배열에 추가

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <VoiceInputIndicator listening={listening} onStop={handleToggleListening} />
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
            <IconButton color={listening ? "primary" : "error"} onClick={handleToggleListening}>
              {listening ? <MicIcon /> : <MicOffIcon />}
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
/* eslint-enable @typescript-eslint/no-unused-vars */
