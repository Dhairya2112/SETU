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
  token: localStorage.getItem('pookie_token'),
  username: localStorage.getItem('pookie_preferred_name') || 'Agent',
  conversationId: localStorage.getItem('pookie_conversation_id') || (() => {
    const id = crypto.randomUUID();
    localStorage.setItem('pookie_conversation_id', id);
    return id;
  })(),
  eulaAccepted: localStorage.getItem('pookie_eula_accepted') === 'true',
  onboardingCompleted: localStorage.getItem('pookie_onboarding_completed') === 'true',

  setToken: (token) => {
    if (token) localStorage.setItem('pookie_token', token);
    else localStorage.removeItem('pookie_token');
    set({ token });
  },

  setUsername: (username) => {
    localStorage.setItem('pookie_preferred_name', username);
    set({ username });
  },

  setConversationId: (id) => {
    localStorage.setItem('pookie_conversation_id', id);
    set({ conversationId: id });
  },

  setEulaAccepted: (accepted) => {
    localStorage.setItem('pookie_eula_accepted', accepted ? 'true' : 'false');
    set({ eulaAccepted: accepted });
  },

  setOnboardingCompleted: (completed) => {
    localStorage.setItem('pookie_onboarding_completed', completed ? 'true' : 'false');
    set({ onboardingCompleted: completed });
  },

  logout: () => {
    localStorage.removeItem('pookie_token');
    localStorage.removeItem('pookie_conversation_id');
    localStorage.removeItem('pookie_onboarding_completed');
    localStorage.removeItem('pookie_eula_accepted');
    const newId = crypto.randomUUID();
    localStorage.setItem('pookie_conversation_id', newId);
    set({
      token: null,
      username: 'Agent',
      conversationId: newId,
      eulaAccepted: false,
      onboardingCompleted: false
    });
  }
}));
