'use client'

import { useState, useCallback } from 'react'
import { Badge, Button, Input, Select, Modal } from './ui'

interface Site {
  id: string
  domain: string
  status: string
  pagesCrawled: number
  pagesQueued: number
  pagesError: number
  externalLinksFound: number
  uzDomainsFound: number
  errorMsg: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

async function apiCall(url: string, opts?: RequestInit) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts?.headers } })
  return res.json()
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-800 rounded-full h-1.5">
        <div className="bg-sky-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  )
}

export function SitesTable({
  sites,
  total,
  page,
  limit,
  onPageChange,
  onRefresh,
}: {
  sites: Site[]
  total: number
  page: number
  limit: number
  onPageChange: (p: number) => void
  onRefresh: () => void
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [siteLogs, setSiteLogs] = useState<Array<{ level: string; message: string; createdAt: string }>>([])

  const handleAction = useCallback(async (action: string, siteId: string) => {
    setLoading(siteId)
    try {
      await apiCall('/api/control', {
        method: 'POST',
        body: JSON.stringify({ action, siteId }),
      })
      onRefresh()
    } finally {
      setLoading(null)
    }
  }, [onRefresh])

  const openDetail = async (site: Site) => {
    setSelectedSite(site)
    const logs = await fetch(`/api/sites/${site.id}/logs?limit=50`).then(r => r.json())
    setSiteLogs(logs)
  }

  const statusLabels: Record<string, string> = {
    QUEUED: 'Navbatda',
    CRAWLING: 'Crawl qilinmoqda',
    DONE: 'Tugadi',
    ERROR: 'Xatolik',
    PAUSED: 'To\'xtatilgan',
    SKIPPED: 'O\'tkazib yuborildi',
  }

  const filtered = sites.filter(s => {
    if (search && !s.domain.includes(search)) return false
    if (statusFilter && s.status !== statusFilter) return false
    return true
  })

  const totalPages = Math.ceil(total / limit)

  return (
    <>
      {/* Filterlar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Input
          placeholder="Domen qidirish…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-48"
        />
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-44">
          <option value="">Barcha statuslar</option>
          {Object.entries(statusLabels).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </Select>
        <span className="ml-auto text-xs text-slate-500">{total} ta sayt</span>
      </div>

      {/* Jadval */}
      <div className="overflow-x-auto rounded-lg border border-[#2a2d3e]">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="bg-[#12151f] border-b border-[#2a2d3e]">
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase">Domen</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase">Jarayon</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-400 uppercase">Tashqi domenlar</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-400 uppercase">.uz</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(site => (
              <tr key={site.id} className="border-b border-[#1f2235] hover:bg-[#1f2235] transition-colors">
                <td className="px-3 py-2.5">
                  <button onClick={() => openDetail(site)} className="text-sky-400 hover:text-sky-300 font-medium hover:underline">
                    {site.domain}
                  </button>
                  {site.errorMsg && (
                    <p className="text-xs text-red-400 truncate max-w-xs" title={site.errorMsg}>{site.errorMsg}</p>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <Badge label={site.status} />
                </td>
                <td className="px-3 py-2.5 min-w-[140px]">
                  <ProgressBar current={site.pagesCrawled} total={Math.max(site.pagesQueued, 1)} />
                  <p className="text-xs text-slate-500 mt-0.5">
                    {site.pagesCrawled}/{site.pagesQueued} sahifa
                    {site.pagesError > 0 && <span className="text-red-400 ml-1">({site.pagesError} xato)</span>}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{site.externalLinksFound || '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-400 font-medium">{site.uzDomainsFound || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    {(site.status === 'QUEUED' || site.status === 'ERROR') && (
                      <Button size="sm" variant="primary" onClick={() => handleAction('start_one', site.id)} disabled={loading === site.id} title="Boshlash">▶</Button>
                    )}
                    {site.status === 'CRAWLING' && (
                      <Button size="sm" variant="secondary" onClick={() => handleAction('stop_one', site.id)} disabled={loading === site.id} title="To'xtatish">⏸</Button>
                    )}
                    {site.status === 'PAUSED' && (
                      <Button size="sm" variant="primary" onClick={() => handleAction('start_one', site.id)} disabled={loading === site.id} title="Davom ettirish">↩</Button>
                    )}
                    {site.status === 'DONE' && (
                      <Button size="sm" variant="ghost" onClick={() => handleAction('reset_site', site.id)} disabled={loading === site.id} title="Qayta crawl qilish">↺</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  Saytlar topilmadi. Import qilib, crawlni boshlang.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sahifalash */}
      {totalPages > 1 && (
        <div className="flex justify-end gap-2 mt-3">
          <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>← Oldingi</Button>
          <span className="text-sm text-slate-400 self-center">{page} / {totalPages}</span>
          <Button size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Keyingi →</Button>
        </div>
      )}

      {/* Batafsil modal */}
      <Modal open={!!selectedSite} onClose={() => setSelectedSite(null)} title={`Sayt: ${selectedSite?.domain}`}>
        {selectedSite && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Status: </span><Badge label={selectedSite.status} /></div>
              <div><span className="text-slate-500">Crawl qilingan: </span>{selectedSite.pagesCrawled} sahifa</div>
              <div><span className="text-slate-500">Tashqi domenlar: </span>{selectedSite.externalLinksFound}</div>
              <div><span className="text-slate-500">.uz domenlar: </span><span className="text-emerald-400">{selectedSite.uzDomainsFound}</span></div>
              {selectedSite.startedAt && (
                <div><span className="text-slate-500">Boshlangan: </span>{new Date(selectedSite.startedAt).toLocaleString('uz-UZ')}</div>
              )}
              {selectedSite.completedAt && (
                <div><span className="text-slate-500">Tugagan: </span>{new Date(selectedSite.completedAt).toLocaleString('uz-UZ')}</div>
              )}
            </div>
            {selectedSite.errorMsg && (
              <div className="bg-red-900/30 border border-red-800 rounded p-3 text-sm text-red-300">
                {selectedSite.errorMsg}
              </div>
            )}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">So'nggi loglar</h4>
              <div className="bg-[#0f1117] rounded border border-[#2a2d3e] p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
                {siteLogs.length === 0 && <p className="text-slate-500">Hali log yo'q</p>}
                {siteLogs.map((l, i) => (
                  <div key={i} className={`flex gap-2 ${l.level === 'ERROR' ? 'text-red-400' : l.level === 'WARN' ? 'text-yellow-400' : 'text-slate-300'}`}>
                    <span className="text-slate-600 shrink-0">{new Date(l.createdAt).toLocaleTimeString()}</span>
                    <span>[{l.level}]</span>
                    <span>{l.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
