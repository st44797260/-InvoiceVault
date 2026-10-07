import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  CloudUpload,
  FileText,
  ListOrdered,
  Loader2,
  XCircle,
} from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import { EXTRACTABLE_FIELDS } from '../lib/extract.js'
import { parseAndSaveInvoice } from '../lib/upload.js'

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** 队列条目状态 → 图标 / 徽标样式 / 中文标签 */
const STATUS_META = {
  parsing: {
    label: '解析中',
    icon: Loader2,
    badge: 'bg-blue-50 text-primary',
    iconClass: 'animate-spin text-primary',
  },
  success: {
    label: '成功',
    icon: CheckCircle2,
    badge: 'bg-emerald-50 text-accent',
    iconClass: 'text-accent',
  },
  failed: {
    label: '失败',
    icon: XCircle,
    badge: 'bg-red-50 text-danger',
    iconClass: 'text-danger',
  },
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.badge}`}
    >
      <Icon className={`h-3.5 w-3.5 ${meta.iconClass}`} />
      {meta.label}
    </span>
  )
}

export default function Upload() {
  const [queue, setQueue] = useState([])
  const [rejectedCount, setRejectedCount] = useState(0)
  const [dropPulse, setDropPulse] = useState(false)
  const pulseTimer = useRef(null)

  /** 文件投入后的缩放脉冲反馈 */
  const triggerDropPulse = useCallback(() => {
    setDropPulse(true)
    clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setDropPulse(false), 450)
  }, [])

  const updateItem = useCallback((id, patch) => {
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const onDrop = useCallback(
    async (acceptedFiles, fileRejections) => {
      setRejectedCount(fileRejections.length)
      triggerDropPulse()

      const items = acceptedFiles.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        status: 'parsing',
        message: '',
        fieldsCount: 0,
      }))
      setQueue((q) => [...q, ...items])

      // 逐个解析，避免多个 PDF 抢占同一个 worker
      for (let i = 0; i < acceptedFiles.length; i++) {
        const item = items[i]
        try {
          const result = await parseAndSaveInvoice(acceptedFiles[i])
          if (result.ok) {
            const total = EXTRACTABLE_FIELDS.length
            const missing = total - result.fieldsCount
            let message = `解析完成，共提取 ${result.fieldsCount} 个字段、${result.itemsCount} 条明细`
            if (missing > 0) message += `，${missing} 个字段未识别，可稍后手动填写`
            if (result.duplicate) message += '；检测到与已有发票重复，已标记为「重复」'
            updateItem(item.id, {
              status: 'success',
              fieldsCount: result.fieldsCount,
              message,
            })
          } else {
            updateItem(item.id, { status: 'failed', message: result.message })
          }
        } catch (err) {
          updateItem(item.id, {
            status: 'failed',
            message: `解析出错：${err instanceof Error ? err.message : String(err)}`,
          })
        }
      }
    },
    [triggerDropPulse, updateItem],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: { 'application/pdf': ['.pdf'] },
  })

  const successCount = queue.filter((item) => item.status === 'success').length
  const failedCount = queue.filter((item) => item.status === 'failed').length
  const parsingCount = queue.filter((item) => item.status === 'parsing').length
  const allDone = queue.length > 0 && parsingCount === 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="上传发票"
        description="上传 PDF 发票，自动解析文本并提取关键字段，全部在本机完成。"
      />

      {/* 拖拽上传区 */}
      <div
        {...getRootProps()}
        data-testid="dropzone"
        className={`card flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-all duration-200 ${
          isDragActive
            ? 'scale-[1.02] border-primary bg-primary-soft shadow-md ring-4 ring-primary/10'
            : 'border-line hover:border-slate-300 hover:shadow-md'
        } ${dropPulse ? 'scale-[1.01] ring-2 ring-primary/40' : ''}`}
      >
        <input {...getInputProps()} />
        <span
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
            isDragActive ? 'bg-primary text-white' : 'bg-primary-soft text-primary'
          }`}
        >
          <CloudUpload className="h-7 w-7" />
        </span>
        <div>
          <p className="text-sm font-medium text-ink">
            {isDragActive ? '松开鼠标即可开始解析' : '拖拽 PDF 发票到此处，或点击选择文件'}
          </p>
          <p className="mt-1 text-sm text-muted">支持批量上传，仅限 PDF 格式，文件不会离开本机</p>
        </div>
      </div>

      {rejectedCount > 0 && (
        <p className="text-sm text-warning">
          已忽略 {rejectedCount} 个非 PDF 文件，仅支持 PDF 格式。
        </p>
      )}

      {/* 上传队列 */}
      {queue.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">解析队列</h2>
          {queue.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="card flex items-center gap-4 px-4 py-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                <p className="mt-0.5 text-xs text-muted tabular-nums">
                  {formatFileSize(item.size)}
                  {item.message && <span className="text-muted"> · {item.message}</span>}
                </p>
                {item.status === 'parsing' && (
                  <span className="mt-1.5 block h-1 w-full max-w-48 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full w-1/3 rounded-full bg-primary [animation:upload-slide_1.1s_ease-in-out_infinite]" />
                  </span>
                )}
              </div>
              <StatusBadge status={item.status} />
            </motion.div>
          ))}
        </div>
      )}

      {/* 全部完成后的汇总 */}
      {allDone && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="card flex flex-wrap items-center justify-between gap-3 border-accent/30 bg-emerald-50/60 px-4 py-3"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <ListOrdered className="h-4 w-4 text-accent" />
            <span className="tabular-nums">
              解析完成：成功 {successCount} 个，失败 {failedCount} 个
            </span>
          </div>
          <Link
            to="/invoices"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
          >
            查看发票列表
          </Link>
        </motion.div>
      )}
    </div>
  )
}
