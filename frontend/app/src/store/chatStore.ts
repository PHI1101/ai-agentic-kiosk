import { create } from 'zustand';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

interface ChatState {
  messages: Message[];
  addMessage: (message: Message) => void;
}

const useChatStore = create<ChatState>((set) => ({
  messages: [{ sender: 'bot', text: '안녕하세요! 음성으로 주문을 시작해보세요.' }],
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
}));

export default useChatStore;
