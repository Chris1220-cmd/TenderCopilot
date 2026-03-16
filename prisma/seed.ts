import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo1234', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@tendercopilot.gr' },
    update: {},
    create: {
      email: 'demo@tendercopilot.gr',
      name: 'Demo User',
      hashedPassword,
      emailVerified: new Date(),
    },
  });

  // Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Εταιρεία ΑΕ',
      slug: 'demo-company',
    },
  });

  // Link user to tenant
  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: 'ADMIN',
    },
  });

  // Create company profile
  await prisma.companyProfile.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      legalName: 'Demo Εταιρεία Πληροφορικής ΑΕ',
      tradeName: 'DemoTech',
      taxId: '123456789',
      taxOffice: 'ΔΟΥ Αθηνών',
      registrationNumber: 'ΓΕΜΗ 123456',
      address: 'Λεωφόρος Κηφισίας 100',
      city: 'Αθήνα',
      postalCode: '11524',
      phone: '+30 210 1234567',
      email: 'info@demotech.gr',
      website: 'https://demotech.gr',
      legalRepName: 'Ιωάννης Παπαδόπουλος',
      legalRepTitle: 'Διευθύνων Σύμβουλος',
      legalRepIdNumber: 'ΑΚ123456',
      kadCodes: ['62.01', '62.02', '63.11'],
      description: 'Εταιρεία πληροφορικής με εξειδίκευση σε λύσεις λογισμικού για τον δημόσιο τομέα.',
    },
  });

  // Create certificates
  const certs = [
    { type: 'ISO 9001', title: 'ISO 9001:2015 - Σύστημα Διαχείρισης Ποιότητας', issuer: 'TUV Hellas' },
    { type: 'ISO 27001', title: 'ISO 27001:2022 - Ασφάλεια Πληροφοριών', issuer: 'Bureau Veritas' },
    { type: 'ISO 14001', title: 'ISO 14001:2015 - Περιβαλλοντική Διαχείριση', issuer: 'TUV Hellas' },
  ];

  for (const cert of certs) {
    await prisma.certificate.create({
      data: {
        tenantId: tenant.id,
        ...cert,
        issueDate: new Date('2023-01-15'),
        expiryDate: new Date('2026-01-15'),
      },
    });
  }

  // Create legal docs
  const legalDocs = [
    { type: 'TAX_CLEARANCE' as const, title: 'Φορολογική Ενημερότητα' },
    { type: 'SOCIAL_SECURITY_CLEARANCE' as const, title: 'Ασφαλιστική Ενημερότητα (ΕΦΚΑ)' },
    { type: 'GEMI_CERTIFICATE' as const, title: 'Πιστοποιητικό ΓΕΜΗ' },
    { type: 'CRIMINAL_RECORD' as const, title: 'Ποινικό Μητρώο Εκπροσώπου' },
  ];

  for (const doc of legalDocs) {
    await prisma.legalDocument.create({
      data: {
        tenantId: tenant.id,
        ...doc,
        issueDate: new Date('2024-01-10'),
        expiryDate: new Date('2024-07-10'),
      },
    });
  }

  // Create experience projects
  const projects = [
    {
      title: 'Ψηφιακός Μετασχηματισμός Δήμου Αθηναίων',
      client: 'Δήμος Αθηναίων',
      contractAmount: 180000,
      category: 'Digital Transformation',
    },
    {
      title: 'Σύστημα Ηλεκτρονικής Διακυβέρνησης',
      client: 'Υπουργείο Εσωτερικών',
      contractAmount: 250000,
      category: 'eGovernment',
    },
    {
      title: 'Πλατφόρμα Διαχείρισης Δεδομένων Υγείας',
      client: 'ΗΔΙΚΑ',
      contractAmount: 150000,
      category: 'Healthcare IT',
    },
  ];

  for (const project of projects) {
    await prisma.project.create({
      data: {
        tenantId: tenant.id,
        ...project,
        description: `Ολοκληρωμένο έργο ${project.title} για τον πελάτη ${project.client}.`,
        startDate: new Date('2022-03-01'),
        endDate: new Date('2023-06-30'),
      },
    });
  }

  // Create content library items
  const contentItems = [
    {
      category: 'COMPANY_PROFILE' as const,
      title: 'Παρουσίαση Εταιρείας',
      content: 'Η DemoTech ΑΕ ιδρύθηκε το 2010 με αντικείμενο την ανάπτυξη λογισμικού...',
      tags: ['εταιρεία', 'παρουσίαση', 'ιστορικό'],
    },
    {
      category: 'METHODOLOGY' as const,
      title: 'Μεθοδολογία Υλοποίησης Έργων',
      content: 'Η εταιρεία ακολουθεί τη μεθοδολογία Agile/Scrum για την υλοποίηση έργων πληροφορικής...',
      tags: ['μεθοδολογία', 'agile', 'scrum', 'υλοποίηση'],
    },
    {
      category: 'QA_PLAN' as const,
      title: 'Σχέδιο Διασφάλισης Ποιότητας',
      content: 'Το σχέδιο ποιότητας περιλαμβάνει: αυτοματοποιημένο testing, code reviews, CI/CD...',
      tags: ['ποιότητα', 'qa', 'testing'],
    },
    {
      category: 'TEAM_DESCRIPTION' as const,
      title: 'Ομάδα Έργου - Τυπικό Στελεχιακό Δυναμικό',
      content: 'Η ομάδα αποτελείται από: Project Manager, Lead Developer, 3 Senior Developers, QA Engineer...',
      tags: ['ομάδα', 'team', 'στελέχη'],
    },
    {
      category: 'RISK_MANAGEMENT' as const,
      title: 'Σχέδιο Διαχείρισης Κινδύνων',
      content: 'Εφαρμόζουμε προληπτική διαχείριση κινδύνων με μεθοδολογία: αναγνώριση, αξιολόγηση, μετριασμός...',
      tags: ['κίνδυνοι', 'risk', 'διαχείριση'],
    },
  ];

  for (const item of contentItems) {
    await prisma.contentLibraryItem.create({
      data: {
        tenantId: tenant.id,
        ...item,
      },
    });
  }

  // Create sample tender
  const tender1 = await prisma.tender.create({
    data: {
      tenantId: tenant.id,
      title: 'Προμήθεια Εξοπλισμού ΤΠΕ & Λογισμικού',
      referenceNumber: 'ΔΙΑΚ-2024/001',
      contractingAuthority: 'Υπουργείο Ψηφιακής Διακυβέρνησης',
      platform: 'ESIDIS',
      cpvCodes: ['30200000-1', '48000000-8'],
      budget: 250000,
      awardCriteria: 'Πλέον συμφέρουσα οικονομική προσφορά βάσει βέλτιστης σχέσης ποιότητας-τιμής',
      submissionDeadline: new Date('2024-06-30T14:00:00Z'),
      status: 'IN_PROGRESS',
      complianceScore: 67,
    },
  });

  // Add requirements to tender
  const requirements = [
    { text: 'Εγγυητική επιστολή συμμετοχής 2%', category: 'PARTICIPATION_CRITERIA', type: 'FINANCIAL', mandatory: true, coverageStatus: 'GAP' },
    { text: 'Φορολογική ενημερότητα σε ισχύ', category: 'PARTICIPATION_CRITERIA', type: 'DOCUMENT', mandatory: true, coverageStatus: 'COVERED' },
    { text: 'Ασφαλιστική ενημερότητα σε ισχύ', category: 'PARTICIPATION_CRITERIA', type: 'DOCUMENT', mandatory: true, coverageStatus: 'COVERED' },
    { text: 'ISO 9001:2015 πιστοποιητικό', category: 'PARTICIPATION_CRITERIA', type: 'CERTIFICATE', mandatory: true, coverageStatus: 'COVERED' },
    { text: '3 αντίστοιχα έργα τελευταίας τριετίας, αξίας ≥€150.000', category: 'TECHNICAL_REQUIREMENTS', type: 'EXPERIENCE', mandatory: true, coverageStatus: 'COVERED' },
    { text: 'Υπεύθυνη δήλωση μη αποκλεισμού', category: 'EXCLUSION_CRITERIA', type: 'DECLARATION', mandatory: true, coverageStatus: 'GAP' },
    { text: 'Τεχνική προσφορά με μεθοδολογία', category: 'TECHNICAL_REQUIREMENTS', type: 'TECHNICAL', mandatory: true, coverageStatus: 'GAP' },
    { text: 'Πίνακας τεχνικής συμμόρφωσης', category: 'DOCUMENTATION_REQUIREMENTS', type: 'DOCUMENT', mandatory: true, coverageStatus: 'GAP' },
    { text: 'Οικονομική προσφορά', category: 'FINANCIAL_REQUIREMENTS', type: 'FINANCIAL', mandatory: true, coverageStatus: 'UNMAPPED' },
  ];

  for (const req of requirements) {
    await prisma.tenderRequirement.create({
      data: {
        tenderId: tender1.id,
        ...req,
        articleReference: 'Ν.4412/2016',
        aiConfidence: 0.9,
      } as any,
    });
  }

  // Create tasks
  await prisma.task.createMany({
    data: [
      { tenderId: tender1.id, title: 'Ετοιμασία εγγυητικής επιστολής', status: 'TODO', priority: 'HIGH', assigneeId: user.id, creatorId: user.id },
      { tenderId: tender1.id, title: 'Σύνταξη υπεύθυνης δήλωσης', status: 'IN_PROGRESS', priority: 'MEDIUM', assigneeId: user.id, creatorId: user.id },
      { tenderId: tender1.id, title: 'Review τεχνικής προσφοράς', status: 'TODO', priority: 'HIGH', assigneeId: user.id, creatorId: user.id },
      { tenderId: tender1.id, title: 'Συγκέντρωση βεβαιώσεων καλής εκτέλεσης', status: 'DONE', priority: 'MEDIUM', assigneeId: user.id, creatorId: user.id },
    ],
  });

  // Create second tender
  await prisma.tender.create({
    data: {
      tenantId: tenant.id,
      title: 'Υπηρεσίες Συντήρησης Πληροφοριακών Συστημάτων',
      referenceNumber: 'ΔΙΑΚ-2024/015',
      contractingAuthority: 'Περιφέρεια Αττικής',
      platform: 'COSMOONE',
      cpvCodes: ['72000000-5'],
      budget: 120000,
      submissionDeadline: new Date('2024-07-15T12:00:00Z'),
      status: 'DISCOVERY',
      complianceScore: null,
    },
  });

  await prisma.tender.create({
    data: {
      tenantId: tenant.id,
      title: 'Ψηφιοποίηση Αρχείου Δικαστηρίου',
      referenceNumber: 'ΔΙΑΚ-2023/078',
      contractingAuthority: 'Υπουργείο Δικαιοσύνης',
      platform: 'ESIDIS',
      budget: 85000,
      submissionDeadline: new Date('2024-03-15T14:00:00Z'),
      status: 'WON',
      complianceScore: 92,
    },
  });

  console.log('Seed complete!');
  console.log('Login: demo@tendercopilot.gr / demo1234');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
