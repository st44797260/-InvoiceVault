import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Banknote, CloudUpload, Coins, Download, FileText, ReceiptText, TrendingUp } from 'lucide-react'
import EmptyState from '../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Skeleton from '../components/Skeleton.jsx'
import StatCard from '../components/StatCard.jsx'
import { CATEGORIES } from '../lib/constants.js'
import { db } from '../lib/db.js'
import { exportToCSV } from '../lib/export.js'
import { formatMoney } from '../lib/format.js'

const dateClass =
  'h-9 rounded-lg border border-line bg-white px-3 text-sm text-ink tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

export default function Reports() {
  const invoices = useLiveQuery(() => db.invoices.toArray(), [])
  const loaded = invoices !== undefined
  const list = useMemo(() => invoices ?? [], [invoices])

  const [filters, setFilters] = useState({ start: '', end: '', keyword: '' })
  const [selectedCats, setSelectedCats] = useState([])

  const filtered = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    return list.filter((inv) => {
      if (filters.start && (inv.invoiceDate ?? '') < filters.start) return false
      if (filters.end && (inv.invoiceDate ?? '') > filters.end) return false
      if (selectedCats.length > 0 && !selectedCats.includes(inv.category ?? '其他')) return false
      if (keyword && !(inv.sellerName ?? '').toLowerCase().includes(keyword)) return false
      return true
    })
  }, [list, filters, selectedCats])

  const report = useMemo(() => {
    let total = 0
    let tax = 0
    const catMap = new Map()
    const monthMap = new Map()

    for (const inv of filtered) {
      const amount = inv.totalAmount ?? 0
      total += amount
      tax += inv.taxAmount ?? 0

      const cat = inv.category ?? '其他'
      const catEntry = catMap.get(cat) ?? { category: cat, count: 0, amount: 0, taxAmount: 0 }
      catEntry.count += 1
      catEntry.amount += amount
      catEntry.taxAmount += inv.taxAmount ?? 0
      catMap.set(cat, catEntry)

      const month = inv.invoiceDate?.slice(0, 7) ?? '未知月份'
      const monthEntry = monthMap.get(month) ?? { month, count: 0, amount: 0, taxAmount: 0 }
      monthEntry.count += 1
      monthEntry.amount += amount
      monthEntry.taxAmount += inv.taxAmount ?? 0
      monthMap.set(month, monthEntry)
    }

    const categories = [...catMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .map((e) => ({ ...e, share: total > 0 ? e.amount / total : 0 }))
    const months = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month))

    return { count: filtered.length, total, tax, avg: filtered.length > 0 ? total / filtered.length : 0, categories, months }
  }, [filtered])

  const toggleCat = (cat) =>
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    )

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))
  const hasFilters = filters.start || filters.end || filters.keyword || selectedCats.length > 0

  if (!loaded) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="统计报表" description="按时间、分类与销售方维度生成统计报表。" />
        <EmptyState
          icon={CloudUpload}
          title="还没有任何发票"
          description="上传发票后，这里将按分类和月份生成统计报表，并支持导出 CSV。"
          action={
            <Link
              to="/upload"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
            >
              <CloudUpload className="h-4 w-4" />
              去上传发票
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="统计报表"
        description="按时间、分类与销售方维度生成统计报表。"
        actions={
          <button
            type="button"
            onClick={() => exportToCSV(filtered)}
            disabled={filtered.length === 0}
            title="导出当前筛选结果为 CSV"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            导出CSV
          </button>
        }
      />

      {/* 筛选栏 */}
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.start}
              onChange={setFilter('start')}
              aria-label="开始日期"
              className={dateClass}
            />
            <span className="text-sm text-muted">至</span>
            <input
              type="date"
              value={filters.end}
              onChange={setFilter('end')}
              aria-label="结束日期"
              className={dateClass}
            />
          </div>
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <input
              type="search"
              value={filters.keyword}
              onChange={setFilter('keyword')}
              placeholder="按销售方搜索"
              className={`${dateClass} w-full`}
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setFilters({ start: '', end: '', keyword: '' })
                setSelectedCats([])
              }}
              className="h-9 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-slate-50 hover:text-ink"
            >
              重置筛选
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">分类</span>
          {CATEGORIES.map((cat) => {
            const on = selectedCats.includes(cat)
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCat(cat)}
                className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${
                  on
                    ? 'bg-primary text-white'
                    : 'border border-line bg-white text-muted hover:border-slate-300 hover:text-ink'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="没有符合筛选条件的发票"
          description="调整日期范围、分类或销售方关键词后重试。"
        />
      ) : (
        <>
          {/* 汇总卡片 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={ReceiptText} label="发票总数" value={report.count} sub="当前筛选范围" />
            <StatCard
              icon={Banknote}
              iconClass="bg-emerald-50 text-accent"
              label="总金额"
              value={report.total}
              decimals={2}
              prefix="¥"
              sub="价税合计求和"
            />
            <StatCard
              icon={Coins}
              iconClass="bg-amber-50 text-warning"
              label="总税额"
              value={report.tax}
              decimals={2}
              prefix="¥"
              sub="税额求和"
            />
            <StatCard
              icon={TrendingUp}
              iconClass="bg-violet-50 text-violet-600"
              label="平均单张金额"
              value={report.avg}
              decimals={2}
              prefix="¥"
              sub="总金额 / 发票总数"
            />
          </div>

          {/* 按分类统计 */}
          <div className="card overflow-hidden">
            <h2 className="px-4 pt-4 text-sm font-semibold text-ink">按分类统计</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-slate-50/60 text-left text-xs font-medium text-muted">
                    <th className="px-4 py-3 font-medium">分类</th>
                    <th className="px-4 py-3 font-medium">数量</th>
                    <th className="px-4 py-3 text-right font-medium">金额</th>
                    <th className="px-4 py-3 text-right font-medium">税额</th>
                    <th className="px-4 py-3 font-medium">金额占比</th>
                  </tr>
                </thead>
                <tbody>
                  {report.categories.map((row) => (
                    <tr key={row.category} className="border-b border-line/70 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-ink">{row.category}</td>
                      <td className="px-4 py-3 text-ink tabular-nums">{row.count}</td>
                      <td className="px-4 py-3 text-right text-ink tabular-nums">¥{formatMoney(row.amount)}</td>
                      <td className="px-4 py-3 text-right text-ink tabular-nums">¥{formatMoney(row.taxAmount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-14 text-right text-muted tabular-nums">
                            {(row.share * 100).toFixed(1)}%
                          </span>
                          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, row.share * 100)}%` }}
                            />
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 按月份统计 */}
          <div className="card overflow-hidden">
            <h2 className="px-4 pt-4 text-sm font-semibold text-ink">按月份统计</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-slate-50/60 text-left text-xs font-medium text-muted">
                    <th className="px-4 py-3 font-medium">月份</th>
                    <th className="px-4 py-3 font-medium">数量</th>
                    <th className="px-4 py-3 text-right font-medium">金额</th>
                    <th className="px-4 py-3 text-right font-medium">税额</th>
                  </tr>
                </thead>
                <tbody>
                  {report.months.map((row) => (
                    <tr key={row.month} className="border-b border-line/70 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-ink tabular-nums">{row.month}</td>
                      <td className="px-4 py-3 text-ink tabular-nums">{row.count}</td>
                      <td className="px-4 py-3 text-right text-ink tabular-nums">¥{formatMoney(row.amount)}</td>
                      <td className="px-4 py-3 text-right text-ink tabular-nums">¥{formatMoney(row.taxAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
