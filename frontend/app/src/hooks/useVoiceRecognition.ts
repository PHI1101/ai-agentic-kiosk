import { useState, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

const useVoiceRecognition = () => {
  const {
    transcript: originalTranscript, // 원래 transcript를 다른 이름으로 저장
    listening,
    resetTranscript: originalResetTranscript, // 원래 resetTranscript를 다른 이름으로 저장
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  const [transcript, setTranscript] = useState(originalTranscript); // 우리가 관리할 transcript
  const [resetTrigger, setResetTrigger] = useState(false); // resetTranscript 호출 여부

  // originalTranscript가 변경될 때마다 우리가 관리할 transcript를 업데이트
  useEffect(() => {
    if (!resetTrigger) { // resetTrigger가 true일 때는 업데이트하지 않음
      setTranscript(originalTranscript);
    }
  }, [originalTranscript, resetTrigger]);

  // resetTranscript를 래핑하여 resetTrigger를 설정
  const resetTranscriptAndTrigger = () => {
    setResetTrigger(true); // resetTranscript가 호출되었음을 알림
    setTranscript(''); // 즉시 빈 문자열로 설정
    originalResetTranscript(); // 원래 resetTranscript 호출
  };

  // originalTranscript가 비어있으면 resetTrigger를 해제 (새로운 음성 입력이 시작되었을 때)
  useEffect(() => {
    if (resetTrigger && originalTranscript === '') {
      setResetTrigger(false); // resetTrigger 해제
    }
  }, [originalTranscript, resetTrigger]);


  const startListening = () => SpeechRecognition.startListening({ continuous: true, language: 'ko-KR' });
  const stopListening = () => SpeechRecognition.stopListening();

  if (!browserSupportsSpeechRecognition) {
    console.error("Browser doesn't support speech recognition.");
    return {
      transcript: '', // 지원하지 않으면 항상 빈 문자열
      listening,
      startListening: () => {},
      stopListening: () => {},
      resetTranscript: () => {},
      hasRecognitionSupport: false
    };
  }

  return {
    transcript, // 우리가 관리하는 transcript 반환
    listening,
    startListening,
    stopListening,
    resetTranscript: resetTranscriptAndTrigger, // 래핑된 resetTranscript 반환
    hasRecognitionSupport: true
  };
};

export default useVoiceRecognition;

