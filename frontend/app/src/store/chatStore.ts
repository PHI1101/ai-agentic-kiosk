import { create } from 'zustand';

// Type definitions
export interface Message {
  sender: 'user' | 'bot';
  text: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface CurrentOrder {
  orderId: number | null;
  storeName: string | null;
  items: OrderItem[];
  totalPrice: number;
  status: string;
}

// 스토어의 상태 타입을 정의합니다.
interface ChatState {
  messages: Message[];
  currentOrder: CurrentOrder | null;
  addMessage: (message: Message) => void;
  setCurrentOrder: (order: CurrentOrder | null) => void;
}

// Zustand 스토어를 생성합니다.
const useChatStore = create<ChatState>((set) => ({
  messages: [],
  currentOrder: null,
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setCurrentOrder: (order) => set({ currentOrder: order }),
}));

export default useChatStore;
