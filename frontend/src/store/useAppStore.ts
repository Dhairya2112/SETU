import { create } from 'zustand';

interface AppState {
  token: string | null;
  username: string;
  conversationId: string;
  eulaAccepted: boolean;
  onboardingCompleted: boolean;
  setToken: (token: string | null) => void;
  setUsername: (username: string) => void;
  setConversationId: (id: string) => void;
  setEulaAccepted: (accepted: boolean) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  token: localStorage.getItem('setu_token'),
  username: localStorage.getItem('setu_preferred_name') || 'Agent',
  conversationId: localStorage.getItem('setu_conversation_id') || (() => {
    const id = crypto.randomUUID();
    localStorage.setItem('setu_conversation_id', id);
    return id;
  })(),
  eulaAccepted: localStorage.getItem('setu_eula_accepted') === 'true',
  onboardingCompleted: localStorage.getItem('setu_onboarding_completed') === 'true',

  setToken: (token) => {
    if (token) localStorage.setItem('setu_token', token);
    else localStorage.removeItem('setu_token');
    set({ token });
  },

  setUsername: (username) => {
    localStorage.setItem('setu_preferred_name', username);
    set({ username });
  },

  setConversationId: (id) => {
    localStorage.setItem('setu_conversation_id', id);
    set({ conversationId: id });
  },

  setEulaAccepted: (accepted) => {
    localStorage.setItem('setu_eula_accepted', accepted ? 'true' : 'false');
    set({ eulaAccepted: accepted });
  },

  setOnboardingCompleted: (completed) => {
    localStorage.setItem('setu_onboarding_completed', completed ? 'true' : 'false');
    set({ onboardingCompleted: completed });
  },

  logout: () => {
    localStorage.removeItem('setu_token');
    localStorage.removeItem('setu_conversation_id');
    localStorage.removeItem('setu_onboarding_completed');
    localStorage.removeItem('setu_eula_accepted');
    const newId = crypto.randomUUID();
    localStorage.setItem('setu_conversation_id', newId);
    set({
      token: null,
      username: 'Agent',
      conversationId: newId,
      eulaAccepted: false,
      onboardingCompleted: false
    });
  }
}));
