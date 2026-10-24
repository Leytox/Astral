import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type AuthState = {
  accessToken: string;
  isAuthenticated: boolean;
  setAuthenticated: (authenticated: boolean) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: '',
      isAuthenticated: false,
      setAuthenticated: (authenticated: boolean) =>
        set({ isAuthenticated: authenticated }),
      setAccessToken: (token: string) => set({ accessToken: token }),
      logout: () => set({ accessToken: '', isAuthenticated: false }),
      getAccessToken: () => get().accessToken,
    }),
    { name: 'auth', storage: createJSONStorage(() => localStorage) },
  ),
);
