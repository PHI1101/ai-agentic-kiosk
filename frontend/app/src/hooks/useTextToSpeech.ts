import { useCallback, useState, useRef } from 'react';

export const useTextToSpeech = () => {
  const [speaking, setSpeaking] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech API (Speech Synthesis) is not supported by this browser.');
      return;
    }

    // Cancel any ongoing speech. This will trigger onend/onerror for the *previous* utterance.
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.1;

    currentUtteranceRef.current = utterance; // Store the current utterance

    utterance.onstart = () => {
      setSpeaking(true);
    };

    utterance.onend = () => {
      // Only set speaking to false if this is the utterance that is currently active
      if (currentUtteranceRef.current === utterance) {
        setSpeaking(false);
        currentUtteranceRef.current = null;
      }
    };

    utterance.onerror = (event) => {
      console.error('SpeechSynthesisUtterance.onerror', event);
      // Only set speaking to false if this is the utterance that is currently active
      // and the error is not 'interrupted' (which can happen if cancel() was called on it)
      if (currentUtteranceRef.current === utterance && event.error !== 'interrupted') {
        setSpeaking(false);
        currentUtteranceRef.current = null;
      }
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak, speaking };
};
