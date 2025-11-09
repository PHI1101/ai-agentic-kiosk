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
  setOrder: (order: OrderStateSnapshot | {}) => void;
  addItem: (item: Omit<OrderItem, 'quantity'>) => void; // quantity는 내부적으로 관리
  removeItem: (itemName: string) => void;
  clearOrder: () => void; // clearCart 대신 clearOrder로 변경
  calculateTotalPrice: () => number;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orderId: null,
  storeName: null,
  items: [],
  setOrder: (order) => {
    console.log('OrderStore: setOrder called with:', order);
    if (!order || Object.keys(order).length === 0) {
      set({
        orderId: null,
        storeName: null,
        items: [],
      });
      console.log('OrderStore: setOrder cleared state.');
    } else {
      const typedOrder = order as OrderStateSnapshot;
      set({
        orderId: typedOrder.orderId,
        storeName: typedOrder.storeName,
        items: typedOrder.items,
      });
      console.log('OrderStore: setOrder updated state to:', typedOrder);
    }
  },
  addItem: (item) =>
    set((state) => {
      const existingItemIndex = state.items.findIndex((i) => i.name === item.name);
      if (existingItemIndex > -1) {
        // If item exists, increase quantity
        const newItems = [...state.items];
        newItems[existingItemIndex].quantity += 1;
        return { items: newItems };
      } else {
        // If item does not exist, add it with quantity 1
        return { items: [...state.items, { ...item, quantity: 1 }] };
      }
    }),
  removeItem: (itemName) =>
    set((state) => {
      const existingItemIndex = state.items.findIndex((i) => i.name === itemName);
      if (existingItemIndex > -1) {
        const newItems = [...state.items];
        if (newItems[existingItemIndex].quantity > 1) {
          // If quantity > 1, decrease quantity
          newItems[existingItemIndex].quantity -= 1;
          return { items: newItems };
        } else {
          // If quantity is 1, remove item
          return { items: newItems.filter((i) => i.name !== itemName) };
        }
      }
      return {}; // No change if item not found
    }),
  clearOrder: () =>
    set({
      orderId: null,
      storeName: null,
      items: [],
    }),
  calculateTotalPrice: () =>
    get().items.reduce((total, item) => total + item.price * item.quantity, 0),
}));