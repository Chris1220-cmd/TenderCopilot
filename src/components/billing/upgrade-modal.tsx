'use client';
import { useRouter } from 'next/navigation';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export function UpgradeModal({ open, onClose, reason }: Props) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>Αναβάθμιση Πλάνου</DialogTitle>
          <DialogDescription>
            {reason ?? 'Έχεις φτάσει το όριο του τρέχοντος πλάνου σου.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Άκυρο</Button>
          <Button className="flex-1" onClick={() => { onClose(); router.push('/billing'); }}>
            Δες τα πλάνα →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
