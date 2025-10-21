import { useState, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

const useVoiceRecognition = () => {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    if (browserSupportsSpeechRecognition) {
      SpeechRecognition.startListening({ continuous: false, language: 'ko-KR' });
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (browserSupportsSpeechRecognition) {
      SpeechRecognition.stopListening();
      setIsListening(false);
    }
  };

  useEffect(() => {
    if (!listening && isListening) {
      // 음성 인식이 자동으로 멈췄을 때 상태 동기화
      setIsListening(false);
    }
  }, [listening, isListening]);

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    hasSupport: browserSupportsSpeechRecognition,
  };
};

export default useVoiceRecognition;
