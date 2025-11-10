import { useCallback, useState, useRef } from 'react';

export const useTextToSpeech = () => {
  const [speaking, setSpeaking] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeakingRef = useRef(false); // New ref to track actual speaking status

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech API (Speech Synthesis) is not supported by this browser.');
      return;
    }

    window.speechSynthesis.cancel(); // Cancel any ongoing speech.

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.1;

    currentUtteranceRef.current = utterance; // Store the current utterance
    isSpeakingRef.current = true; // Mark that we intend to speak
    setSpeaking(true); // Immediately set speaking to true

    utterance.onstart = () => {
      // This might fire slightly after setSpeaking(true) above, but ensures consistency
      isSpeakingRef.current = true;
      setSpeaking(true);
    };

    utterance.onend = () => {
      if (currentUtteranceRef.current === utterance) {
        isSpeakingRef.current = false;
        setSpeaking(false);
        currentUtteranceRef.current = null;
      }
    };

    utterance.onerror = (event) => {
      if (event.error === 'interrupted') {
        console.info('SpeechSynthesisUtterance was interrupted as expected.');
      } else {
        console.error('SpeechSynthesisUtterance.onerror', event);
      }
      // If an error occurs, and it's the current utterance, and we were actually speaking,
      // then set speaking to false.
      if (currentUtteranceRef.current === utterance && isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setSpeaking(false);
        currentUtteranceRef.current = null;
      }
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak, speaking };
};
