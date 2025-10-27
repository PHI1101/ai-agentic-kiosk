import { useState, useEffect, useRef } from 'react';

interface VoiceRecognitionHook {
  transcript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  speak: (text: string) => void;
}

const useVoiceRecognition = (): VoiceRecognitionHook => {
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isContinuousListening = useRef(false); // New ref to track continuous listening intent

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) || !('speechSynthesis' in window)) {
      console.warn('Web Speech API is not supported by this browser.');
      return;
    }

    recognitionRef.current = new (window as any).webkitSpeechRecognition();
    if (recognitionRef.current) { // Add null check here
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'ko-KR';

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setTranscript(finalTranscript || interimTranscript);
      };

      recognitionRef.current.onend = () => {
        // Restart listening if continuous listening is intended
        if (isContinuousListening.current) { recognitionRef.current?.start(); }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error', event);
        // Restart listening if continuous listening is intended
        if (isContinuousListening.current) { recognitionRef.current?.start(); }
      };
    }

    synthRef.current = window.speechSynthesis;

    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript(''); // Reset transcript on start
      recognitionRef.current.start();
      setIsListening(true);
      isContinuousListening.current = true; // Set continuous listening intent
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      isContinuousListening.current = false; // Clear continuous listening intent
    }
  };

  const resetTranscript = () => {
    setTranscript('');
  };

  const speak = (text: string) => {
    if (synthRef.current) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      synthRef.current.speak(utterance);
    }
  };

  return { transcript, isListening, startListening, stopListening, resetTranscript, speak };
};

export default useVoiceRecognition;
