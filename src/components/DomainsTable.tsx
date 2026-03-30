'use client'

import { useState } from 'react'
import { Badge, Button, Input, Select, Modal } from './ui'

interface Domain {
  id: string
  domain: string
  isUz: boolean
  saleStatus: string
  dnsResolved: boolean | null
  httpStatus: number | null
  evidenceParsed: string[]
  daScore: number | null
  lastChecked: string | null
  checkError: string | null
  sourceSites: string[]
  _count: { siteExternalDomains: number; links: number }
}

export function DomainsTable({
  domains,
  total,
  page,
  limit,
  onPageChange,
  onRefresh,
  filters,
  onFiltersChange,
}: {
  domains: Domain[]
  total: number
  page: number
  limit: number
  onPageChange: (p: number) => void
  onRefresh: () => void
  filters: { q: string; status: string; uz: boolean }
  onFiltersChange: (f: { q: string; status: string; uz: boolean }) => void
}) {
  const [selected, setSelected] = useState<Domain | null>(null)
  const [recheckLoading, setRecheckLoading] = useState<string | null>(null)

  const recheck = async (d: Domain) => {
    setRecheckLoading(d.id)
    await fetch(`/api/domains/${d.id}/recheck`, { method: 'POST' })
    onRefresh()
    setRecheckLoading(null)
  }

  const statusColor = {
    FOR_SALE: 'text-emerald-400',
    AVAILABLE: 'text-teal-400',
    NOT_FOR_SALE: 'text-slate-400',
    UNKNOWN: 'text-slate-500',
    CHECKING: 'text-blue-400',
    ERROR: 'text-red-400',
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <>
      {/* Filterlar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Input
          placeholder="Domen qidirish…"
          value={filters.q}
          onChange={e => onFiltersChange({ ...filters, q: e.target.value })}
          className="w-48"
        />
        <Select
          value={filters.status}
          onChange={e => onFiltersChange({ ...filters, status: e.target.value })}
          className="w-44"
        >
          <option value="">Barcha statuslar</option>
          <option value="FOR_SALE">Sotuvda</option>
          <option value="AVAILABLE">Bo'sh (ro'yxatdan o'tmagan)</option>
          <option value="NOT_FOR_SALE">Sotuvda emas</option>
          <option value="UNKNOWN">Noma'lum</option>
          <option value="CHECKING">Tekshirilmoqda</option>
          <option value="ERROR">Xatolik</option>
        </Select>
        <label className="flex items-center gap-1.5 text-sm text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.uz}
            onChange={e => onFiltersChange({ ...filters, uz: e.target.checked })}
            className="rounded"
          />
          Faqat .uz
        </label>
        <span className="ml-auto text-xs text-slate-500">{total} ta domen</span>
      </div>

      {/* Jadval */}
      <div className="overflow-x-auto rounded-lg border border-[#2a2d3e]">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="bg-[#12151f] border-b border-[#2a2d3e]">
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase">Domen</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase">Dalil</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-400 uppercase">DA</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-400 uppercase">Manbalar</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase">Tekshirilgan</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-400 uppercase">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {domains.map(d => (
              <tr
                key={d.id}
                className="border-b border-[#1f2235] hover:bg-[#1f2235] transition-colors"
              >
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => setSelected(d)}
                    className={`font-medium hover:underline ${d.isUz ? 'text-emerald-400' : 'text-slate-300'}`}
                  >
                    {d.domain}
                  </button>
                  <div className="flex gap-1 mt-0.5">
                    {d.isUz && <span className="text-xs text-emerald-600">.uz</span>}
                    {d.dnsResolved === false && <span className="text-xs text-teal-600">DNS N/A</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <Badge label={d.saleStatus} />
                </td>
                <td className="px-3 py-2.5 max-w-xs">
                  <p className="text-xs text-slate-400 truncate" title={d.evidenceParsed.join(', ')}>
                    {d.evidenceParsed.slice(0, 2).join(', ') || '—'}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {d.daScore !== null ? d.daScore : '—'}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                  {d._count.siteExternalDomains}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500">
                  {d.lastChecked ? new Date(d.lastChecked).toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => recheck(d)}
                    disabled={recheckLoading === d.id || d.saleStatus === 'CHECKING'}
                    title="Qayta tekshirish"
                  >
                    ↺
                  </Button>
                </td>
              </tr>
            ))}
            {domains.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  Domenlar topilmadi. Crawlni boshlang va tashqi linklar aniqlanadi.
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
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Domen: ${selected?.domain}`}>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-slate-500">Status: </span><Badge label={selected.saleStatus} /></div>
              <div><span className="text-slate-500">DNS: </span>
                <span className={selected.dnsResolved ? 'text-green-400' : 'text-red-400'}>
                  {selected.dnsResolved === null ? 'tekshirilmagan' : selected.dnsResolved ? 'topildi' : 'NXDOMAIN (bo\'sh)'}
                </span>
              </div>
              <div><span className="text-slate-500">HTTP status: </span>{selected.httpStatus ?? '—'}</div>
              <div><span className="text-slate-500">DA ball: </span>{selected.daScore ?? 'N/A'}</div>
              <div><span className="text-slate-500">Manba saytlar: </span>{selected._count.siteExternalDomains}</div>
              <div><span className="text-slate-500">Linklar soni: </span>{selected._count.links}</div>
            </div>

            {selected.evidenceParsed.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Sotuvda ekanligi dalillari</h4>
                <ul className="space-y-1">
                  {selected.evidenceParsed.map((e: string, i: number) => (
                    <li key={i} className="text-emerald-300 text-xs bg-emerald-900/20 rounded px-2 py-1">{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {selected.checkError && (
              <div className="bg-red-900/20 border border-red-800 rounded p-3 text-red-300 text-xs">
                {selected.checkError}
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Qaysi saytlarda uchragan</h4>
              <div className="flex flex-wrap gap-1">
                {selected.sourceSites.map(s => (
                  <span key={s} className="text-xs bg-slate-800 text-slate-300 rounded px-2 py-0.5">{s}</span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <a href={`https://${selected.domain}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-xs hover:underline">
                Saytni ochish ↗
              </a>
              <a href={`https://who.is/whois/${selected.domain}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-xs hover:underline">
                WHOIS ↗
              </a>
              <a href={`https://www.nic.uz/en/whois/?domain=${selected.domain}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 text-xs hover:underline">
                UZ-NIC ↗
              </a>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
