import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, FileText } from 'lucide-react'
import EmptyState from '../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Skeleton from '../components/Skeleton.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { CATEGORIES } from '../lib/constants.js'
import { db } from '../lib/db.js'
import { exportToCSV } from '../lib/export.js'
import { formatMoney } from '../lib/format.js'

const NAV_ITEMS = ['全部', ...CATEGORIES]

export default function Archive() {
  const invoices = useLiveQuery(() => db.invoices.toArray(), [])
  const loaded = invoices !== undefined
  const [active, setActive] = useState('全部')

  // 各分类的数量与总金额（未分类的发票归入「其他」）
  const stats = useMemo(() => {
    const map = new Map(NAV_ITEMS.map((cat) => [cat, { count: 0, total: 0 }]))
    for (const inv of invoices ?? []) {
      const cat = inv.category ?? '其他'
      const amount = inv.totalAmount ?? 0
      const bucket = map.get(cat)
      if (bucket) {
        bucket.count += 1
        bucket.total += amount
      }
      map.get('全部').count += 1
      map.get('全部').total += amount
    }
    return map
  }, [invoices])

  const filtered = useMemo(() => {
    const list = invoices ?? []
    return active === '全部' ? list : list.filter((inv) => (inv.category ?? '其他') === active)
  }, [invoices, active])

  const summary = stats.get(active) ?? { count: 0, total: 0 }

  if (!loaded) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-32" />
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[230px_1fr]">
          <Skeleton className="h-72 rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-16 rounded-xl" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="归档分类"
        description="按分类浏览全部发票，点击卡片进入详情校正或归档。"
        actions={
          <button
            type="button"
            onClick={() => exportToCSV(filtered)}
            disabled={filtered.length === 0}
            title="导出当前分类的发票为 CSV"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            导出CSV
          </button>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[230px_1fr]">
        {/* 左侧分类导航 */}
        <nav className="card space-y-1 p-2" aria-label="分类导航">
          {NAV_ITEMS.map((cat) => {
            const s = stats.get(cat)
            const activeCls =
              active === cat ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-slate-50 hover:text-ink'
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActive(cat)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeCls}`}
              >
                <span>{cat}</span>
                <span className="text-xs tabular-nums opacity-90">
                  {s.count} 项 · ¥{formatMoney(s.total)}
                </span>
              </button>
            )
          })}
        </nav>

        {/* 右侧：当前分类统计 + 发票卡片列表 */}
        <div className="space-y-4">
          <div className="card flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ink">{active}</p>
              <p className="mt-0.5 text-xs text-muted tabular-nums">
                共 {summary.count} 张发票 · 合计金额 ¥{formatMoney(summary.total)}
              </p>
            </div>
            <p className="text-xs text-muted">点击卡片进入发票详情</p>
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtered.map((inv) => (
                <Link
                  key={inv.id}
                  to={`/invoices/${inv.id}`}
                  className="card card-hover block p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium text-primary tabular-nums">
                      {inv.invoiceNumber ?? `#${inv.id}`}
                    </span>
                    <StatusBadge status={inv.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted tabular-nums">{inv.invoiceDate ?? '日期未识别'}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <span className="truncate text-sm text-ink">{inv.sellerName ?? '销售方未识别'}</span>
                    <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                      {inv.totalAmount != null ? `¥${formatMoney(inv.totalAmount)}` : '—'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title={invoices?.length ? `「${active}」分类下暂无发票` : '暂无发票'}
              description={
                invoices?.length
                  ? '可在发票详情页为发票设置分类。'
                  : '上传发票并设置分类后，将在此展示。'
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
