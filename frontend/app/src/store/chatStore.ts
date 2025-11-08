import { create } from 'zustand';

// Represents a single message in the chat history
interface Message {
  sender: 'user' | 'assistant'; // Changed 'bot' to 'assistant' to match backend role
  text: string;
}

// Represents the state of the conversation context
interface ConversationState {
  last_inquired_category?: string;
  presented_stores?: string[];
  [key: string]: any; // Allows for other dynamic properties
}

// Defines the overall state managed by the chat store
interface ChatState {
  messages: Message[];
  conversationState: ConversationState;
  addMessage: (message: Message) => void;
  setConversationState: (newState: ConversationState) => void;
}

/**
 * Zustand store for managing the chat interface state.
 *
 * @property {Message[]} messages - The list of messages in the chat.
 * @property {ConversationState} conversationState - The context of the ongoing conversation.
 * @function addMessage - Adds a new message to the chat history.
 * @function setConversationState - Updates the conversation context.
 */
export const useChatStore = create<ChatState>((set) => ({
  // Initial state
  messages: [{ sender: 'assistant', text: '안녕하세요! 음성으로 주문을 시작해보세요.' }],
  conversationState: {},

  // Action to add a message
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  // Action to set the conversation state
  setConversationState: (newState) =>
    set(() => ({ conversationState: newState })),
}));
