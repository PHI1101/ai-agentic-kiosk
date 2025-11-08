import { useCallback, useState } from 'react';

export const useTextToSpeech = () => {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech API (Speech Synthesis) is not supported by this browser.');
      return;
    }

    window.speechSynthesis.cancel(); // 진행 중인 모든 발화 취소
    setSpeaking(false); // 새로운 발화 시작 전 speaking 상태 초기화

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.1; // 약간 빠르게

    utterance.onstart = () => {
      setSpeaking(true);
    };

    utterance.onend = () => {
      setSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('SpeechSynthesisUtterance.onerror', event);
      setSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak, speaking };
};
