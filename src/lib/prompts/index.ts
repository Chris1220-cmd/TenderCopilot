import type { CountryPromptContext } from './types';
import { grPromptContext } from './gr';
import { nlPromptContext } from './nl';

export type { CountryPromptContext, ProposalSection } from './types';

const CONTEXTS: Record<string, CountryPromptContext> = {
  GR: grPromptContext,
  NL: nlPromptContext,
};

export function getPromptContext(countryCode: string): CountryPromptContext {
  return CONTEXTS[countryCode] ?? grPromptContext;
}
