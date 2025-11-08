import { create } from 'zustand';

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

// Backend에서 오는 전체 주문 상태를 위한 타입
export interface OrderStateSnapshot {
  orderId: number;
  storeName: string;
  items: OrderItem[];
  totalPrice: number;
  status: string;
}

interface OrderState {
  orderId: number | null;
  storeName: string | null;
  items: OrderItem[];
  totalPrice: number;
  status: string | null;
  setOrder: (order: OrderStateSnapshot | {}) => void; // 백엔드 상태로 업데이트하는 함수, 빈 객체도 허용
  clearCart: () => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orderId: null,
  storeName: null,
  items: [],
  totalPrice: 0,
  status: null,
  setOrder: (order) => {
    if (!order || Object.keys(order).length === 0) { // If order is empty or null, clear the cart
      set({
        orderId: null,
        storeName: null,
        items: [],
        totalPrice: 0,
        status: null,
      });
    } else {
      // Type assertion to treat 'order' as OrderStateSnapshot
      const typedOrder = order as OrderStateSnapshot;
      set({
        orderId: typedOrder.orderId,
        storeName: typedOrder.storeName,
        items: typedOrder.items,
        totalPrice: typedOrder.totalPrice,
        status: typedOrder.status,
      });
    }
  },
  clearCart: () => set({ 
    orderId: null,
    storeName: null,
    items: [], 
    totalPrice: 0, 
    status: null 
  }),
}));