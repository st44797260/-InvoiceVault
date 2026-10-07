/**
 * 发票自动分类：按销售方名称 → 商品明细的顺序做关键词匹配，
 * 销售方命中优先于明细命中，全部未命中归入「其他」。
 */
const CATEGORY_KEYWORDS = {
  餐饮: ['餐饮', '饭店', '餐厅', '食品', '美食'],
  交通: ['交通', '出租', '滴滴', '航空', '铁路', '加油', '停车'],
  住宿: ['酒店', '宾馆', '住宿', '民宿'],
  办公: ['办公', '文具', '电脑', '耗材', '打印'],
  服务: ['咨询', '服务', '技术服务', '广告', '设计'],
}

function matchCategory(text) {
  const t = text ?? ''
  if (!t) return null
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => t.includes(k))) return category
  }
  return null
}

export function autoCategorize(sellerName, items) {
  const sellerHit = matchCategory(sellerName)
  if (sellerHit) return sellerHit

  for (const item of items ?? []) {
    const hit = matchCategory(`${item.itemName ?? ''} ${item.specification ?? ''}`)
    if (hit) return hit
  }
  return '其他'
}
