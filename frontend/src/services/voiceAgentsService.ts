export interface VoiceAgent {
  id: string;
  name: string;
  type: 'sofia_insurance' | 'juan_ai' | 'generic';
  description?: string;
}

// En el futuro, integrar con backend. Por ahora, fuente centralizada y extensible
const DEFAULT_AGENTS: VoiceAgent[] = [
  { id: 'agent-1', name: 'Sofia Seguros', type: 'sofia_insurance', description: 'Agente para cobranza y renovación de pólizas' },
  { id: 'agent-2', name: 'Juan AI', type: 'juan_ai', description: 'Agente comercial para prospección y ventas' },
  { id: 'agent-3', name: 'Agente General', type: 'generic', description: 'Agente genérico para tareas generales' },
];

export async function getCustomAgents(): Promise<VoiceAgent[]> {
  try {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('custom_voice_agents') : null;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return DEFAULT_AGENTS;
}

export async function saveCustomAgents(agents: VoiceAgent[]): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('custom_voice_agents', JSON.stringify(agents));
    }
  } catch {}
}


