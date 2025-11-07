import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

const useVoiceRecognition = () => {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const startListening = () => SpeechRecognition.startListening({ continuous: true, language: 'ko-KR' });
  const stopListening = () => SpeechRecognition.stopListening();

  if (!browserSupportsSpeechRecognition) {
    console.error("Browser doesn't support speech recognition.");
    return {
      transcript,
      listening,
      startListening: () => {},
      stopListening: () => {},
      resetTranscript,
      hasRecognitionSupport: false
    };
  }

  return {
    transcript,
    listening,
    startListening,
    stopListening,
    resetTranscript,
    hasRecognitionSupport: true
  };
};

export default useVoiceRecognition;

