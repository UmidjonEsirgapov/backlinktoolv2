'use client'

import { useState, useRef } from 'react'
import { Modal, Button } from './ui'

export function ImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: (result: { created: number; skipped: number }) => void
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const content = ev.target?.result as string
      setText(content)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!text.trim()) return
    setLoading(true)
    setResult(null)
    try {
      let body: string
      let contentType = 'application/json'

      // Try to parse as JSON
      try {
        const parsed = JSON.parse(text)
        body = JSON.stringify(parsed)
      } catch {
        // Plain text — newline or comma separated
        contentType = 'text/plain'
        body = text
      }

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body,
      })
      const data = await res.json()
      setResult({ created: data.created, skipped: data.skipped })
      onImported({ created: data.created, skipped: data.skipped })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Saytlarni import qilish">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-slate-400 mb-3">
            Domenlar ro'yxatini joylashtiring yoki fayl yuklang. Qo'llab-quvvatlanadigan formatlar:
          </p>
          <ul className="text-xs text-slate-500 space-y-1.5 mb-3">
            <li>• Oddiy matn: har qatorda bitta domen (yoki vergul bilan)</li>
            <li>• JSON massiv: <code className="text-slate-400">["domain.uz", "site.com"]</code></li>
            <li>• <strong className="text-slate-400">Sizning formatiz:</strong> <code className="text-slate-400">[{"{"}"Sayt manzili (URL)": "domain.uz", ...{"}"}]</code></li>
            <li>• <code className="text-slate-400">{"{"}"sites": [...]{"}"}</code> yoki <code className="text-slate-400">{"{"}"domains": [...]{"}"}</code></li>
          </ul>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
            📂 Fayl yuklash
          </Button>
          <input ref={fileRef} type="file" accept=".json,.txt,.csv" className="hidden" onChange={handleFile} />
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={`kun.uz\ndaryo.uz\nspot.uz\n\nyoki JSON:\n["kun.uz", "daryo.uz"]\n\nyoki sizning formatiz:\n[{"Sayt manzili (URL)": "kun.uz", "Sayt nomi (Title)": "..."}]`}
          className="w-full h-48 bg-[#0f1117] border border-[#2a2d3e] rounded px-3 py-2 text-sm font-mono text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-sky-500"
        />

        {result && (
          <div className="bg-green-900/20 border border-green-800 rounded p-3 text-sm text-green-300">
            ✓ {result.created} ta yangi sayt qo'shildi. {result.skipped} ta takroriy o'tkazib yuborildi.
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button variant="primary" onClick={handleImport} disabled={loading || !text.trim()}>
            {loading ? 'Import qilinmoqda…' : 'Import qilish'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
