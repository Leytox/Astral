import { Loader } from 'lucide-react';
import { ReactNode, useSyncExternalStore } from 'react';

import { useAuthStore } from '../store/useAuthStore';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const isHydrated = useSyncExternalStore(
    (callback) => useAuthStore.persist.onFinishHydration(callback),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );

  if (!isHydrated) return <Loader size={48} className="animate-spin" />;

  return <>{children}</>;
}
