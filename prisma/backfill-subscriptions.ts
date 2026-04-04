import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function backfill() {
  const client = await pool.connect();
  try {
    // Get professional plan ID
    const planResult = await client.query(
      `SELECT id, "trialDays" FROM "Plan" WHERE slug = 'professional' LIMIT 1`
    );
    if (planResult.rows.length === 0) {
      console.error('Professional plan not found. Run seed-plans.ts first.');
      process.exit(1);
    }
    const plan = planResult.rows[0];

    // Get tenants without subscriptions
    const tenantsResult = await client.query(
      `SELECT t.id, t.name FROM "Tenant" t
       LEFT JOIN "Subscription" s ON s."tenantId" = t.id
       WHERE s.id IS NULL`
    );

    console.log(`Found ${tenantsResult.rows.length} tenants without subscriptions`);

    for (const tenant of tenantsResult.rows) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO "Subscription" (id, status, "billingCycle", "currentPeriodStart", "currentPeriodEnd",
          "trialEndsAt", "tenantId", "planId", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, 'TRIAL', 'MONTHLY', $1, $2, $2, $3, $4, $1, $1)
        ON CONFLICT ("tenantId") DO NOTHING`,
        [now, trialEnd, tenant.id, plan.id]
      );
      console.log(`Created trial subscription for: ${tenant.name}`);
    }

    console.log('Done');
  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch((e) => {
  console.error(e);
  process.exit(1);
});
