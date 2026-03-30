import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // Ensure data directory exists
  const dbUrl = process.env.DATABASE_URL ?? 'file:./data/backlink.db'
  if (dbUrl.startsWith('file:')) {
    const filePath = dbUrl.replace('file:', '')
    const dir = path.dirname(path.resolve(filePath))
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalThis.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

// Enable WAL mode for better concurrent read/write (web + worker both access same DB)
let walEnabled = false
export async function enableWAL() {
  if (walEnabled) return
  walEnabled = true
  try {
    await prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;')
    await prisma.$executeRawUnsafe('PRAGMA synchronous=NORMAL;')
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys=ON;')
    await prisma.$executeRawUnsafe('PRAGMA busy_timeout=5000;')
  } catch {
    // Ignore — may not be SQLite
  }
}
