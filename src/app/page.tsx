'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { SummaryCards } from '@/components/SummaryCards'
import { SitesTable } from '@/components/SitesTable'
import { DomainsTable } from '@/components/DomainsTable'
import { LogsPanel } from '@/components/LogsPanel'
import { ImportModal } from '@/components/ImportModal'
import { Button, Spinner } from '@/components/ui'
import type { DashboardStats } from '@/lib/types'

type Tab = 'sites' | 'domains' | 'logs'

const REFRESH_INTERVAL = 4_000

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('sites')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [sites, setSites] = useState<{ sites: unknown[]; total: number }>({ sites: [], total: 0 })
  const [domains, setDomains] = useState<{ domains: unknown[]; total: number }>({ domains: [], total: 0 })
  const [sitesPage, setSitesPage] = useState(1)
  const [domainsPage, setDomainsPage] = useState(1)
  const [domainFilters, setDomainFilters] = useState({ q: '', status: 'SALE_OR_EMPTY', uz: true, siteId: '' })
  const [importOpen, setImportOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const refreshRef = useRef<NodeJS.Timeout>()

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3_500)
  }

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      if (res.ok) setStats(await res.json())
    } catch { /* silent */ }
  }, [])

  const fetchSites = useCallback(async () => {
    const res = await fetch(`/api/sites?page=${sitesPage}&limit=50`)
    if (res.ok) setSites(await res.json())
  }, [sitesPage])

  const fetchDomains = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(domainsPage),
      limit: '100',
      ...(domainFilters.q ? { q: domainFilters.q } : {}),
      ...(domainFilters.status ? { status: domainFilters.status } : {}),
      ...(domainFilters.uz ? { uz: '1' } : {}),
      ...(domainFilters.siteId ? { siteId: domainFilters.siteId } : {}),
    })
    const res = await fetch(`/api/domains?${params}`)
    if (res.ok) setDomains(await res.json())
  }, [domainsPage, domainFilters])

  const refresh = useCallback(() => {
    fetchStats()
    fetchSites()
    fetchDomains()
  }, [fetchStats, fetchSites, fetchDomains])

  useEffect(() => {
    refresh()
    refreshRef.current = setInterval(refresh, REFRESH_INTERVAL)
    return () => clearInterval(refreshRef.current)
  }, [refresh])

  const controlAction = async (action: string) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (action === 'start') showNotification(`▶ ${data.queued ?? 0} ta sayt navbatga qo'yildi`)
      if (action === 'pause') showNotification('⏸ Tizim to\'xtatildi')
      if (action === 'resume') showNotification(`↩ ${data.resumed ?? 0} ta sayt davom ettirildi`)
      if (action === 'recheck_uz') showNotification(`↺ ${data.queued ?? 0} ta .uz domen tekshiruvga qo'yildi`)
      refresh()
    } finally {
      setActionLoading(false)
    }
  }

  const handleExport = (type: string, format: string) => {
    const url = `/api/export?type=${type}&format=${format}${domainFilters.uz ? '&uz=1' : ''}`
    window.open(url, '_blank')
  }

  const isPaused = stats?.systemPaused ?? false
  const isWorkerRunning = stats?.workerRunning ?? false

  return (
    <div className="min-h-screen">
      {/* Sarlavha */}
      <header className="bg-[#1a1d27] border-b border-[#2a2d3e] sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center gap-4">
          <h1 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-sky-400">🔗</span> Backlink Tool
          </h1>
          <div className="flex items-center gap-1 ml-2">
            <div className={`w-2 h-2 rounded-full ${isWorkerRunning ? 'bg-green-400 pulse' : 'bg-slate-600'}`} />
            <span className="text-xs text-slate-500">
              {isPaused ? 'to\'xtatilgan' : isWorkerRunning ? 'ishlamoqda' : 'worker o\'chiq'}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              variant="primary"
              onClick={() => controlAction('start')}
              disabled={actionLoading}
              title="Navbatdagi barcha saytlarni boshlash"
            >
              ▶ Barchasini boshlash
            </Button>
            {isPaused ? (
              <Button size="sm" variant="secondary" onClick={() => controlAction('resume')} disabled={actionLoading}>
                ↩ Davom ettirish
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => controlAction('pause')} disabled={actionLoading}>
                ⏸ To'xtatish
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => controlAction('recheck_uz')} disabled={actionLoading} title=".uz domenlarni qayta tekshirish">
              ↺ .uz tekshirish
            </Button>
            <div className="w-px h-5 bg-[#2a2d3e] mx-1" />
            <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
              📥 Import
            </Button>
            <div className="relative group">
              <Button size="sm" variant="secondary">📤 Yuklab olish ▾</Button>
              <div className="absolute right-0 top-full mt-1 bg-[#1a1d27] border border-[#2a2d3e] rounded-lg shadow-xl py-1 hidden group-hover:block w-52 z-50">
                <button onClick={() => handleExport('sale', 'csv')} className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#2a2d3e] text-slate-300">
                  Sotuvdagi domenlar (CSV)
                </button>
                <button onClick={() => handleExport('sale', 'json')} className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#2a2d3e] text-slate-300">
                  Sotuvdagi domenlar (JSON)
                </button>
                <button onClick={() => handleExport('domains', 'csv')} className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#2a2d3e] text-slate-300">
                  Barcha .uz domenlar (CSV)
                </button>
                <button onClick={() => handleExport('sites', 'csv')} className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#2a2d3e] text-slate-300">
                  Saytlar hisoboti (CSV)
                </button>
              </div>
            </div>
            {actionLoading && <Spinner size={14} />}
          </div>
        </div>
      </header>

      {/* Bildirishnoma */}
      {notification && (
        <div className="fixed top-14 right-4 z-50 bg-green-800 text-green-100 px-4 py-2 rounded-lg text-sm shadow-lg animate-pulse">
          {notification}
        </div>
      )}

      <main className="max-w-screen-2xl mx-auto px-4 py-5 space-y-5">
        {stats ? (
          <SummaryCards stats={stats} />
        ) : (
          <div className="flex justify-center py-8"><Spinner size={24} /></div>
        )}

        {/* Tablar */}
        <div>
          <div className="flex gap-1 border-b border-[#2a2d3e] mb-4">
            {(['sites', 'domains', 'logs'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === t
                    ? 'border-sky-500 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'sites' && `Saytlar (${stats?.totalSites ?? 0})`}
                {t === 'domains' && `.uz Domenlar (${stats?.totalUzDomains ?? 0})`}
                {t === 'logs' && 'Loglar'}
              </button>
            ))}
          </div>

          {tab === 'sites' && (
            <SitesTable
              sites={sites.sites as Parameters<typeof SitesTable>[0]['sites']}
              total={sites.total}
              page={sitesPage}
              limit={50}
              onPageChange={setSitesPage}
              onRefresh={refresh}
              onViewDomainsForSite={siteId => {
                setDomainFilters(prev => ({ ...prev, siteId }))
                setDomainsPage(1)
                setTab('domains')
              }}
              onNotify={showNotification}
            />
          )}

          {tab === 'domains' && (
            <DomainsTable
              domains={domains.domains as Parameters<typeof DomainsTable>[0]['domains']}
              total={domains.total}
              page={domainsPage}
              limit={100}
              onPageChange={setDomainsPage}
              onRefresh={refresh}
              filters={domainFilters}
              onFiltersChange={f => {
                if (f.siteId !== domainFilters.siteId) setDomainsPage(1)
                setDomainFilters(f)
              }}
            />
          )}

          {tab === 'logs' && stats && (
            <LogsPanel logs={stats.recentLogs} />
          )}
        </div>
      </main>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={result => {
          setImportOpen(false)
          showNotification(`✓ ${result.created} ta sayt import qilindi`)
          refresh()
        }}
      />
    </div>
  )
}
