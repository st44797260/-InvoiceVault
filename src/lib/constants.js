/** 发票分类选项（列表筛选与详情编辑共用） */
export const CATEGORIES = ['餐饮', '交通', '住宿', '办公', '服务', '其他']

/** 发票状态选项 */
export const INVOICE_STATUSES = ['已解析', '待校正', '已归档', '解析失败', '重复']

/** 状态徽标配色 */
export const STATUS_BADGE_STYLES = {
  已解析: 'bg-blue-50 text-primary',
  待校正: 'bg-amber-50 text-warning',
  已归档: 'bg-emerald-50 text-accent',
  解析失败: 'bg-red-50 text-danger',
  重复: 'bg-red-50 text-danger',
}
