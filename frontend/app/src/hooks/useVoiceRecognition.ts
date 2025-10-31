import { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceRecognitionHook {
  transcript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
}

// Define the props for the hook, including the onSend callback
interface VoiceRecognitionProps {
  onSend: (transcript: string) => void;
}

const useVoiceRecognition = ({ onSend }: VoiceRecognitionProps): VoiceRecognitionHook => {
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  
  // Ref to hold the timer for silence detection
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to hold the final transcript that accumulates
  const finalTranscriptRef = useRef<string>('');

  const speak = useCallback((text: string) => {
    if (synthRef.current) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      synthRef.current.speak(utterance);
    }
  }, []);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) || !('speechSynthesis' in window)) {
      console.warn('Web Speech API is not supported by this browser.');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ko-KR';
    recognitionRef.current = recognition;

    synthRef.current = window.speechSynthesis;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Clear the silence timer on any new result
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      // Update the display with the latest transcript (final + interim)
      setTranscript(finalTranscriptRef.current + interimTranscript);

      // Set a new timer to send the message after 1.5s of silence
      silenceTimerRef.current = setTimeout(() => {
        if (finalTranscriptRef.current) {
          onSend(finalTranscriptRef.current.trim());
          finalTranscriptRef.current = ''; // Reset the final transcript
          setTranscript(''); // Reset the display transcript
        }
      }, 1500);
    };

    recognition.onend = () => {
      if (isListening) {
        recognition.start();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error', event);
      if (isListening) {
        recognition.start(); // Attempt to restart on error if still supposed to be listening
      }
    };

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      recognition.stop();
    };
  }, [isListening, onSend]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      finalTranscriptRef.current = '';
      setTranscript('');
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      setIsListening(false);
      recognitionRef.current.stop();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    }
  };

  return { transcript, isListening, startListening, stopListening, speak };
};

export default useVoiceRecognition;
