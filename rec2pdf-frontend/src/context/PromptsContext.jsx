import { createContext, useContext, useMemo } from 'react';
import { buildPromptIndex, normalizePromptEntry } from '../api/prompts.js';

const PromptsContext = createContext(null);

export function PromptsProvider({ prompts, children }) {
  const normalizedPrompts = useMemo(() => {
    if (!Array.isArray(prompts)) {
      return [];
    }
    const safePrompts = prompts.filter(Boolean);
    const alreadyNormalized = safePrompts.every(
      (prompt) => prompt && typeof prompt === 'object' && Object.prototype.hasOwnProperty.call(prompt, 'createdAtMs')
    );
    if (alreadyNormalized) {
      return safePrompts;
    }
    return safePrompts.map((prompt) => normalizePromptEntry(prompt)).filter(Boolean);
  }, [prompts]);

  const promptIndex = useMemo(() => buildPromptIndex(normalizedPrompts), [normalizedPrompts]);

  const value = useMemo(
    () => ({
      prompts: normalizedPrompts,
      promptsIndex: promptIndex,
      hasPrompts: normalizedPrompts.length > 0,
      getPromptById: (identifier) => {
        if (typeof identifier !== 'string') {
          return null;
        }
        const key = identifier.trim();
        if (!key) {
          return null;
        }
        return promptIndex.get(key) || null;
      },
    }),
    [normalizedPrompts, promptIndex]
  );

  return <PromptsContext.Provider value={value}>{children}</PromptsContext.Provider>;
}

export function usePromptsContext() {
  const context = useContext(PromptsContext);
  if (!context) {
    throw new Error('usePromptsContext must be used within a PromptsProvider');
  }
  return context;
}
