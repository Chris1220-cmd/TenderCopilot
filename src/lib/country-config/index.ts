import type { CountryConfig } from './types';
import { grConfig } from './gr';
import { nlConfig } from './nl';

export type { CountryConfig, DocumentTypeConfig } from './types';

const CONFIGS: Record<string, CountryConfig> = {
  GR: grConfig,
  NL: nlConfig,
};

export const SUPPORTED_COUNTRIES = Object.values(CONFIGS).map(c => ({
  code: c.code,
  name: c.name,
  nameEn: c.nameEn,
}));

export function getCountryConfig(countryCode: string): CountryConfig {
  const config = CONFIGS[countryCode];
  if (!config) {
    throw new Error(`Unsupported country: ${countryCode}`);
  }
  return config;
}

export function getDefaultSourcesForCountries(countries: string[]): string[] {
  const sources = new Set<string>();
  for (const country of countries) {
    const config = CONFIGS[country];
    if (config) {
      config.defaultSourceIds.forEach(id => sources.add(id));
    }
  }
  return Array.from(sources);
}
