/**
 * 发票关键字段正则提取
 *
 * 输入为 pdfjs-dist 提取的原始 PDF 文本，输出字段对象；
 * 未匹配到的字段返回 null，由界面提示用户手动填写。
 */

const TAX_ID_PATTERN = /纳税人识别号[：:]\s*([A-Z0-9]{15,20})/

const FIELD_PATTERNS = {
  invoiceCode: /发票代码[：:]\s*(\d{10,12})/,
  invoiceNumber: /发票号码[：:]\s*(\d{8,20})/,
  invoiceDate: /开票日期[：:]\s*(\d{4}[-年]\d{1,2}[-月]\d{1,2}日?)/,
  sellerName: /销售方[名称]*[：:]\s*([^\n]+)/,
  sellerTaxId: TAX_ID_PATTERN,
  buyerName: /购买方[名称]*[：:]\s*([^\n]+)/,
  totalAmount: /价税合计[^\d]*(\d+\.?\d*)/,
  amountWithoutTax: /金额[^\d]*(\d+\.?\d*)/,
  taxAmount: /税额[^\d]*(\d+\.?\d*)/,
}

/** 用于统计已提取字段数量，与返回对象的键保持一致 */
export const EXTRACTABLE_FIELDS = [
  'invoiceCode',
  'invoiceNumber',
  'invoiceDate',
  'sellerName',
  'sellerTaxId',
  'buyerName',
  'buyerTaxId',
  'totalAmount',
  'amountWithoutTax',
  'taxAmount',
]

/** 「2025年9月8日」「2025-9-8」「2025-09-08」→「2025-09-08」 */
export function normalizeInvoiceDate(raw) {
  const m = /(\d{4})[-年](\d{1,2})[-月](\d{1,2})日?/.exec(raw ?? '')
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

function toAmount(raw) {
  if (raw == null) return null
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

export function extractInvoiceFields(text) {
  const match = (name) => {
    const m = FIELD_PATTERNS[name].exec(text ?? '')
    return m ? m[1].trim() : null
  }

  const rawDate = match('invoiceDate')

  // 购买方税号：取「购买方」命中位置之后、紧跟出现的第一处识别号
  let buyerTaxId = null
  const buyerMatch = FIELD_PATTERNS.buyerName.exec(text ?? '')
  if (buyerMatch) {
    const window = text.slice(buyerMatch.index + buyerMatch[0].length, buyerMatch.index + buyerMatch[0].length + 200)
    const m = TAX_ID_PATTERN.exec(window)
    buyerTaxId = m ? m[1] : null
  }

  return {
    invoiceCode: match('invoiceCode'),
    invoiceNumber: match('invoiceNumber'),
    invoiceDate: rawDate ? normalizeInvoiceDate(rawDate) : null,
    sellerName: match('sellerName'),
    sellerTaxId: match('sellerTaxId'),
    buyerName: match('buyerName'),
    buyerTaxId,
    totalAmount: toAmount(match('totalAmount')),
    amountWithoutTax: toAmount(match('amountWithoutTax')),
    taxAmount: toAmount(match('taxAmount')),
    items: [],
  }
}

/** 统计成功提取（非空非 null）的字段个数 */
export function countExtractedFields(fields) {
  return EXTRACTABLE_FIELDS.filter((key) => {
    const v = fields[key]
    return v !== null && v !== undefined && v !== ''
  }).length
}

/* ————— 商品明细提取 ————— */

const NUM_TOKEN = '\\d+(?:,\\d{3})*(?:\\.\\d+)?'

/**
 * 明细行尾部结构：数量 单价 金额 税率 [税额]。
 * 贪婪头部使正则总是匹配行尾的这组数字，商品名称/规格/序号都留在头部。
 */
const ITEM_LINE_PATTERN = new RegExp(
  `^(.+)\\s+(${NUM_TOKEN})\\s+(${NUM_TOKEN})\\s+(${NUM_TOKEN})\\s+(\\d{1,2}(?:\\.\\d+)?%|免税|不征税|\\*{3})(?:\\s+(${NUM_TOKEN}))?\\s*$`,
)

/** 「1、」「2.」「3 」等行首序号 */
const SEQ_PREFIX_PATTERN = /^(\d{1,3}[.、)]\s*|\d{1,3}\s+)/

function toNum(token) {
  if (token == null) return null
  const n = Number.parseFloat(token.replace(/[,¥￥]/g, ''))
  return Number.isFinite(n) ? n : null
}

/**
 * 从文本中提取商品明细行，返回
 * { itemName, specification, quantity, unitPrice, amount, taxRate, taxAmount } 数组。
 * 无法识别（没有命中明细行结构）时返回空数组。
 */
export function extractItems(text) {
  if (!text) return []
  const rows = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const m = ITEM_LINE_PATTERN.exec(line)
    if (!m) continue

    const head = m[1].replace(SEQ_PREFIX_PATTERN, '').trim()
    if (!head) continue

    const headTokens = head.split(/\s+/)
    rows.push({
      itemName: headTokens[0],
      specification: headTokens.length > 1 ? headTokens.slice(1).join(' ') : null,
      quantity: toNum(m[2]),
      unitPrice: toNum(m[3]),
      amount: toNum(m[4]),
      taxRate: m[5],
      taxAmount: toNum(m[6]),
    })
  }

  return rows
}
