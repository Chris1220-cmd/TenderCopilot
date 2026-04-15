'use client';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Loader2 } from 'lucide-react';

export default function InvitePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const router = useRouter();

  const { data: invitation, isLoading, error } = trpc.invite.getByToken.useQuery({ token });

  const acceptMutation = trpc.invite.accept.useMutation({
    onSuccess: () => { router.push('/dashboard'); },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold">Μη έγκυρο Invitation</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <a href="/login" className="text-sm text-primary hover:underline">Μετάβαση στο Login</a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 text-4xl">🎉</div>
        <h1 className="mb-1 text-xl font-semibold">Πρόσκληση στο TenderCopilot</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Έχεις προσκληθεί να ενταχθείς στην ομάδα{' '}
          <span className="font-medium text-foreground">{invitation?.tenantName}</span>
        </p>
        <p className="mb-6 text-xs text-muted-foreground">
          Θα συνδεθείς ως <span className="font-medium">{invitation?.email}</span>
        </p>
        <button
          type="button"
          onClick={() => acceptMutation.mutate({ token })}
          disabled={acceptMutation.isPending}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {acceptMutation.isPending ? (
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          ) : (
            'Αποδοχή Πρόσκλησης'
          )}
        </button>
        {acceptMutation.error && (
          <p className="mt-3 text-xs text-destructive">{acceptMutation.error.message}</p>
        )}
      </div>
    </div>
  );
}
