// src/app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <span className="text-6xl font-bold text-muted-foreground/30">404</span>
        <h1 className="text-2xl font-semibold">Η σελίδα δεν βρέθηκε</h1>
        <p className="text-sm text-muted-foreground">
          Η σελίδα που ψάχνεις δεν υπάρχει ή έχει μετακινηθεί.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Επιστροφή στο Dashboard
      </Link>
    </div>
  );
}
