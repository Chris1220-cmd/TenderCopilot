// src/app/error.tsx
'use client';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-5xl">⚠️</span>
        <h1 className="text-2xl font-semibold">Κάτι πήγε στραβά</h1>
        <p className="text-sm text-muted-foreground">
          Παρουσιάστηκε απροσδόκητο σφάλμα. Δοκιμάστε ξανά.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Δοκιμάστε ξανά
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Αρχική
        </a>
      </div>
    </div>
  );
}
