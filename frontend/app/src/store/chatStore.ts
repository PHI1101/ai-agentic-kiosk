import { create } from 'zustand';

// 메시지 타입을 정의합니다.
export interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
}

// 스토어의 상태 타입을 정의합니다.
interface ChatState {
  messages: Message[];
  addMessage: (message: Omit<Message, 'id'>) => void;
}

// Zustand 스토어를 생성합니다.
const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (message) => {
    // Add the incoming message to the state
    set((state) => ({
      messages: [...state.messages, { ...message, id: state.messages.length }],
    }));

    // If the message is from the user, simulate an AI response for testing TTS
    // if (message.sender === 'user') {
    //   setTimeout(() => {
    //     const aiResponse = `"${message.text}" 라고 말씀하셨네요.`;
    //     set((state) => ({
    //       messages: [
    //         ...state.messages,
    //         { id: state.messages.length, text: aiResponse, sender: 'ai' },
    //       ],
    //     }));
    //   }, 1000); // 1-second delay
    // }
  },
}));

export default useChatStore;
