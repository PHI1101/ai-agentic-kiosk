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

    
  },
}));

export default useChatStore;
