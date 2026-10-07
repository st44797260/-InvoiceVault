import Dexie from 'dexie'

export const db = new Dexie('InvoiceVaultDB')

db.version(1).stores({
  invoices:
    '++id, invoiceNumber, invoiceDate, sellerName, buyerName, category, status, totalAmount, createdAt',
  items: '++id, invoiceId',
  settings: 'key',
})

/**
 * 重复检测：是否已存在相同 invoiceCode + invoiceNumber 的发票。
 * 两段号码都能唯一对上才算重复；invoiceNumber 缺失时不判定。
 * isDuplicate（boolean）与 archivedAt（毫秒时间戳）为记录数据字段，未建索引。
 */
export async function checkDuplicate(invoiceCode, invoiceNumber) {
  if (!invoiceNumber) return false
  const found = await db.invoices
    .where('invoiceNumber')
    .equals(invoiceNumber)
    .filter((inv) => (inv.invoiceCode ?? null) === (invoiceCode ?? null))
    .first()
  return found !== undefined
}
