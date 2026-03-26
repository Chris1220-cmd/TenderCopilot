'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamMemberSheet } from './team-member-sheet';
import {
  Users,
  Plus,
  Search,
  Briefcase,
  GraduationCap,
  Award,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Initials helper ──────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TeamMembersList() {
  const { toast } = useToast();
  const { t } = useTranslation();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteHasAssignments, setDeleteHasAssignments] = useState(false);
  const [search, setSearch] = useState('');

  const membersQuery = trpc.teamMember.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = trpc.teamMember.delete.useMutation({
    onSuccess: (result) => {
      const wasDeactivated = result && 'isActive' in result && result.isActive === false;
      toast({
        title: t('common.success'),
        description: wasDeactivated
          ? t('teamMembers.memberDeactivated')
          : t('teamMembers.memberDeleted'),
      });
      membersQuery.refetch();
      setDeleteConfirmId(null);
      setDeleteHasAssignments(false);
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const members = (membersQuery.data ?? []) as Array<{
    id: string;
    fullName: string;
    title: string;
    totalExperience: number;
    isActive: boolean;
    _count: {
      education: number;
      experience: number;
      certifications: number;
      assignments: number;
    };
  }>;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q)
    );
  }, [members, search]);

  function openCreate() {
    setEditingId(null);
    setSheetOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setSheetOpen(true);
  }

  function onSheetClose() {
    setSheetOpen(false);
    setEditingId(null);
    membersQuery.refetch();
  }

  function confirmDelete(id: string, assignmentCount: number) {
    setDeleteConfirmId(id);
    setDeleteHasAssignments(assignmentCount > 0);
  }

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (membersQuery.isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card
            key={i}
            className="bg-card border border-border/60 rounded-xl"
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-[#48A4D6]" />
            {t('teamMembers.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {members.length}{' '}
            {members.length === 1
              ? t('teamMembers.countSingular')
              : t('teamMembers.countPlural')}
          </p>
        </div>
        <Button
          onClick={openCreate}
          className={cn(
            'cursor-pointer shrink-0',
            'bg-[#48A4D6] text-white hover:bg-[#48A4D6]/90',
            'shadow-md shadow-[#48A4D6]/20',
            'border-0'
          )}
        >
          <Plus className="h-4 w-4" />
          {t('teamMembers.newMember')}
        </Button>
      </div>

      {/* Search */}
      {members.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('teamMembers.searchPlaceholder')}
            className="pl-9"
          />
        </div>
      )}

      {/* Empty state */}
      {members.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 bg-card border border-border/60 rounded-xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{t('teamMembers.noMembers')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('teamMembers.noMembersSub')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((member) => (
            <Card
              key={member.id}
              onClick={() => openEdit(member.id)}
              className={cn(
                'group bg-card border border-border/60 rounded-xl',
                'transition-all duration-200 hover:shadow-md hover:border-[#48A4D6]/30',
                'cursor-pointer'
              )}
            >
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Initials avatar */}
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                      'bg-[#48A4D6]/10 text-[#48A4D6]',
                      'text-sm font-semibold select-none'
                    )}
                  >
                    {getInitials(member.fullName)}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold truncate">{member.fullName}</h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground/70">{member.title}</span>
                      {member.totalExperience > 0 && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {member.totalExperience} {t('teamMembers.year')}
                        </span>
                      )}
                    </div>
                    {/* Stats row */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span
                        className="flex items-center gap-1"
                        title={t('teamMembers.education')}
                      >
                        <GraduationCap className="h-3 w-3" />
                        {member._count.education}
                      </span>
                      <span
                        className="flex items-center gap-1"
                        title={t('teamMembers.experience')}
                      >
                        <Briefcase className="h-3 w-3" />
                        {member._count.experience}
                      </span>
                      <span
                        className="flex items-center gap-1"
                        title={t('teamMembers.certifications')}
                      >
                        <Award className="h-3 w-3" />
                        {member._count.certifications}
                      </span>
                    </div>
                  </div>

                  {/* Active/Inactive badge */}
                  <div className="flex items-center gap-2 shrink-0">
                    {member.isActive ? (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border text-[10px]"
                      >
                        {t('teamMembers.active')}
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-muted text-muted-foreground text-[10px]"
                      >
                        {t('teamMembers.inactive')}
                      </Badge>
                    )}
                  </div>

                  {/* Action buttons — visible on hover */}
                  <div
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(member.id);
                      }}
                      className="cursor-pointer h-8 w-8"
                      title={t('common.edit')}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDelete(member.id, member._count.assignments);
                      }}
                      className="cursor-pointer h-8 w-8 text-destructive hover:text-destructive"
                      title={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* No search results */}
          {filtered.length === 0 && search.trim() !== '' && (
            <Card className="flex flex-col items-center justify-center py-10 bg-card border border-border/60 rounded-xl">
              <Search className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('teamMembers.noMembers')}
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Team Member Sheet (create / edit) */}
      <TeamMemberSheet
        open={sheetOpen}
        memberId={editingId}
        onClose={onSheetClose}
      />

      {/* Delete / Deactivate confirmation dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirmId(null);
            setDeleteHasAssignments(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px] bg-card border border-border/60 rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('common.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {deleteHasAssignments
                ? t('teamMembers.deactivateConfirm')
                : t('teamMembers.deleteConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmId(null);
                setDeleteHasAssignments(false);
              }}
              className="cursor-pointer"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteConfirmId) {
                  deleteMutation.mutate({ id: deleteConfirmId });
                }
              }}
              className="cursor-pointer"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
