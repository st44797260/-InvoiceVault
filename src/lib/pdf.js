/**
 * pdfjs-dist 文本提取与文档打开封装
 *
 * 按行重建文本：当文本项的 hasEOL 为真，或基线纵坐标发生明显跳变时插入换行，
 * 保证「发票号码：xxx」这类字段正则能按行命中。
 */
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/** 判定为换行的纵坐标跳变阈值（PDF 单位，约等于一行字的间距） */
const LINE_GAP = 2

/**
 * 打开 PDF 文档，返回 loadingTask（pdfjs v6 的销毁入口在 loadingTask 上）。
 * pdf.js 会把传入的 buffer 转移给 worker 使其 detach，因此这里始终传一份拷贝，
 * 调用方持有的原始字节（如待入库的 fileData）不受影响。
 * @param {ArrayBuffer|Uint8Array} data
 */
export function openPdfDocument(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return pdfjsLib.getDocument({ data: bytes.slice() })
}

/**
 * 提取 PDF 全文文本。
 * @param {ArrayBuffer|Uint8Array} data PDF 文件字节
 */
export async function extractPdfText(data) {
  const loadingTask = openPdfDocument(data)
  const pdf = await loadingTask.promise

  let text = ''
  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      if (pageNo > 1) text += '\n'
      const page = await pdf.getPage(pageNo)
      const content = await page.getTextContent()

      let lastY = null
      for (const item of content.items) {
        if (typeof item.str !== 'string') continue
        const y = item.transform?.[5]
        if (text && (item.hasEOL || (lastY !== null && Math.abs(y - lastY) > LINE_GAP))) {
          text += '\n'
        }
        text += item.str
        lastY = y
      }
      page.cleanup()
    }
  } finally {
    await loadingTask.destroy()
  }

  return text
}
