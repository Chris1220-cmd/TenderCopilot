'use client';

import { motion } from 'motion/react';
import { Compass, Search, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function DiscoveryPage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-headline text-foreground">Discovery</h1>
        <p className="mt-1 text-body text-muted-foreground">
          Ανακαλύψτε νέους διαγωνισμούς από δημόσιες πηγές
        </p>
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants}>
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση διαγωνισμών..."
            className="h-11 rounded-xl bg-background border-border/60 pl-10"
          />
        </div>
      </motion.div>

      {/* Empty state */}
      <motion.div variants={itemVariants}>
        <div className="rounded-xl border border-border/60 bg-card py-20 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Compass className="h-6 w-6 text-primary/60" />
          </div>
          <h3 className="text-title text-foreground">Σύντομα διαθέσιμο</h3>
          <p className="mt-2 text-body text-muted-foreground max-w-md mx-auto">
            Η αυτόματη ανακάλυψη διαγωνισμών από ΕΣΗΔΗΣ, ΚΗΜΔΗΣ, Προμηθεύς και άλλες πηγές ετοιμάζεται.
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-6 rounded-full border-border/60 cursor-pointer"
          >
            <Link href="/tenders/new">
              Δημιουργία Διαγωνισμού <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
