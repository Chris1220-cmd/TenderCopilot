'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { AlertTriangle, ChevronsUpDown, X, Sparkles, Check, Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ─── Types ───────────────────────────────────────────────────

interface Suggestion {
  memberId: string;
  memberName: string;
  score: number;
  reasoning: string;
}

interface TeamAssignmentCellProps {
  requirementId: string;
  currentMemberId: string | null;
  currentMemberName: string | null;
  suggestion?: Suggestion | null;
  onAssigned: () => void;
}

// ─── Component ───────────────────────────────────────────────

export function TeamAssignmentCell({
  requirementId,
  currentMemberId,
  currentMemberName,
  suggestion,
  onAssigned,
}: TeamAssignmentCellProps) {
  const t = useTranslations('teamMembers');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [optimisticMember, setOptimisticMember] = useState<{
    id: string;
    name: string;
  } | null>(
    currentMemberId && currentMemberName
      ? { id: currentMemberId, name: currentMemberName }
      : null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep optimistic state in sync when props change
  useEffect(() => {
    setOptimisticMember(
      currentMemberId && currentMemberName
        ? { id: currentMemberId, name: currentMemberName }
        : null
    );
  }, [currentMemberId, currentMemberName]);

  const membersQuery = trpc.teamMember.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const assignMutation = trpc.teamMember.assignToRequirement.useMutation({
    onSuccess: () => {
      onAssigned();
    },
  });

  const unassignMutation = trpc.teamMember.unassignFromRequirement.useMutation({
    onSuccess: () => {
      onAssigned();
    },
  });

  const activeMembers = (membersQuery.data ?? []).filter((m) => m.isActive);

  const filteredMembers = search.trim()
    ? activeMembers.filter(
        (m) =>
          m.fullName.toLowerCase().includes(search.toLowerCase()) ||
          (m.title ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : activeMembers;

  const handleSelect = (memberId: string, memberName: string) => {
    setOptimisticMember({ id: memberId, name: memberName });
    setOpen(false);
    setSearch('');
    assignMutation.mutate({ requirementId, memberId });
  };

  const handleUnassign = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOptimisticMember(null);
    unassignMutation.mutate({ requirementId });
  };

  const handleSuggestionClick = () => {
    if (!suggestion) return;
    handleSelect(suggestion.memberId, suggestion.memberName);
  };

  const isLoading = assignMutation.isPending || unassignMutation.isPending;
  const assigned = optimisticMember;
  const hasSuggestion = suggestion && !assigned;

  return (
    <div className="flex items-center gap-1.5 min-w-[160px]">
      {/* AI Suggestion Badge (shown when unassigned and suggestion exists) */}
      {hasSuggestion && (
        <button
          onClick={handleSuggestionClick}
          disabled={isLoading}
          title={suggestion.reasoning}
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold cursor-pointer transition-all duration-150',
            'bg-[#48A4D6]/10 text-[#48A4D6] border-[#48A4D6]/30',
            'hover:bg-[#48A4D6]/20 hover:border-[#48A4D6]/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#48A4D6]/50',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Sparkles className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[80px]">{suggestion.memberName}</span>
          <span className="opacity-60">({suggestion.score})</span>
        </button>
      )}

      {/* Combobox Trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={isLoading}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-all duration-150 cursor-pointer',
              'min-w-[120px] max-w-[180px]',
              assigned
                ? 'bg-white/50 dark:bg-white/[0.05] border-border/40 text-foreground'
                : 'bg-transparent border-border/30 text-muted-foreground hover:border-border/60',
              'hover:bg-white/60 dark:hover:bg-white/[0.08]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#48A4D6]/50',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin shrink-0 text-muted-foreground" />
            ) : (
              <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate flex-1 text-left">
              {assigned ? assigned.name : t('selectMember')}
            </span>
            {assigned && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleUnassign}
                onKeyDown={(e) => e.key === 'Enter' && handleUnassign(e as any)}
                className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-72 p-0 overflow-hidden"
          align="start"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          {/* Search input */}
          <div className="border-b border-border/30 px-3 py-2">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('selectMember')}
              className={cn(
                'w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60',
                'text-foreground'
              )}
            />
          </div>

          {/* Member list */}
          <div className="max-h-64 overflow-y-auto">
            {membersQuery.isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {t('noMembers')}
              </p>
            ) : (
              <div className="py-1">
                {filteredMembers.map((member) => {
                  const isCurrentlyAssigned = assigned?.id === member.id;
                  const isBusy = member._count.assignments > 0 && !isCurrentlyAssigned;

                  return (
                    <button
                      key={member.id}
                      onClick={() => handleSelect(member.id, member.fullName)}
                      className={cn(
                        'flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors duration-150 cursor-pointer',
                        'hover:bg-[#48A4D6]/8 dark:hover:bg-[#48A4D6]/10',
                        'focus-visible:outline-none focus-visible:bg-[#48A4D6]/10',
                        isCurrentlyAssigned && 'bg-[#48A4D6]/10'
                      )}
                    >
                      {/* Check mark for currently selected */}
                      <div className="mt-0.5 h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                        {isCurrentlyAssigned && (
                          <Check className="h-3 w-3 text-[#48A4D6]" />
                        )}
                      </div>

                      {/* Member info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-foreground truncate">
                            {member.fullName}
                          </span>
                          {isBusy && (
                            <span
                              title={t('alreadyAssigned')}
                              className="inline-flex items-center"
                            >
                              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {member.title && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {member.title}
                            </span>
                          )}
                          {member.totalExperience > 0 && (
                            <span className="text-[10px] text-muted-foreground/60 shrink-0">
                              · {member.totalExperience} έτη
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
