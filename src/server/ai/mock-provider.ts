import type {
  AIProvider,
  AICompletionOptions,
  AICompletionResult,
} from './types';

/**
 * Mock AI provider for development and testing.
 * Returns realistic-looking structured responses without calling any external API.
 */
export class MockAIProvider implements AIProvider {
  name = 'mock';

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    // Simulate latency
    await new Promise((resolve) => setTimeout(resolve, 500));

    const lastMessage = options.messages[options.messages.length - 1];
    const content = lastMessage?.content || '';

    // Detect what kind of request this is based on system prompt
    const systemMessage = options.messages.find((m) => m.role === 'system');
    const systemContent = systemMessage?.content || '';

    if (systemContent.includes('extract requirements') || systemContent.includes('analyze tender')) {
      return {
        content: JSON.stringify(this.mockTenderAnalysis()),
        usage: { inputTokens: 1500, outputTokens: 800 },
      };
    }

    if (systemContent.includes('compliance') || systemContent.includes('match requirements')) {
      return {
        content: JSON.stringify(this.mockComplianceMatches()),
        usage: { inputTokens: 1000, outputTokens: 500 },
      };
    }

    if (systemContent.includes('generate document') || systemContent.includes('υπεύθυνη δήλωση')) {
      return {
        content: JSON.stringify(this.mockDocumentGeneration(content)),
        usage: { inputTokens: 800, outputTokens: 1200 },
      };
    }

    // Default response
    return {
      content: 'Αυτή είναι μια mock απάντηση από τον AI provider. Αντικαταστήστε με πραγματικό provider για production.',
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  }

  private mockTenderAnalysis() {
    return {
      title: 'Προμήθεια εξοπλισμού πληροφορικής',
      referenceNumber: 'ΔΙΑΚ-2024/001',
      contractingAuthority: 'Υπουργείο Ψηφιακής Διακυβέρνησης',
      budget: 250000,
      submissionDeadline: '2024-06-30T14:00:00Z',
      cpvCodes: ['30200000-1', '48000000-8'],
      summary: 'Διαγωνισμός για την προμήθεια εξοπλισμού πληροφορικής και λογισμικού για τις ανάγκες του Υπουργείου.',
      requirements: [
        {
          text: 'Εγγυητική επιστολή συμμετοχής ύψους 2% του προϋπολογισμού',
          category: 'PARTICIPATION_CRITERIA',
          articleReference: 'Άρθρο 72 Ν.4412/2016',
          mandatory: true,
          type: 'FINANCIAL',
          confidence: 0.95,
        },
        {
          text: 'Φορολογική ενημερότητα σε ισχύ',
          category: 'PARTICIPATION_CRITERIA',
          articleReference: 'Άρθρο 73 παρ. 2',
          mandatory: true,
          type: 'DOCUMENT',
          confidence: 0.98,
        },
        {
          text: 'Ασφαλιστική ενημερότητα σε ισχύ',
          category: 'PARTICIPATION_CRITERIA',
          articleReference: 'Άρθρο 73 παρ. 2',
          mandatory: true,
          type: 'DOCUMENT',
          confidence: 0.98,
        },
        {
          text: 'Πιστοποιητικό ISO 9001:2015 στον τομέα παροχής υπηρεσιών πληροφορικής',
          category: 'PARTICIPATION_CRITERIA',
          articleReference: 'Άρθρο 82',
          mandatory: true,
          type: 'CERTIFICATE',
          confidence: 0.92,
        },
        {
          text: 'Κατάθεση αποδεικτικών τουλάχιστον 3 αντίστοιχων έργων τα τελευταία 3 έτη, συνολικής αξίας τουλάχιστον €150.000',
          category: 'TECHNICAL_REQUIREMENTS',
          articleReference: 'Άρθρο 75 παρ. 3',
          mandatory: true,
          type: 'EXPERIENCE',
          confidence: 0.90,
        },
        {
          text: 'Υπεύθυνη δήλωση Ν. 1599/1986 περί μη αποκλεισμού',
          category: 'EXCLUSION_CRITERIA',
          articleReference: 'Άρθρο 73 παρ. 1',
          mandatory: true,
          type: 'DECLARATION',
          confidence: 0.97,
        },
        {
          text: 'Τεχνική προσφορά με αναλυτική μεθοδολογία υλοποίησης',
          category: 'TECHNICAL_REQUIREMENTS',
          articleReference: 'Άρθρο 94',
          mandatory: true,
          type: 'TECHNICAL',
          confidence: 0.88,
        },
        {
          text: 'Πίνακας συμμόρφωσης τεχνικών προδιαγραφών',
          category: 'DOCUMENTATION_REQUIREMENTS',
          articleReference: 'Παράρτημα Γ',
          mandatory: true,
          type: 'DOCUMENT',
          confidence: 0.93,
        },
        {
          text: 'Οικονομική προσφορά σύμφωνα με το υπόδειγμα του Παραρτήματος Δ',
          category: 'FINANCIAL_REQUIREMENTS',
          articleReference: 'Παράρτημα Δ',
          mandatory: true,
          type: 'FINANCIAL',
          confidence: 0.96,
        },
        {
          text: 'Χρόνος εγγύησης τουλάχιστον 3 ετών για τον εξοπλισμό',
          category: 'CONTRACT_TERMS',
          articleReference: 'Άρθρο 12 παρ. 5',
          mandatory: true,
          type: 'OTHER',
          confidence: 0.85,
        },
      ],
    };
  }

  private mockComplianceMatches() {
    return [
      {
        requirementId: 'placeholder',
        matchType: 'certificate',
        matchId: 'placeholder',
        confidence: 0.9,
        explanation: 'Το πιστοποιητικό ISO 9001:2015 καλύπτει αυτή την απαίτηση.',
      },
    ];
  }

  private mockDocumentGeneration(context: string) {
    return {
      title: 'Υπεύθυνη Δήλωση (Ν. 1599/1986)',
      content: `# ΥΠΕΥΘΥΝΗ ΔΗΛΩΣΗ\n\n(Άρθρο 8 Ν.1599/1986)\n\nΗ ακρίβεια των στοιχείων που υποβάλλονται με αυτή τη δήλωση μπορεί να ελεγχθεί με βάση το αρχείο άλλων υπηρεσιών (άρθρο 8 παρ. 4 Ν. 1599/1986).\n\n## Στοιχεία Δηλούντος\n\nΟ κάτωθι υπογεγραμμένος/η, ως νόμιμος εκπρόσωπος της εταιρείας, δηλώνω υπεύθυνα ότι:\n\n1. Η εταιρεία δεν τελεί υπό πτώχευση ή υπό διαδικασία εξυγίανσης.\n2. Δεν έχει εκδοθεί αμετάκλητη δικαστική απόφαση για αδίκημα σχετικό με την επαγγελματική διαγωγή.\n3. Η εταιρεία είναι φορολογικά και ασφαλιστικά ενήμερη.\n4. Δεν συντρέχουν λόγοι αποκλεισμού σύμφωνα με τα άρθρα 73 και 74 του Ν. 4412/2016.\n\nΗμερομηνία: [ΗΜΕΡΟΜΗΝΙΑ]\n\nΟ Δηλών/Η Δηλούσα\n\n[ΥΠΟΓΡΑΦΗ]`,
      sections: [
        { heading: 'Εισαγωγή', content: 'Υπεύθυνη Δήλωση σύμφωνα με το Ν. 1599/1986' },
        { heading: 'Δηλώσεις', content: 'Περιλαμβάνονται όλες οι απαιτούμενες δηλώσεις μη αποκλεισμού' },
      ],
    };
  }
}
