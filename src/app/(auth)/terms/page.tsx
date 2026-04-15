// src/app/(auth)/terms/page.tsx
import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
          ← Επιστροφή
        </Link>
      </div>
      <h1 className="mb-2 text-3xl font-bold">Όροι Χρήσης</h1>
      <p className="mb-8 text-sm text-muted-foreground">Τελευταία ενημέρωση: Απρίλιος 2026</p>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed text-foreground/80">
        <section>
          <h2 className="text-base font-semibold text-foreground">1. Αποδοχή Όρων</h2>
          <p>Χρησιμοποιώντας την υπηρεσία TenderCopilot αποδέχεστε τους παρόντες Όρους Χρήσης. Εάν δεν συμφωνείτε, παρακαλούμε να μην χρησιμοποιήσετε την υπηρεσία.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">2. Περιγραφή Υπηρεσίας</h2>
          <p>Το TenderCopilot είναι πλατφόρμα διαχείρισης δημοσίων διαγωνισμών που παρέχει εργαλεία αναζήτησης, ανάλυσης εγγράφων και προετοιμασίας προσφορών.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">3. Λογαριασμός Χρήστη</h2>
          <p>Ευθύνεστε για την ασφάλεια του λογαριασμού σας. Δεν επιτρέπεται η κοινοποίηση των διαπιστευτηρίων σας σε τρίτους.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">4. Πληρωμές & Συνδρομές</h2>
          <p>Οι χρεώσεις γίνονται μηνιαία ή ετήσια ανάλογα με το επιλεγμένο πλάνο. Δεν γίνονται επιστροφές χρημάτων για μερικούς μήνες.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">5. Περιορισμός Ευθύνης</h2>
          <p>Το TenderCopilot παρέχεται «ως έχει». Δεν φέρουμε ευθύνη για αποφάσεις που λαμβάνονται βάσει των πληροφοριών της πλατφόρμας.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-foreground">6. Επικοινωνία</h2>
          <p>Για ερωτήσεις σχετικά με τους Όρους Χρήσης επικοινωνήστε μαζί μας στο support@tendercopilot.com</p>
        </section>
      </div>
    </div>
  );
}
