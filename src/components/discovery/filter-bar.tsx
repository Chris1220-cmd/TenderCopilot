'use client';

import { Globe, Building2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type CountryFilter = 'GR' | 'EU' | 'international' | 'all';
export type EntityTypeFilter = 'public' | 'private' | 'all';

interface FilterBarProps {
  country: CountryFilter;
  entityType: EntityTypeFilter;
  relevanceOnly: boolean;
  onCountryChange: (v: CountryFilter) => void;
  onEntityTypeChange: (v: EntityTypeFilter) => void;
  onRelevanceOnlyChange: (v: boolean) => void;
}

const COUNTRY_OPTIONS: { value: CountryFilter; label: string }[] = [
  { value: 'GR', label: 'Ελλάδα' },
  { value: 'EU', label: 'Ευρώπη' },
  { value: 'international', label: 'Διεθνές' },
  { value: 'all', label: 'Όλες' },
];

const ENTITY_OPTIONS: { value: EntityTypeFilter; label: string }[] = [
  { value: 'all', label: 'Όλοι' },
  { value: 'public', label: 'Δημόσιοι' },
  { value: 'private', label: 'Ιδιωτικοί' },
];

export function FilterBar({
  country, entityType, relevanceOnly,
  onCountryChange, onEntityTypeChange, onRelevanceOnlyChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3">
      <div className="flex items-center gap-1">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground mr-1">Χώρα:</span>
        {COUNTRY_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={country === opt.value ? 'default' : 'ghost'}
            size="sm"
            className="h-7 cursor-pointer px-2 text-xs"
            onClick={() => onCountryChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground mr-1">Φορέας:</span>
        {ENTITY_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={entityType === opt.value ? 'default' : 'ghost'}
            size="sm"
            className="h-7 cursor-pointer px-2 text-xs"
            onClick={() => onEntityTypeChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <Target className="h-4 w-4 text-muted-foreground" />
        <Button
          variant={relevanceOnly ? 'default' : 'ghost'}
          size="sm"
          className="h-7 cursor-pointer px-2 text-xs"
          onClick={() => onRelevanceOnlyChange(!relevanceOnly)}
        >
          Μόνο ΚΑΔ matching
        </Button>
      </div>
    </div>
  );
}
