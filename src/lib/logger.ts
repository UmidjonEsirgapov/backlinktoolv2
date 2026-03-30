import { prisma } from './db'
import type { LogLevel } from './types'

export class Logger {
  constructor(private siteId?: string) {}

  private async write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const line = `[${level}]${this.siteId ? ` [site:${this.siteId}]` : ''} ${message}`
    if (process.env.NODE_ENV !== 'test') {
      const colors: Record<LogLevel, string> = {
        DEBUG: '\x1b[90m', INFO: '\x1b[36m', WARN: '\x1b[33m', ERROR: '\x1b[31m',
      }
      console.log(`${colors[level]}${line}\x1b[0m`)
    }
    try {
      await prisma.crawlLog.create({
        data: {
          siteId: this.siteId ?? null,
          level,
          message,
          meta: meta ? JSON.stringify(meta) : null,
        },
      })
    } catch {
      // Never crash the caller because of logging failure
    }
  }

  debug(msg: string, meta?: Record<string, unknown>) { return this.write('DEBUG', msg, meta) }
  info(msg: string, meta?: Record<string, unknown>) { return this.write('INFO', msg, meta) }
  warn(msg: string, meta?: Record<string, unknown>) { return this.write('WARN', msg, meta) }
  error(msg: string, meta?: Record<string, unknown>) { return this.write('ERROR', msg, meta) }
}

export const globalLogger = new Logger()
