import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const pool = new pg.Pool({ connectionString })
  const db = drizzle(pool)

  await migrate(db, { migrationsFolder: './drizzle' })
  await pool.end()
  console.log('migrations applied')
}

main().catch((err: unknown) => {
  console.error('migration failed:', err)
  process.exit(1)
})
