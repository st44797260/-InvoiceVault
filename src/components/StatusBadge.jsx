import { STATUS_BADGE_STYLES } from '../lib/constants.js'

/** 发票状态徽标（已解析/待校正/已归档/解析失败） */
export default function StatusBadge({ status }) {
  const style = STATUS_BADGE_STYLES[status] ?? 'bg-slate-100 text-muted'
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${style}`}
    >
      {status ?? '未知'}
    </span>
  )
}
