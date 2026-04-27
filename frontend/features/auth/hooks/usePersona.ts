'use client';

import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';

export type Persona = 'consumer' | 'service_owner' | 'capability_manager' | 'admin';

const STORAGE_KEY = 's3c_preferred_persona';
const DEFAULT_PERSONA: Persona = 'service_owner';

function isPersona(value: string | null | undefined): value is Persona {
  return value === 'consumer' || value === 'service_owner' || value === 'capability_manager' || value === 'admin';
}

function readLocalPersona(): Persona {
  if (typeof window === 'undefined') return DEFAULT_PERSONA;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return isPersona(value) ? value : DEFAULT_PERSONA;
}

async function fetchPersona() {
  try {
    const response = await apiFetch<{ persona: Persona }>('/api/v1/auth/me/persona');
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, response.persona);
    return response;
  } catch {
    return { persona: readLocalPersona() };
  }
}

export function usePersona() {
  const { data, mutate, isLoading } = useSWR<{ persona: Persona }>('/api/v1/auth/me/persona', fetchPersona, {
    revalidateOnFocus: false,
    fallbackData: { persona: readLocalPersona() },
  });

  async function setPersona(persona: Persona) {
    const previous = data?.persona ?? readLocalPersona();
    await mutate({ persona }, false);
    try {
      const response = await fetch('/api/v1/auth/me/persona', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      });
      if (!response.ok) throw new Error(`Persona save failed: ${response.status}`);
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, persona);
      await mutate({ persona }, false);
    } catch {
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, previous);
      await mutate({ persona: previous }, false);
    }
  }

  return { persona: data?.persona ?? DEFAULT_PERSONA, setPersona, isLoading };
}
