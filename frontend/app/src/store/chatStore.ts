import { create } from 'zustand';

export interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface OrderState {
  orderId: number | null;
  storeName: string;
  items: OrderItem[];
  totalPrice: number;
  status: 'idle' | 'pending' | 'confirmed';
}

interface ChatState {
  messages: Message[];
  currentOrder: OrderState;
  addMessage: (message: Omit<Message, 'id'>) => void;
  setCurrentOrder: (order: OrderState) => void;
}

const useChatStore = create<ChatState>((set) => ({
  messages: [],
  currentOrder: {
    orderId: null,
    storeName: '',
    items: [],
    totalPrice: 0,
    status: 'idle',
  },
  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, { ...message, id: state.messages.length }],
    }));
  },
  setCurrentOrder: (order) => {
    set({ currentOrder: order });
  },
}));

export default useChatStore;