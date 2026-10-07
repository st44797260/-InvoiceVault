/** 金额显示：千分位 + 固定两位小数 */
export function formatMoney(n) {
  return Number(n ?? 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
