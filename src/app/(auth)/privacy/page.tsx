// src/app/(auth)/privacy/page.tsx
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
          ← Επιστροφή
        </Link>
      </div>
      <h1 className="mb-2 text-3xl font-bold">Πολιτική Απορρήτου</h1>
      <p className="mb-8 text-sm text-muted-foreground">Τελευταία ενημέρωση: Απρίλιος 2026</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed text-foreground/80">
        <section>
          <h2 className="text-base font-semibold text-foreground">1. Δεδομένα που Συλλέγουμε</h2>
          <p>Συλλέγουμε: email, όνομα, στοιχεία εταιρείας, δεδομένα χρήσης, και τα έγγραφα που ανεβάζετε για ανάλυση.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">2. Χρήση Δεδομένων</h2>
          <p>Τα δεδομένα σας χρησιμοποιούνται αποκλειστικά για την παροχή των υπηρεσιών TenderCopilot. Δεν πωλούνται σε τρίτους.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">3. GDPR — Δικαιώματά σας</h2>
          <p>Έχετε δικαίωμα πρόσβασης, διόρθωσης, διαγραφής και φορητότητας των δεδομένων σας. Επικοινωνήστε στο privacy@tendercopilot.com</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">4. Cookies</h2>
          <p>Χρησιμοποιούμε απαραίτητα cookies για αυθεντικοποίηση. Δεν χρησιμοποιούμε cookies παρακολούθησης τρίτων.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">5. Αποθήκευση Δεδομένων</h2>
          <p>Τα δεδομένα αποθηκεύονται σε servers εντός ΕΕ (Supabase EU region). Εφαρμόζουμε κρυπτογράφηση at-rest και in-transit.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">6. Επικοινωνία</h2>
          <p>Υπεύθυνος Επεξεργασίας: TenderCopilot — privacy@tendercopilot.com</p>
        </section>
      </div>
    </div>
  );
}
