/**
 * 发票 CSV 导出：原生 Blob + UTF-8 BOM，保证 Excel 直接打开不乱码。
 */
import { format } from 'date-fns'

const CSV_HEADERS = [
  '发票代码',
  '发票号码',
  '开票日期',
  '销售方',
  '购买方',
  '不含税金额',
  '税额',
  '价税合计',
  '分类',
  '状态',
]

/** 单元格转义：含逗号/引号/换行的值用双引号包裹，内部引号翻倍 */
function csvCell(value) {
  if (value == null) return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function invoicesToCSV(invoices) {
  const lines = [CSV_HEADERS.join(',')]
  for (const inv of invoices ?? []) {
    lines.push(
      [
        inv.invoiceCode,
        inv.invoiceNumber,
        inv.invoiceDate,
        inv.sellerName,
        inv.buyerName,
        inv.amountWithoutTax,
        inv.taxAmount,
        inv.totalAmount,
        inv.category,
        inv.status,
      ]
        .map(csvCell)
        .join(','),
    )
  }
  // UTF-8 BOM + CRLF 行尾，兼容 Excel
  return `\uFEFF${lines.join('\r\n')}`
}

/** 导出为 CSV 文件并触发浏览器下载 */
export function exportToCSV(invoices) {
  const csv = invoicesToCSV(invoices)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `发票报表_${format(new Date(), 'yyyy-MM-dd')}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
