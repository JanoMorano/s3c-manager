'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { usePersona as usePersonaHook, type Persona } from './hooks/usePersona';

const PersonaContext = createContext<ReturnType<typeof usePersonaHook> | null>(null);
const DEFAULT_PERSONA: Persona = 'service_owner';

function PublicPersonaProvider({ children }: { children: ReactNode }) {
  return (
    <PersonaContext.Provider value={{
      persona: DEFAULT_PERSONA,
      setPersona: async () => {},
      isLoading: false,
    }}>
      {children}
    </PersonaContext.Provider>
  );
}

function AuthenticatedPersonaProvider({ children }: { children: ReactNode }) {
  const value = usePersonaHook();
  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

export function PersonaProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  if (pathname.startsWith('/install') || pathname.startsWith('/login')) {
    return <PublicPersonaProvider>{children}</PublicPersonaProvider>;
  }
  return <AuthenticatedPersonaProvider>{children}</AuthenticatedPersonaProvider>;
}

export function usePersonaContext() {
  const value = useContext(PersonaContext);
  if (!value) return usePersonaHook();
  return value;
}

export type { Persona };
