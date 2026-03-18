'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';

interface NoDocumentsAlertProps {
  tenderId: string;
  sourceUrl?: string | null;
  platform?: string;
}

/**
 * Shown in AI panels when no parsed documents exist for a tender.
 * If sourceUrl is provided, shows a retry button to re-fetch documents.
 * If sourceUrl is null (manually created tender), only the message is shown.
 */
export function NoDocumentsAlert({ tenderId, sourceUrl, platform = 'OTHER' }: NoDocumentsAlertProps) {
  const fetchDocs = trpc.discovery.fetchDocumentsFromSource.useMutation();

  const handleRetry = () => {
    if (!sourceUrl) return;
    fetchDocs.mutate({ tenderId, sourceUrl, platform });
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <div>
        <p className="font-semibold text-amber-700 dark:text-amber-400">
          Δεν βρέθηκαν έγγραφα για ανάλυση
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Η AI ανάλυση απαιτεί τουλάχιστον ένα αναλύσιμο αρχείο διακήρυξης.
          {!sourceUrl && ' Ανεβάστε το αρχείο χειροκίνητα από την καρτέλα Έγγραφα.'}
        </p>
      </div>
      {sourceUrl && (
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer gap-2"
          disabled={fetchDocs.isPending}
          onClick={handleRetry}
        >
          {fetchDocs.isPending ? 'Γίνεται λήψη…' : 'Προσπάθεια λήψης εγγράφων'}
        </Button>
      )}
      {fetchDocs.isSuccess && (
        <p className="text-sm text-green-600">
          Τα έγγραφα κατέβηκαν — ανανεώστε τη σελίδα για να εκτελέσετε ανάλυση.
        </p>
      )}
      {fetchDocs.isError && (
        <p className="text-sm text-red-500">
          Αποτυχία λήψης: {fetchDocs.error.message}
        </p>
      )}
    </div>
  );
}
