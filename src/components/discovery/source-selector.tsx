'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Factory, Globe, Search, Briefcase, Flag,
  ChevronDown, ChevronRight, Loader2,
} from 'lucide-react';
import type { TenderSource } from '@/data/tender-sources';

const categoryIcons: Record<string, React.ReactNode> = {
  public: <Building2 className="h-4 w-4" />,
  deko: <Factory className="h-4 w-4" />,
  eu: <Globe className="h-4 w-4" />,
  eu_member: <Flag className="h-4 w-4" />,
  private: <Briefcase className="h-4 w-4" />,
};

interface SourceSelectorProps {
  sources: TenderSource[];
  categories: readonly { id: string; label: string }[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onSearch: () => void;
  isLoading: boolean;
  minBudget: string;
  maxBudget: string;
  onMinBudgetChange: (v: string) => void;
  onMaxBudgetChange: (v: string) => void;
}

export function SourceSelector({
  sources, categories, selectedIds, onSelectionChange,
  onSearch, isLoading,
  minBudget, maxBudget, onMinBudgetChange, onMaxBudgetChange,
}: SourceSelectorProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSource = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter(s => s !== id)
        : [...selectedIds, id]
    );
  };

  const toggleCategory = (categoryId: string) => {
    const catSourceIds = sources.filter(s => s.category === categoryId).map(s => s.id);
    const allSelected = catSourceIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      onSelectionChange(selectedIds.filter(id => !catSourceIds.includes(id)));
    } else {
      onSelectionChange(Array.from(new Set([...selectedIds, ...catSourceIds])));
    }
  };

  return (
    <div className="w-64 shrink-0">
      <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 space-y-3 sticky top-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Πηγές Αναζήτησης</h3>
          <Badge variant="outline" className="text-[10px]">
            {selectedIds.length}/{sources.length}
          </Badge>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] cursor-pointer"
            onClick={() => onSelectionChange(sources.map(s => s.id))}
          >
            Όλες
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] cursor-pointer"
            onClick={() => onSelectionChange([])}
          >
            Καμία
          </Button>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {categories.map(cat => {
            const catSources = sources.filter(s => s.category === cat.id);
            const selectedCount = catSources.filter(s => selectedIds.includes(s.id)).length;
            const isCollapsed = collapsed[cat.id] ?? false;

            return (
              <div key={cat.id}>
                <button
                  onClick={() => setCollapsed(p => ({ ...p, [cat.id]: !p[cat.id] }))}
                  className="flex items-center gap-2 w-full text-left cursor-pointer hover:bg-muted/30 rounded px-1 py-1 transition-colors"
                >
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {categoryIcons[cat.id]}
                  <span className="text-xs font-medium flex-1">{cat.label}</span>
                  <span className="text-[10px] text-muted-foreground">{selectedCount}/{catSources.length}</span>
                </button>

                {!isCollapsed && (
                  <div className="ml-5 mt-1 space-y-0.5">
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="text-[10px] text-blue-500 hover:text-blue-400 cursor-pointer mb-1"
                    >
                      {selectedCount === catSources.length ? 'Αποεπιλογή όλων' : 'Επιλογή όλων'}
                    </button>
                    {catSources.map(source => (
                      <label key={source.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/20 rounded px-1 py-0.5">
                        <Checkbox
                          checked={selectedIds.includes(source.id)}
                          onCheckedChange={() => toggleSource(source.id)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-xs">{source.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Budget filters */}
        <div className="border-t border-border/30 pt-3 space-y-2">
          <Label className="text-xs text-muted-foreground">Προϋπολογισμός (€)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Από"
              value={minBudget}
              onChange={e => onMinBudgetChange(e.target.value)}
              className="h-7 text-xs"
              type="number"
            />
            <Input
              placeholder="Έως"
              value={maxBudget}
              onChange={e => onMaxBudgetChange(e.target.value)}
              className="h-7 text-xs"
              type="number"
            />
          </div>
        </div>

        {/* Search button */}
        <Button
          onClick={onSearch}
          disabled={isLoading || selectedIds.length === 0}
          className="w-full cursor-pointer gap-2"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Αναζήτηση ({selectedIds.length} πηγές)
        </Button>
      </div>
    </div>
  );
}
