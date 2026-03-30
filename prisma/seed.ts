/**
 * Optional seed: loads saytlar.example.json into the database.
 * Run: npm run db:seed
 */
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  const examplePath = path.resolve(__dirname, '../saytlar.example.json')
  if (!fs.existsSync(examplePath)) {
    console.log('No saytlar.example.json found, skipping seed')
    return
  }

  const raw = JSON.parse(fs.readFileSync(examplePath, 'utf-8')) as string[]
  let created = 0
  let skipped = 0

  for (const domain of raw) {
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!clean) continue
    const existing = await prisma.site.findUnique({ where: { domain: clean } })
    if (existing) { skipped++; continue }
    await prisma.site.create({ data: { domain: clean } })
    created++
  }

  console.log(`Seed done: created=${created}, skipped=${skipped}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
