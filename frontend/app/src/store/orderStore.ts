import {create} from 'zustand';

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface OrderState {
  items: OrderItem[];
  totalPrice: number;
  addItem: (item: Omit<OrderItem, 'quantity'>) => void;
  removeItem: (itemName: string) => void;
  clearCart: () => void;
}

const calculateTotalPrice = (items: OrderItem[]) => {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
};

export const useOrderStore = create<OrderState>((set) => ({
  items: [],
  totalPrice: 0,
  addItem: (newItem) =>
    set((state) => {
      const existingItem = state.items.find((item) => item.name === newItem.name);
      let updatedItems;
      if (existingItem) {
        updatedItems = state.items.map((item) =>
          item.name === newItem.name ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        updatedItems = [...state.items, { ...newItem, quantity: 1 }];
      }
      return {
        items: updatedItems,
        totalPrice: calculateTotalPrice(updatedItems),
      };
    }),
  removeItem: (itemName) =>
    set((state) => {
      const updatedItems = state.items.filter((item) => item.name !== itemName);
      return {
        items: updatedItems,
        totalPrice: calculateTotalPrice(updatedItems),
      };
    }),
  clearCart: () => set({ items: [], totalPrice: 0 }),
}));
