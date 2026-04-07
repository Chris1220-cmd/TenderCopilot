'use client';

import { Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type AnalysisLanguage = 'el' | 'en' | 'nl';

interface LanguageModalProps {
  open: boolean;
  onSelect: (lang: AnalysisLanguage) => void;
  onClose: () => void;
}

export function LanguageModal({ open, onSelect, onClose }: LanguageModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Γλώσσα αποτελεσμάτων
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 h-16 cursor-pointer flex-col gap-1"
            onClick={() => onSelect('el')}
          >
            <span className="text-lg font-semibold">GR</span>
            <span className="text-xs text-muted-foreground">Ελληνικά</span>
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-16 cursor-pointer flex-col gap-1"
            onClick={() => onSelect('en')}
          >
            <span className="text-lg font-semibold">EN</span>
            <span className="text-xs text-muted-foreground">English</span>
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-16 cursor-pointer flex-col gap-1"
            onClick={() => onSelect('nl')}
          >
            <span className="text-lg font-semibold">NL</span>
            <span className="text-xs text-muted-foreground">Nederlands</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
