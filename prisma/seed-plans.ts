import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const plans = [
  {
    name: 'Starter',
    slug: 'starter',
    price: 49,
    priceAnnual: 39,
    maxActiveTenders: 3,
    maxAiCreditsPerMonth: 15,
    maxDocumentsPerMonth: 5,
    maxSearchesPerMonth: 20,
    maxStorageMB: 1024,
    maxUsers: null,
    features: JSON.stringify({ allPlatforms: false, sso: false, auditLog: false }),
    sortOrder: 1,
    trialDays: 14,
  },
  {
    name: 'Professional',
    slug: 'professional',
    price: 99,
    priceAnnual: 79,
    maxActiveTenders: 10,
    maxAiCreditsPerMonth: 60,
    maxDocumentsPerMonth: 30,
    maxSearchesPerMonth: 100,
    maxStorageMB: 10240,
    maxUsers: null,
    features: JSON.stringify({ allPlatforms: true, sso: false, auditLog: false }),
    sortOrder: 2,
    trialDays: 14,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    price: 0,
    priceAnnual: 0,
    maxActiveTenders: null,
    maxAiCreditsPerMonth: null,
    maxDocumentsPerMonth: null,
    maxSearchesPerMonth: null,
    maxStorageMB: null,
    maxUsers: null,
    features: JSON.stringify({ allPlatforms: true, sso: true, auditLog: true }),
    sortOrder: 3,
    trialDays: 14,
  },
];

async function seedPlans() {
  const client = await pool.connect();
  try {
    for (const p of plans) {
      await client.query(
        `INSERT INTO "Plan" (id, name, slug, price, "priceAnnual",
          "maxActiveTenders", "maxAiCreditsPerMonth", "maxDocumentsPerMonth",
          "maxSearchesPerMonth", "maxStorageMB", "maxUsers",
          features, "isActive", "sortOrder", "trialDays", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, true, $12, $13, NOW(), NOW()
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = $1, price = $3, "priceAnnual" = $4,
          "maxActiveTenders" = $5, "maxAiCreditsPerMonth" = $6, "maxDocumentsPerMonth" = $7,
          "maxSearchesPerMonth" = $8, "maxStorageMB" = $9, "maxUsers" = $10,
          features = $11::jsonb, "sortOrder" = $12, "trialDays" = $13, "updatedAt" = NOW()`,
        [
          p.name, p.slug, p.price, p.priceAnnual,
          p.maxActiveTenders, p.maxAiCreditsPerMonth, p.maxDocumentsPerMonth,
          p.maxSearchesPerMonth, p.maxStorageMB, p.maxUsers,
          p.features, p.sortOrder, p.trialDays,
        ]
      );
      console.log(`Upserted plan: ${p.name}`);
    }
    console.log('Seeded 3 plans: Starter, Professional, Enterprise');
  } finally {
    client.release();
    await pool.end();
  }
}

seedPlans().catch((e) => {
  console.error(e);
  process.exit(1);
});
