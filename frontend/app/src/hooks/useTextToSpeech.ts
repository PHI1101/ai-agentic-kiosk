import { useCallback, useState, useRef } from 'react';

export const useTextToSpeech = () => {
  const [speaking, setSpeaking] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech API (Speech Synthesis) is not supported by this browser.');
      return;
    }

    window.speechSynthesis.cancel(); // Cancel any ongoing speech.
    setSpeaking(false); // Ensure speaking is false before starting new speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.1;

    currentUtteranceRef.current = utterance;

    utterance.onstart = () => {
      setSpeaking(true); // Set speaking to true only when speech actually starts
    };

    utterance.onend = () => {
      if (currentUtteranceRef.current === utterance) {
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
      // If an error occurs, and it's the current utterance, set speaking to false.
      if (currentUtteranceRef.current === utterance) {
        setSpeaking(false);
        currentUtteranceRef.current = null;
      }
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak, speaking };
};
