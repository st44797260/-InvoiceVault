/**
 * 单个发票文件的完整解析入库流程：
 * PDF 文本提取 → 字段/明细正则抽取 → 自动分类 → 重复检测 → 事务写入 invoices + items 表。
 * 原始文件字节存入 fileData，供详情页画布预览使用。
 */
import { extractInvoiceFields, extractItems, countExtractedFields } from './extract.js'
import { extractPdfText } from './pdf.js'
import { autoCategorize } from './categorize.js'
import { checkDuplicate, db } from './db.js'

export async function parseAndSaveInvoice(file) {
  const data = await file.arrayBuffer()
  const text = await extractPdfText(data)

  if (!text || !text.trim()) {
    // 扫描件（图片型 PDF）提取不到文本层
    return { ok: false, message: '未提取到文本，请手动录入' }
  }

  const fields = extractInvoiceFields(text)
  const extractedItems = extractItems(text)
  fields.category = autoCategorize(fields.sellerName, extractedItems)

  const duplicate = await checkDuplicate(fields.invoiceCode, fields.invoiceNumber)
  const fieldsCount = countExtractedFields(fields)

  let id
  await db.transaction('rw', [db.invoices, db.items], async () => {
    // 明细存 items 表，记录本身不再冗余 items 数组
    const { items: _items, ...invoiceFields } = fields
    id = await db.invoices.add({
      ...invoiceFields,
      rawText: text,
      fileData: data,
      status: duplicate ? '重复' : '已解析',
      isDuplicate: duplicate,
      archivedAt: null,
      fileName: file.name,
      createdAt: new Date().toISOString(),
    })
    if (extractedItems.length > 0) {
      await db.items.bulkAdd(extractedItems.map((item) => ({ ...item, invoiceId: id })))
    }
  })

  return { ok: true, id, fields, fieldsCount, itemsCount: extractedItems.length, duplicate }
}
