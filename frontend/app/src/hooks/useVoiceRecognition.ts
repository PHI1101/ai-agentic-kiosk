import { useState, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

const useVoiceRecognition = (isVisuallyImpairedMode: boolean) => {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  const startListening = () => {
    if (browserSupportsSpeechRecognition) {
      SpeechRecognition.startListening({ continuous: isVisuallyImpairedMode, language: 'ko-KR' });
    }
  };

  const stopListening = () => {
    if (browserSupportsSpeechRecognition) {
      SpeechRecognition.stopListening();
    }
  };

  return {
    transcript,
    isListening: listening,
    startListening,
    stopListening,
    resetTranscript,
    hasSupport: browserSupportsSpeechRecognition,
  };
};

export default useVoiceRecognition;
