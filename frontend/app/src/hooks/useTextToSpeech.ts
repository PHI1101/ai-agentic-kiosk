import { useCallback, useState, useRef } from 'react'; // Import useRef

export const useTextToSpeech = () => {
  const [speaking, setSpeaking] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null); // To track the current utterance

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech API (Speech Synthesis) is not supported by this browser.');
      return;
    }

    // Cancel any ongoing speech before starting a new one
    window.speechSynthesis.cancel();
    // If there was a previous utterance, ensure its onend/onerror handlers are cleaned up
    if (currentUtteranceRef.current) {
        currentUtteranceRef.current.onend = null;
        currentUtteranceRef.current.onerror = null;
    }
    setSpeaking(false); // Reset speaking state before starting new speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.1; // 약간 빠르게

    currentUtteranceRef.current = utterance; // Store the current utterance

    utterance.onstart = () => {
      setSpeaking(true);
    };

    utterance.onend = () => {
      if (currentUtteranceRef.current === utterance) { // Ensure it's the current utterance ending
        setSpeaking(false);
        currentUtteranceRef.current = null;
      }
    };

    utterance.onerror = (event) => {
      console.error('SpeechSynthesisUtterance.onerror', event);
      if (event.error !== 'interrupted' && currentUtteranceRef.current === utterance) { // Only set false if not interrupted and it's the current utterance
        setSpeaking(false);
        currentUtteranceRef.current = null;
      }
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak, speaking };
};
