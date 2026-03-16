const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Oceanic1220@127.0.0.1:5433/tendercopilot'
  });

  console.log('Seeding database...');
  const hashedPassword = await bcrypt.hash('demo1234', 12);

  // User
  const u = await pool.query(
    `INSERT INTO "User" (id, email, name, "hashedPassword", "emailVerified", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET name=$2 RETURNING id`,
    ['demo@tendercopilot.gr', 'Demo User', hashedPassword]
  );
  const userId = u.rows[0].id;
  console.log('User:', userId);

  // Tenant
  const t = await pool.query(
    `INSERT INTO "Tenant" (id, name, slug, "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, NOW(), NOW())
     ON CONFLICT (slug) DO UPDATE SET name=$1 RETURNING id`,
    ['Demo Εταιρεία ΑΕ', 'demo-company']
  );
  const tenantId = t.rows[0].id;
  console.log('Tenant:', tenantId);

  // TenantUser
  await pool.query(
    `INSERT INTO "TenantUser" (id, role, "joinedAt", "tenantId", "userId")
     VALUES (gen_random_uuid()::text, 'ADMIN', NOW(), $1, $2)
     ON CONFLICT ("tenantId", "userId") DO NOTHING`,
    [tenantId, userId]
  );

  // CompanyProfile
  await pool.query(
    `INSERT INTO "CompanyProfile" (id, "legalName", "tradeName", "taxId", "taxOffice", "registrationNumber",
     address, city, "postalCode", phone, email, website, "legalRepName", "legalRepTitle", "kadCodes",
     description, "tenantId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
     ON CONFLICT ("tenantId") DO NOTHING`,
    ['Demo Εταιρεία Πληροφορικής ΑΕ', 'DemoTech', '123456789', 'ΔΟΥ Αθηνών', 'ΓΕΜΗ 123456',
     'Λεωφόρος Κηφισίας 100', 'Αθήνα', '11524', '+30 210 1234567', 'info@demotech.gr',
     'https://demotech.gr', 'Ιωάννης Παπαδόπουλος', 'Διευθύνων Σύμβουλος',
     '{62.01,62.02,63.11}', 'Εταιρεία πληροφορικής με εξειδίκευση σε λύσεις λογισμικού.', tenantId]
  );
  console.log('CompanyProfile created');

  // Certificates
  const certs = [
    ['ISO 9001', 'ISO 9001:2015 - Σύστημα Διαχείρισης Ποιότητας', 'TUV Hellas'],
    ['ISO 27001', 'ISO 27001:2022 - Ασφάλεια Πληροφοριών', 'Bureau Veritas'],
    ['ISO 14001', 'ISO 14001:2015 - Περιβαλλοντική Διαχείριση', 'TUV Hellas'],
  ];
  for (const [type, title, issuer] of certs) {
    await pool.query(
      `INSERT INTO "Certificate" (id, type, title, issuer, "issueDate", "expiryDate", "tenantId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, '2023-01-15', '2026-01-15', $4, NOW(), NOW())`,
      [type, title, issuer, tenantId]
    );
  }
  console.log('Certificates created');

  // Tender
  const td = await pool.query(
    `INSERT INTO "Tender" (id, title, "referenceNumber", "contractingAuthority", platform, "cpvCodes",
     budget, "awardCriteria", "submissionDeadline", status, "complianceScore", "tenantId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'ESIDIS', '{30200000-1,48000000-8}', 250000,
     $4, '2025-06-30T14:00:00Z', 'IN_PROGRESS', 67, $5, NOW(), NOW()) RETURNING id`,
    ['Προμήθεια Εξοπλισμού ΤΠΕ & Λογισμικού', 'ΔΙΑΚ-2024/001',
     'Υπουργείο Ψηφιακής Διακυβέρνησης', 'Βέλτιστη σχέση ποιότητας-τιμής', tenantId]
  );
  const tenderId = td.rows[0].id;
  console.log('Tender:', tenderId);

  // Requirements
  const reqs = [
    ['Εγγυητική επιστολή συμμετοχής 2%', 'PARTICIPATION_CRITERIA', 'FINANCIAL', 'GAP'],
    ['Φορολογική ενημερότητα σε ισχύ', 'PARTICIPATION_CRITERIA', 'DOCUMENT', 'COVERED'],
    ['Ασφαλιστική ενημερότητα σε ισχύ', 'PARTICIPATION_CRITERIA', 'DOCUMENT', 'COVERED'],
    ['ISO 9001:2015 πιστοποιητικό', 'PARTICIPATION_CRITERIA', 'CERTIFICATE', 'COVERED'],
    ['Υπεύθυνη δήλωση μη αποκλεισμού', 'EXCLUSION_CRITERIA', 'DECLARATION', 'GAP'],
    ['Τεχνική προσφορά με μεθοδολογία', 'TECHNICAL_REQUIREMENTS', 'TECHNICAL', 'GAP'],
  ];
  for (const [text, cat, type, status] of reqs) {
    await pool.query(
      `INSERT INTO "TenderRequirement" (id, text, category, "articleReference", mandatory, type, "coverageStatus",
       "aiConfidence", "tenderId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'Ν.4412/2016', true, $3, $4, 0.9, $5, NOW(), NOW())`,
      [text, cat, type, status, tenderId]
    );
  }
  console.log('Requirements seeded');

  // Tasks
  await pool.query(
    `INSERT INTO "Task" (id, title, status, priority, "tenderId", "assigneeId", "creatorId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'TODO', 'HIGH', $2, $3, $3, NOW(), NOW())`,
    ['Ετοιμασία εγγυητικής επιστολής', tenderId, userId]
  );
  await pool.query(
    `INSERT INTO "Task" (id, title, status, priority, "tenderId", "assigneeId", "creatorId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, 'IN_PROGRESS', 'MEDIUM', $2, $3, $3, NOW(), NOW())`,
    ['Σύνταξη υπεύθυνης δήλωσης', tenderId, userId]
  );
  console.log('Tasks seeded');

  // 2nd tender
  await pool.query(
    `INSERT INTO "Tender" (id, title, "referenceNumber", "contractingAuthority", platform, budget,
     "submissionDeadline", status, "complianceScore", "tenantId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'COSMOONE', 120000, '2025-07-15', 'DISCOVERY', null, $4, NOW(), NOW())`,
    ['Υπηρεσίες Συντήρησης Πληροφοριακών Συστημάτων', 'ΔΙΑΚ-2024/015', 'Περιφέρεια Αττικής', tenantId]
  );

  // 3rd tender
  await pool.query(
    `INSERT INTO "Tender" (id, title, "referenceNumber", "contractingAuthority", platform, budget,
     "submissionDeadline", status, "complianceScore", "tenantId", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'ESIDIS', 85000, '2025-03-15', 'WON', 92, $4, NOW(), NOW())`,
    ['Ψηφιοποίηση Αρχείου Δικαστηρίου', 'ΔΙΑΚ-2023/078', 'Υπουργείο Δικαιοσύνης', tenantId]
  );
  console.log('Additional tenders created');

  console.log('\nSeed complete!');
  console.log('Login: demo@tendercopilot.gr / demo1234');
  await pool.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
