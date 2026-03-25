'use client';

import { useState } from 'react';
import { cn, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
} from '@/components/ui/glass-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  MessageSquare,
  Plus,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Inbox,
  Clock,
  Sparkles,
} from 'lucide-react';

interface PublishedClarificationsProps {
  tenderId: string;
}

export function PublishedClarifications({ tenderId }: PublishedClarificationsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const listQuery = trpc.aiRoles.listPublishedClarifications.useQuery(
    { tenderId },
    { retry: false, refetchOnWindowFocus: false }
  );

  const addMutation = trpc.aiRoles.addPublishedClarification.useMutation({
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('clarifications.checkedNow') });
      listQuery.refetch();
      closeDialog();
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const markReadMutation = trpc.aiRoles.markClarificationRead.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  const tenderQuery = trpc.tender.getById.useQuery({ id: tenderId }, { retry: false });
  const lastCheckedAt = (tenderQuery.data as any)?.lastClarificationCheckAt;

  const markCheckedMutation = trpc.aiRoles.markClarificationsChecked.useMutation({
    onSuccess: () => {
      toast({ title: t('clarifications.checkedNow') });
      tenderQuery.refetch();
    },
  });

  const clarifications = (listQuery.data ?? []) as any[];

  function closeDialog() {
    setDialogOpen(false);
    setQuestionText('');
    setAnswerText('');
    setPublishedAt('');
    setSourceUrl('');
  }

  function handleSubmit() {
    if (!questionText || !answerText || !publishedAt) return;
    addMutation.mutate({
      tenderId,
      questionText,
      answerText,
      publishedAt,
      sourceUrl: sourceUrl || undefined,
    });
  }

  function handleMarkRead(id: string) {
    markReadMutation.mutate({ id });
  }

  return (
    <>
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            {t('clarifications.publishedTitle')}
            {clarifications.filter((c: any) => !c.isRead).length > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 min-w-5 flex items-center justify-center">
                {clarifications.filter((c: any) => !c.isRead).length}
              </Badge>
            )}
          </GlassCardTitle>
          <GlassCardDescription className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
              className="cursor-pointer h-7 text-xs gap-1"
            >
              <Plus className="h-3 w-3" />
              {t('clarifications.addNew')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markCheckedMutation.mutate({ tenderId })}
              disabled={markCheckedMutation.isPending}
              className="cursor-pointer h-7 text-xs gap-1"
            >
              {markCheckedMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              {t('clarifications.markChecked')}
            </Button>
            {lastCheckedAt && (
              <span className="text-[10px] text-muted-foreground">
                {t('clarifications.lastChecked').replace('{{date}}', formatDate(lastCheckedAt))}
              </span>
            )}
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          {clarifications.length === 0 ? (
            <div className="text-center py-8">
              <Inbox className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">{t('clarifications.noPublished')}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">{t('clarifications.checkPortal')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {clarifications.map((cl: any) => (
                <div
                  key={cl.id}
                  onClick={() => !cl.isRead && handleMarkRead(cl.id)}
                  className={cn(
                    'rounded-xl border p-4 transition-all duration-200 cursor-pointer',
                    'bg-white/40 dark:bg-white/[0.03]',
                    cl.isRead
                      ? 'border-white/30 dark:border-white/10'
                      : 'border-primary/30 dark:border-primary/20 bg-primary/[0.03]'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {!cl.isRead && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {t('clarifications.questionLabel')}
                        </span>
                        <p className="text-xs text-foreground leading-relaxed mt-0.5">
                          {cl.questionText}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {t('clarifications.answerLabel')}
                        </span>
                        <p className="text-xs text-foreground leading-relaxed mt-0.5">
                          {cl.answerText}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {t('clarifications.publishedAt').replace('{{date}}', formatDate(cl.publishedAt))}
                        </span>
                        {cl.sourceUrl && (
                          <a
                            href={cl.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t('clarifications.sourceLink')}
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled
                          className="h-6 text-[10px] gap-1 ml-auto opacity-50"
                          title={t('clarifications.comingSoon')}
                        >
                          <Sparkles className="h-3 w-3" />
                          {t('clarifications.aiAnalysis')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] border-white/10 bg-gradient-to-br from-card to-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{t('clarifications.addNew')}</DialogTitle>
            <DialogDescription>{t('clarifications.publishedTitle')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('clarifications.questionLabel')}</Label>
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder={t('clarifications.questionPlaceholder')}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('clarifications.answerLabel')}</Label>
              <Textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder={t('clarifications.answerPlaceholder')}
                className="min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('clarifications.publishedDate')}</Label>
                <Input
                  type="date"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  className="cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('clarifications.sourceLink')}</Label>
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder={t('clarifications.sourceLinkPlaceholder')}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="cursor-pointer">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!questionText || !answerText || !publishedAt || addMutation.isPending}
              className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
