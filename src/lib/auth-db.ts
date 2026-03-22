import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

export async function findUserByEmail(email: string) {
  const result = await pool.query(
    'SELECT id, email, name, "hashedPassword" FROM "User" WHERE email = $1 LIMIT 1',
    [email]
  );
  return result.rows[0] || null;
}

export async function findTenantUser(userId: string) {
  const result = await pool.query(
    'SELECT "tenantId", role FROM "TenantUser" WHERE "userId" = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
}
