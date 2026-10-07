import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import EmptyState from '../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Skeleton from '../components/Skeleton.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Toast from '../components/Toast.jsx'
import { CATEGORIES, INVOICE_STATUSES } from '../lib/constants.js'
import { db } from '../lib/db.js'
import { exportToCSV } from '../lib/export.js'

const PAGE_SIZE = 20

const selectClass =
  'h-9 rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'
const dateClass =
  'h-9 rounded-lg border border-line bg-white px-3 text-sm text-ink tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

function matchesSearch(invoice, keyword) {
  if (!keyword) return true
  const k = keyword.toLowerCase()
  return [invoice.invoiceNumber, invoice.sellerName, invoice.buyerName]
    .filter(Boolean)
    .some((v) => v.toLowerCase().includes(k))
}

function matchesDateRange(invoice, { start, end }) {
  if (!start && !end) return true
  if (!invoice.invoiceDate) return false
  if (start && invoice.invoiceDate < start) return false
  if (end && invoice.invoiceDate > end) return false
  return true
}

export default function Invoices() {
  const [filters, setFilters] = useState({ start: '', end: '', status: '', category: '', keyword: '' })
  const [page, setPage] = useState(1)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const selectAllRef = useRef(null)

  // useLiveQuery 订阅 invoices 表：增删改后列表自动刷新
  const invoices = useLiveQuery(() => db.invoices.orderBy('createdAt').reverse().toArray(), [])

  const filtered = useMemo(() => {
    const list = invoices ?? []
    return list.filter(
      (inv) =>
        matchesSearch(inv, filters.keyword.trim()) &&
        matchesDateRange(inv, filters) &&
        (!filters.status || inv.status === filters.status) &&
        (!filters.category || inv.category === filters.category),
    )
  }, [invoices, filters])

  // 筛选条件变化时在渲染期回到第一页（避免在 effect 中同步 setState）
  const [lastFilters, setLastFilters] = useState(filters)
  if (lastFilters !== filters) {
    setLastFilters(filters)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  // 数据减少时页码收敛到有效范围
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const hasFilters = Object.values(filters).some(Boolean)

  // 全选框三态（全选/半选/未选）：直接写 DOM 属性，不经 setState
  const selectedOnPage = pageItems.filter((inv) => selected.has(inv.id)).length
  const allOnPageSelected = pageItems.length > 0 && selectedOnPage === pageItems.length
  const someOnPageSelected = selectedOnPage > 0 && !allOnPageSelected
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.checked = allOnPageSelected
      selectAllRef.current.indeterminate = someOnPageSelected
    }
  })

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const inv of pageItems) {
        if (allOnPageSelected) next.delete(inv.id)
        else next.add(inv.id)
      }
      return next
    })
  }

  async function bulkArchive() {
    await db.transaction('rw', db.invoices, async () => {
      for (const id of selected) {
        await db.invoices.update(id, { status: '已归档', archivedAt: Date.now() })
      }
    })
    setToast(`已归档 ${selected.size} 张发票`)
    setSelected(new Set())
  }

  async function bulkSetCategory(category) {
    await db.transaction('rw', db.invoices, async () => {
      for (const id of selected) {
        await db.invoices.update(id, { category })
      }
    })
    setToast(`已将 ${selected.size} 张发票的分类改为「${category}」`)
    setSelected(new Set())
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      await db.transaction('rw', [db.invoices, db.items], async () => {
        for (const id of selected) {
          await db.items.where('invoiceId').equals(id).delete()
          await db.invoices.delete(id)
        }
      })
      setToast(`已删除 ${selected.size} 张发票`)
      setSelected(new Set())
      setBulkDeleteOpen(false)
    } catch (err) {
      setToast(`批量删除失败：${err?.message ?? err}`)
    } finally {
      setBulkDeleting(false)
    }
  }

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))

  async function handleConfirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await db.transaction('rw', [db.invoices, db.items], async () => {
        await db.items.where('invoiceId').equals(toDelete.id).delete()
        await db.invoices.delete(toDelete.id)
      })
      setToast(`已删除发票 ${toDelete.invoiceNumber ?? `#${toDelete.id}`}`)
      setToDelete(null)
    } catch (err) {
      setToast(`删除失败：${err?.message ?? err}`)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="发票管理"
        description="共加载本机全部发票记录，支持筛选、搜索与人工校正。"
        actions={
          <div className="flex items-center gap-2">
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
            <Link
              to="/upload"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
          >
            <Upload className="h-4 w-4" />
            上传发票
          </Link>
          </div>
        }
      />

      {/* 筛选栏 */}
      <div className="card flex flex-wrap items-center gap-3 p-4">
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

        <select value={filters.status} onChange={setFilter('status')} aria-label="状态筛选" className={selectClass}>
          <option value="">全部状态</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select value={filters.category} onChange={setFilter('category')} aria-label="分类筛选" className={selectClass}>
          <option value="">全部分类</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filters.keyword}
            onChange={setFilter('keyword')}
            placeholder="搜索发票号码 / 销售方 / 购买方"
            className={`${selectClass} w-full pl-9`}
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => setFilters({ start: '', end: '', status: '', category: '', keyword: '' })}
            className="h-9 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-slate-50 hover:text-ink"
          >
            重置筛选
          </button>
        )}
      </div>

      {/* 批量操作栏 */}
      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="card flex flex-wrap items-center gap-3 border-primary/30 bg-primary-soft/50 px-4 py-3"
        >
          <span className="text-sm font-medium text-ink">已选中 {selected.size} 项</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) bulkSetCategory(e.target.value)
              }}
              aria-label="批量修改分类"
              className={selectClass}
            >
              <option value="">批量修改分类…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={bulkArchive}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-accent/40 bg-white px-3 text-sm font-medium text-accent transition-colors hover:bg-emerald-50"
            >
              <Archive className="h-4 w-4" />
              批量归档
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-danger/40 bg-white px-3 text-sm font-medium text-danger transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              批量删除
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="h-9 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-slate-50 hover:text-ink"
            >
              取消选择
            </button>
          </div>
        </motion.div>
      )}

      {/* 发票表格 / 卡片列表 */}
      {invoices === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : pageItems.length > 0 ? (
        <>
          {/* 桌面端表格 */}
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                <thead>
                  <tr className="border-b border-line bg-slate-50/60 text-left text-xs font-medium text-muted">
                    <th className="w-10 px-4 py-3">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        onChange={toggleSelectAll}
                        aria-label="全选本页"
                        className="h-4 w-4 cursor-pointer accent-primary"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">发票号码</th>
                    <th className="px-4 py-3 font-medium">开票日期</th>
                    <th className="px-4 py-3 font-medium">销售方</th>
                    <th className="px-4 py-3 font-medium">购买方</th>
                    <th className="px-4 py-3 text-right font-medium">价税合计</th>
                    <th className="px-4 py-3 font-medium">分类</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-line/70 transition-colors last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(inv.id)}
                          onChange={() => toggleSelect(inv.id)}
                          aria-label={`选择 ${inv.invoiceNumber ?? inv.id}`}
                          className="h-4 w-4 cursor-pointer accent-primary"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="font-medium text-primary tabular-nums hover:underline"
                        >
                          {inv.invoiceNumber ?? `#${inv.id}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink tabular-nums">{inv.invoiceDate ?? '—'}</td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-ink">{inv.sellerName ?? '—'}</td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-ink">{inv.buyerName ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-ink tabular-nums">
                        {inv.totalAmount != null ? `¥${inv.totalAmount.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted">{inv.category ?? '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/invoices/${inv.id}`}
                            title="查看"
                            aria-label={`查看 ${inv.invoiceNumber ?? inv.id}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary-soft hover:text-primary"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            title="删除"
                            aria-label={`删除 ${inv.invoiceNumber ?? inv.id}`}
                            onClick={() => setToDelete(inv)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 移动端卡片列表 */}
          <div className="space-y-3 md:hidden">
            {pageItems.map((inv) => (
              <div key={inv.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(inv.id)}
                    onChange={() => toggleSelect(inv.id)}
                    aria-label={`选择 ${inv.invoiceNumber ?? inv.id}`}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="truncate font-medium text-primary tabular-nums hover:underline"
                      >
                        {inv.invoiceNumber ?? `#${inv.id}`}
                      </Link>
                      <StatusBadge status={inv.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted tabular-nums">{inv.invoiceDate ?? '日期未识别'}</p>
                    <p className="mt-0.5 truncate text-sm text-ink">{inv.sellerName ?? '销售方未识别'}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink tabular-nums">
                        {inv.totalAmount != null ? `¥${inv.totalAmount.toFixed(2)}` : '—'}
                      </span>
                      <div className="flex items-center gap-1">
                        <Link
                          to={`/invoices/${inv.id}`}
                          title="查看"
                          aria-label={`查看 ${inv.invoiceNumber ?? inv.id}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary-soft hover:text-primary"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          title="删除"
                          aria-label={`删除 ${inv.invoiceNumber ?? inv.id}`}
                          onClick={() => setToDelete(inv)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 分页（桌面表格与移动卡片共用） */}
          <div className="card flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted tabular-nums">
              共 {filtered.length} 条 · 第 {currentPage} / {totalPages} 页
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-ink transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="flex h-8 items-center gap-1 rounded-lg border border-line px-3 text-ink transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={FileText}
          title={invoices.length > 0 ? '没有符合条件的发票' : '暂无发票'}
          description={
            invoices.length > 0
              ? '试试调整筛选条件或重置筛选。'
              : '上传 PDF 发票后，列表将在此实时展示。'
          }
          action={
            invoices.length === 0 ? (
              <Link
                to="/upload"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
              >
                <Upload className="h-4 w-4" />
                去上传发票
              </Link>
            ) : null
          }
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="确认删除该发票？"
        description={
          toDelete
            ? `将删除发票「${toDelete.invoiceNumber ?? `#${toDelete.id}`}」及其全部明细数据，删除后不可恢复。`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setToDelete(null)}
        busy={deleting}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`确认删除选中的 ${selected.size} 张发票？`}
        description="将删除这些发票及其全部明细数据，删除后不可恢复。"
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
        busy={bulkDeleting}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}
