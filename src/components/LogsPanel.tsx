'use client'

import { useEffect, useRef } from 'react'
import type { LogEntry } from '@/lib/types'

export function LogsPanel({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  const levelColors: Record<string, string> = {
    ERROR: 'text-red-400',
    WARN: 'text-yellow-400',
    WARNING: 'text-yellow-400',
    INFO: 'text-slate-300',
    DEBUG: 'text-slate-500',
  }

  const levelBg: Record<string, string> = {
    ERROR: 'bg-red-900/10',
    WARN: 'bg-yellow-900/10',
    WARNING: 'bg-yellow-900/10',
    INFO: '',
    DEBUG: '',
  }

  return (
    <div className="bg-[#0f1117] border border-[#2a2d3e] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#2a2d3e] flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Jonli Loglar</span>
        <span className="text-xs text-slate-600">{logs.length} ta yozuv</span>
      </div>
      <div className="h-80 overflow-y-auto font-mono text-xs p-3 space-y-0.5">
        {logs.length === 0 && (
          <p className="text-slate-600 p-4 text-center">Hali log yo'q — crawlni boshlang va jarayon shu yerda ko'rinadi.</p>
        )}
        {[...logs].reverse().map(log => (
          <div
            key={log.id}
            className={`flex gap-2 px-1.5 py-0.5 rounded ${levelBg[log.level] ?? ''}`}
          >
            <span className="text-slate-600 shrink-0 w-20">
              {new Date(log.createdAt).toLocaleTimeString()}
            </span>
            <span className={`w-12 shrink-0 ${levelColors[log.level] ?? 'text-slate-400'}`}>
              [{log.level}]
            </span>
            {log.siteDomain && (
              <span className="text-sky-700 shrink-0 max-w-[120px] truncate">{log.siteDomain}</span>
            )}
            <span className={`flex-1 ${levelColors[log.level] ?? 'text-slate-400'}`}>
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
