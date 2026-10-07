import AnimatedNumber from './AnimatedNumber.jsx'

/**
 * 统计卡片：图标 + 标签 + 滚动数字 + 副文案。
 * 看板与报表页共用。
 */
export default function StatCard({
  icon: Icon,
  iconClass = 'bg-primary-soft text-primary',
  label,
  value,
  decimals = 0,
  prefix = '',
  sub,
}) {
  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink">
        {prefix}
        <AnimatedNumber value={value} decimals={decimals} />
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
}
