import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import {
  Archive,
  ChevronDown,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import PdfViewer from '../components/PdfViewer.jsx'
import Skeleton from '../components/Skeleton.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Toast from '../components/Toast.jsx'
import { CATEGORIES } from '../lib/constants.js'
import { db } from '../lib/db.js'

const inputClass =
  'h-9 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

/** 表单里的金额字符串 → 数字或 null */
function toNumberOrNull(value) {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** 从记录中挑出表单可编辑字段，值为 null 时转成空串便于受控输入 */
function toFormState(inv) {
  return {
    invoiceCode: inv.invoiceCode ?? '',
    invoiceNumber: inv.invoiceNumber ?? '',
    invoiceDate: inv.invoiceDate ?? '',
    sellerName: inv.sellerName ?? '',
    sellerTaxId: inv.sellerTaxId ?? '',
    buyerName: inv.buyerName ?? '',
    buyerTaxId: inv.buyerTaxId ?? '',
    amountWithoutTax: inv.amountWithoutTax ?? '',
    taxAmount: inv.taxAmount ?? '',
    totalAmount: inv.totalAmount ?? '',
    category: inv.category ?? '',
  }
}

const itemInputClass =
  'h-8 w-full rounded-md border border-line bg-white px-2 text-xs text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20'

function numToInput(v) {
  return v == null ? '' : String(v)
}

/** items 表行 → 本地编辑草稿行（数值转字符串供受控输入） */
function toDraftRow(row) {
  return {
    key: `db-${row.id}`,
    id: row.id,
    itemName: row.itemName ?? '',
    specification: row.specification ?? '',
    quantity: numToInput(row.quantity),
    unitPrice: numToInput(row.unitPrice),
    amount: numToInput(row.amount),
    taxRate: row.taxRate ?? '',
    taxAmount: numToInput(row.taxAmount),
  }
}

function newDraftRow(key) {
  return {
    key,
    itemName: '',
    specification: '',
    quantity: '',
    unitPrice: '',
    amount: '',
    taxRate: '',
    taxAmount: '',
  }
}

export default function InvoiceDetail() {
  const { id } = useParams()
  const invoiceId = Number(id)

  // pending 时为 undefined；解析完成用 null 表示「记录不存在」，与加载态区分
  const invoice = useLiveQuery(
    async () => (await db.invoices.get(invoiceId)) ?? null,
    [invoiceId],
  )
  const loaded = invoice !== undefined

  const [form, setForm] = useState(null)
  const [fileData, setFileData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showRawText, setShowRawText] = useState(false)
  const [toast, setToast] = useState(null)

  // 仅在记录标识变化时于渲染期同步表单与文件字节：
  // 保存后的实时刷新 id 不变，不会覆盖未保存的编辑或重载 PDF 预览
  const recordKey = invoice ? `${invoice.id}` : null
  const [syncedKey, setSyncedKey] = useState(recordKey)
  if (recordKey !== syncedKey) {
    setSyncedKey(recordKey)
    if (invoice) {
      setForm(toFormState(invoice))
      setFileData(invoice.fileData ?? null)
    }
  }

  // 明细行草稿：进入页面/切换记录时从 items 表加载，
  // 编辑只发生在本地，点「保存校正结果 / 标记为已归档」时统一写回 items 表
  const [itemsDraft, setItemsDraft] = useState([])
  const itemKeyRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    db.items
      .where('invoiceId')
      .equals(invoiceId)
      .toArray()
      .then((rows) => {
        if (!cancelled) setItemsDraft(rows.map(toDraftRow))
      })
      .catch(() => {
        if (!cancelled) setItemsDraft([])
      })
    return () => {
      cancelled = true
    }
  }, [invoiceId])

  const setField = (key) => (e) => {
    const { value } = e.target
    setForm((f) => ({ ...f, [key]: value }))
  }

  const addItemRow = () => {
    itemKeyRef.current += 1
    setItemsDraft((d) => [...d, newDraftRow(`tmp-${itemKeyRef.current}`)])
  }

  const updateItemRow = (key, field, value) => {
    setItemsDraft((d) => d.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  }

  const removeItemRow = (key) => {
    setItemsDraft((d) => d.filter((r) => r.key !== key))
  }

  async function persist(patch) {
    setSaving(true)
    try {
      await db.invoices.update(invoiceId, patch)
      return true
    } catch (err) {
      setToast(`保存失败：${err?.message ?? err}`)
      return false
    } finally {
      setSaving(false)
    }
  }

  /** 把本地明细草稿写回 items 表：整删重建该发票的明细行 */
  async function syncItemsToDb() {
    const rows = itemsDraft
      .filter((r) => r.itemName.trim() !== '')
      .map(({ key: _key, id: _id, ...rest }) => ({
        invoiceId,
        itemName: rest.itemName.trim(),
        specification: rest.specification.trim() || null,
        quantity: toNumberOrNull(rest.quantity),
        unitPrice: toNumberOrNull(rest.unitPrice),
        amount: toNumberOrNull(rest.amount),
        taxRate: rest.taxRate.trim() || null,
        taxAmount: toNumberOrNull(rest.taxAmount),
      }))

    await db.transaction('rw', db.items, async () => {
      await db.items.where('invoiceId').equals(invoiceId).delete()
      if (rows.length > 0) await db.items.bulkAdd(rows)
    })

    // 重新拉取以获得持久化后的主键
    const saved = await db.items.where('invoiceId').equals(invoiceId).toArray()
    setItemsDraft(saved.map(toDraftRow))
    return rows.length
  }

  async function handleSave(status) {
    const ok = await persist({
      invoiceCode: form.invoiceCode.trim() || null,
      invoiceNumber: form.invoiceNumber.trim() || null,
      invoiceDate: form.invoiceDate || null,
      sellerName: form.sellerName.trim() || null,
      sellerTaxId: form.sellerTaxId.trim() || null,
      buyerName: form.buyerName.trim() || null,
      buyerTaxId: form.buyerTaxId.trim() || null,
      amountWithoutTax: toNumberOrNull(form.amountWithoutTax),
      taxAmount: toNumberOrNull(form.taxAmount),
      totalAmount: toNumberOrNull(form.totalAmount),
      category: form.category || null,
      status,
      archivedAt: status === '已归档' ? Date.now() : null,
    })
    if (!ok) return

    try {
      const count = await syncItemsToDb()
      setToast(
        status === '已归档'
          ? `已保存并归档，同步 ${count} 条商品明细`
          : `校正结果已保存，同步 ${count} 条商品明细`,
      )
    } catch (err) {
      setToast(`明细保存失败：${err?.message ?? err}`)
    }
  }

  if (!loaded) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-64" />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Skeleton className="h-[500px] rounded-xl" />
          <Skeleton className="h-[500px] rounded-xl" />
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="card flex h-64 flex-col items-center justify-center gap-3 text-center">
        <TriangleAlert className="h-8 w-8 text-warning" />
        <p className="text-sm font-medium text-ink">发票不存在或已被删除</p>
        <Link to="/invoices" className="text-sm font-medium text-primary hover:underline">
          ← 返回发票列表
        </Link>
      </div>
    )
  }

  // 表单状态在渲染期随记录标识同步，首遍渲染可能尚未就绪
  if (!form) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={invoice.invoiceNumber ?? `发票 #${invoice.id}`}
        description={`${invoice.fileName ?? '未命名文件'} · 上传于 ${invoice.createdAt ? invoice.createdAt.slice(0, 10) : '—'}`}
        actions={<StatusBadge status={invoice.status} />}
      />

      <div className="grid items-start grid-cols-1 gap-6 xl:grid-cols-2">
        {/* 左栏：PDF 预览 */}
        <PdfViewer data={fileData} fileName={invoice.fileName} />

        {/* 右栏：字段校正表单 + 商品明细 */}
        <div className="space-y-6">
          <form
            className="card p-5"
            onSubmit={(e) => {
              e.preventDefault()
              handleSave('待校正')
            }}
          >
          <h2 className="mb-4 text-sm font-semibold text-ink">字段校正</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="发票代码">
              <input value={form.invoiceCode} onChange={setField('invoiceCode')} className={`${inputClass} tabular-nums`} placeholder="未识别，可手动填写" />
            </Field>
            <Field label="发票号码">
              <input value={form.invoiceNumber} onChange={setField('invoiceNumber')} className={`${inputClass} tabular-nums`} />
            </Field>
            <Field label="开票日期">
              <input type="date" value={form.invoiceDate} onChange={setField('invoiceDate')} className={`${inputClass} tabular-nums`} />
            </Field>
            <Field label="分类">
              <select value={form.category} onChange={setField('category')} className={inputClass}>
                <option value="">未分类</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="销售方名称">
              <input value={form.sellerName} onChange={setField('sellerName')} className={inputClass} />
            </Field>
            <Field label="销售方税号">
              <input value={form.sellerTaxId} onChange={setField('sellerTaxId')} className={`${inputClass} tabular-nums`} />
            </Field>
            <Field label="购买方名称">
              <input value={form.buyerName} onChange={setField('buyerName')} className={inputClass} />
            </Field>
            <Field label="购买方税号">
              <input value={form.buyerTaxId} onChange={setField('buyerTaxId')} className={`${inputClass} tabular-nums`} />
            </Field>
            <Field label="不含税金额">
              <input type="number" step="0.01" min="0" value={form.amountWithoutTax} onChange={setField('amountWithoutTax')} className={`${inputClass} text-right tabular-nums`} />
            </Field>
            <Field label="税额">
              <input type="number" step="0.01" min="0" value={form.taxAmount} onChange={setField('taxAmount')} className={`${inputClass} text-right tabular-nums`} />
            </Field>
            <Field label="价税合计">
              <input type="number" step="0.01" min="0" value={form.totalAmount} onChange={setField('totalAmount')} className={`${inputClass} text-right tabular-nums`} />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              保存校正结果
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('已归档')}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-accent/40 bg-white px-4 text-sm font-medium text-accent transition-colors hover:bg-emerald-50 disabled:opacity-50"
            >
              <Archive className="h-4 w-4" />
              标记为已归档
            </button>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
          </form>

          {/* 商品明细：本地编辑，保存时写回 items 表 */}
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">商品明细</h2>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft"
              >
                <Plus className="h-3.5 w-3.5" />
                添加行
              </button>
            </div>

            {itemsDraft.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-muted">
                未识别到商品明细，点击「添加行」手动录入，保存时写入明细表。
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="pb-2 pr-2 font-medium">商品名称</th>
                      <th className="pb-2 pr-2 font-medium">规格</th>
                      <th className="pb-2 pr-2 font-medium">数量</th>
                      <th className="pb-2 pr-2 font-medium">单价</th>
                      <th className="pb-2 pr-2 font-medium">金额</th>
                      <th className="pb-2 pr-2 font-medium">税率</th>
                      <th className="pb-2 pr-2 font-medium">税额</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {itemsDraft.map((row) => (
                      <tr key={row.key}>
                        <td className="py-1 pr-2">
                          <input
                            value={row.itemName}
                            onChange={(e) => updateItemRow(row.key, 'itemName', e.target.value)}
                            className={itemInputClass}
                            aria-label="商品名称"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            value={row.specification}
                            onChange={(e) => updateItemRow(row.key, 'specification', e.target.value)}
                            className={itemInputClass}
                            aria-label="规格"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            value={row.quantity}
                            onChange={(e) => updateItemRow(row.key, 'quantity', e.target.value)}
                            className={` w-16 text-right tabular-nums`}
                            aria-label="数量"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            value={row.unitPrice}
                            onChange={(e) => updateItemRow(row.key, 'unitPrice', e.target.value)}
                            className={` w-20 text-right tabular-nums`}
                            aria-label="单价"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => updateItemRow(row.key, 'amount', e.target.value)}
                            className={` w-20 text-right tabular-nums`}
                            aria-label="金额"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            value={row.taxRate}
                            onChange={(e) => updateItemRow(row.key, 'taxRate', e.target.value)}
                            className={`${itemInputClass} w-14`}
                            aria-label="税率"
                            placeholder="13%"
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            value={row.taxAmount}
                            onChange={(e) => updateItemRow(row.key, 'taxAmount', e.target.value)}
                            className={` w-20 text-right tabular-nums`}
                            aria-label="税额"
                          />
                        </td>
                        <td className="py-1">
                          <button
                            type="button"
                            onClick={() => removeItemRow(row.key)}
                            title="删除行"
                            aria-label={`删除行 ${row.itemName || ''}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-red-50 hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 原始解析文本（可折叠） */}
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowRawText((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            <FileText className="h-4 w-4 text-muted" />
            原始解析文本
            <span className="text-xs font-normal text-muted">
              （解析自 PDF 的文本层，可用于核对校正结果）
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted transition-transform ${showRawText ? 'rotate-180' : ''}`}
          />
        </button>
        {showRawText && invoice.rawText && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-line"
          >
            <pre className="max-h-80 overflow-auto bg-slate-50/60 p-4 text-xs leading-relaxed text-muted whitespace-pre-wrap">
              {invoice.rawText}
            </pre>
          </motion.div>
        )}
        {showRawText && !invoice.rawText && (
          <p className="border-t border-line px-4 py-3 text-sm text-muted">该记录没有保存解析文本。</p>
        )}
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}
