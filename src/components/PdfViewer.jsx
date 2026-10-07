import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FileWarning,
  Loader2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { openPdfDocument } from '../lib/pdf.js'

const MIN_SCALE = 0.6
const MAX_SCALE = 2.5
const SCALE_STEP = 0.2

function ToolButton({ children, ...props }) {
  return (
    <button
      type="button"
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  )
}

/**
 * PDF 画布预览：pdfjs-dist 渲染到 canvas，支持翻页与缩放。
 * data 为 PDF 文件字节（ArrayBuffer / Uint8Array），为空时显示未保存提示。
 */
export default function PdfViewer({ data, fileName }) {
  const canvasRef = useRef(null)
  const renderTaskRef = useRef(null)
  const [pdf, setPdf] = useState(null)
  const [pageNum, setPageNum] = useState(1)
  const [scale, setScale] = useState(1)
  const [error, setError] = useState(null)

  // data 变化时在渲染期重置状态（避免在 effect 中同步 setState）
  const [prevData, setPrevData] = useState(data)
  if (prevData !== data) {
    setPrevData(data)
    setPdf(null)
    setPageNum(1)
    setScale(1)
    setError(null)
  }

  // 打开进度可由派生状态表达：有数据但文档尚未就绪且无错误
  const loading = Boolean(data) && !pdf && !error

  // 打开/关闭文档（与外部系统同步，setState 均发生在异步回调中）
  useEffect(() => {
    if (!data) return undefined

    const task = openPdfDocument(data)
    let cancelled = false
    task.promise
      .then((doc) => {
        if (!cancelled) setPdf(doc)
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
    return () => {
      cancelled = true
      task.destroy()
    }
  }, [data])

  // 渲染当前页（参数变化时取消上一次未完成的渲染）
  useEffect(() => {
    if (!pdf) return undefined

    let cancelled = false

    async function render() {
      renderTaskRef.current?.cancel()
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return

      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`

      const ctx = canvas.getContext('2d')
      const task = page.render({
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      })
      renderTaskRef.current = task
      await task.promise
    }

    render().catch((err) => {
      if (!cancelled && err?.name !== 'RenderingCancelledException') setError(err)
    })

    return () => {
      cancelled = true
    }
  }, [pdf, pageNum, scale])

  const numPages = pdf?.numPages ?? 0

  return (
    <div className="card overflow-hidden">
      {/* 工具栏：翻页 / 文件名 / 缩放 */}
      <div className="flex items-center justify-between gap-2 border-b border-line bg-white px-3 py-2">
        <div className="flex items-center gap-0.5">
          <ToolButton
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            aria-label="上一页"
          >
            <ChevronLeft className="h-4 w-4" />
          </ToolButton>
          <span className="px-1 text-sm text-ink tabular-nums">
            第 {pageNum} / {numPages || '—'} 页
          </span>
          <ToolButton
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
            disabled={!pdf || pageNum >= numPages}
            aria-label="下一页"
          >
            <ChevronRight className="h-4 w-4" />
          </ToolButton>
        </div>

        {fileName && (
          <span className="hidden max-w-[40%] truncate text-xs text-muted sm:block">
            {fileName}
          </span>
        )}

        <div className="flex items-center gap-0.5">
          <ToolButton
            onClick={() => setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)))}
            disabled={scale <= MIN_SCALE}
            aria-label="缩小"
          >
            <ZoomOut className="h-4 w-4" />
          </ToolButton>
          <span className="w-12 text-center text-sm text-muted tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <ToolButton
            onClick={() => setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)))}
            disabled={scale >= MAX_SCALE}
            aria-label="放大"
          >
            <ZoomIn className="h-4 w-4" />
          </ToolButton>
        </div>
      </div>

      {/* 画布区域 */}
      <div className="relative max-h-[72vh] min-h-[320px] overflow-auto bg-slate-100 p-4">
        {!data ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-center">
            <FileWarning className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-ink">未保存原文件</p>
            <p className="text-sm text-muted">该记录创建于文件保存功能上线前，重新上传即可预览。</p>
          </div>
        ) : (
          <>
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/80">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            {error && !loading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-100/90 text-center">
                <FileWarning className="h-8 w-8 text-danger" />
                <p className="text-sm font-medium text-ink">PDF 渲染失败</p>
                <p className="max-w-xs text-xs text-muted">{String(error?.message ?? error)}</p>
              </div>
            )}
            <div className="flex min-h-[300px] justify-center">
              <canvas ref={canvasRef} className="rounded-md bg-white shadow-sm" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
