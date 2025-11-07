import { useCallback } from 'react';

export const useTextToSpeech = () => {
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Web Speech API (Speech Synthesis) is not supported by this browser.');
      return;
    }

    // 진행 중인 모든 발화 취소
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.1; // 약간 빠르게
    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak };
};
