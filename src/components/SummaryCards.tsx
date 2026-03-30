'use client'

import type { DashboardStats } from '@/lib/types'
import { Card } from './ui'

interface Props {
  stats: DashboardStats
}

function StatCard({
  label,
  value,
  sub,
  color = 'slate',
}: {
  label: string
  value: number | string
  sub?: string
  color?: 'slate' | 'sky' | 'green' | 'emerald' | 'red' | 'yellow'
}) {
  const textColors = {
    slate: 'text-slate-200',
    sky: 'text-sky-400',
    green: 'text-green-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
  }
  return (
    <Card className="p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${textColors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </Card>
  )
}

export function SummaryCards({ stats }: Props) {
  const crawling = stats.sitesByStatus?.CRAWLING ?? 0
  const done = stats.sitesByStatus?.DONE ?? 0
  const errors = stats.sitesByStatus?.ERROR ?? 0
  const queued = stats.sitesByStatus?.QUEUED ?? 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard label="Jami saytlar" value={stats.totalSites} sub={`${queued} navbatda`} color="slate" />
      <StatCard label="Crawl qilindi" value={done} sub={`${crawling} jarayonda`} color="sky" />
      <StatCard label="Sahifalar" value={stats.totalPagesCrawled.toLocaleString()} color="slate" />
      <StatCard label="Tashqi domenlar" value={stats.totalExternalDomains.toLocaleString()} color="slate" />
      <StatCard
        label=".uz Domenlar"
        value={stats.totalUzDomains}
        sub={`${stats.totalForSaleDomains + stats.totalAvailableDomains} sotuvda/bo'sh`}
        color="emerald"
      />
      <StatCard
        label="Sotuvda / Bo'sh"
        value={stats.totalForSaleDomains + stats.totalAvailableDomains}
        sub={`${stats.totalAvailableDomains} ta ro'yxatdan o'tmagani`}
        color="green"
      />
    </div>
  )
}
