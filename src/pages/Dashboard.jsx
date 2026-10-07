import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { eachMonthOfInterval, format, subMonths } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Banknote,
  CloudUpload,
  Coins,
  FileText,
  Hourglass,
  ReceiptText,
} from 'lucide-react'
import EmptyState from '../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Skeleton from '../components/Skeleton.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { formatMoney } from '../lib/format.js'
import { db } from '../lib/db.js'

const CATEGORY_COLORS = {
  餐饮: '#F59E0B',
  交通: '#0EA5E9',
  住宿: '#7C3AED',
  办公: '#059669',
  服务: '#2563EB',
  其他: '#94A3B8',
}

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid #E4E9F2',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
  fontSize: 12,
}

// 看板的"当前月份"以应用加载时刻为准，刷新页面即更新
const NOW = new Date()
const MONTH_KEY = format(NOW, 'yyyy-MM')

function truncate(text, max = 10) {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export default function Dashboard() {
  const invoices = useLiveQuery(() => db.invoices.toArray(), [])
  const loaded = invoices !== undefined
  const list = useMemo(() => invoices ?? [], [invoices])

  const stats = useMemo(() => {
    let monthAmount = 0
    let monthTax = 0
    let pending = 0

    // 近12个月趋势桶
    const months = eachMonthOfInterval({ start: subMonths(NOW, 11), end: NOW })
    const trendKeys = months.map((m) => format(m, 'yyyy-MM'))
    const trendMap = new Map(trendKeys.map((k) => [k, 0]))

    // 分类分布
    const catMap = new Map()
    // 供应商累计金额
    const sellerMap = new Map()

    for (const inv of list) {
      const amount = inv.totalAmount ?? 0
      if (inv.invoiceDate?.startsWith(MONTH_KEY)) {
        monthAmount += amount
        monthTax += inv.taxAmount ?? 0
      }
      if (inv.status === '已解析' || inv.status === '待校正') pending += 1
      if (trendMap.has(inv.invoiceDate?.slice(0, 7))) {
        trendMap.set(inv.invoiceDate.slice(0, 7), trendMap.get(inv.invoiceDate.slice(0, 7)) + amount)
      }
      const cat = inv.category ?? '其他'
      const catEntry = catMap.get(cat) ?? { category: cat, count: 0, amount: 0 }
      catEntry.count += 1
      catEntry.amount += amount
      catMap.set(cat, catEntry)
      if (inv.sellerName) {
        sellerMap.set(inv.sellerName, (sellerMap.get(inv.sellerName) ?? 0) + amount)
      }
    }

    const trend = trendKeys.map((key, i) => ({
      month: format(months[i], 'M月'),
      amount: +trendMap.get(key).toFixed(2),
    }))

    const pie = [...catMap.values()]
      .sort((a, b) => b.count - a.count)
      .map((e) => ({ ...e, amount: +e.amount.toFixed(2) }))

    const suppliers = [...sellerMap.entries()]
      .map(([seller, amount]) => ({ seller, short: truncate(seller), amount: +amount.toFixed(2) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)

    const recent = [...list]
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, 5)

    return { total: list.length, monthAmount, monthTax, pending, trend, pie, suppliers, recent }
  }, [list])

  if (!loaded) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-32" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="概览" description="发票总量、金额统计与近期动态。" />
        <EmptyState
          icon={CloudUpload}
          title="还没有任何发票"
          description="上传 PDF 发票后，这里将展示金额趋势、分类分布与供应商统计。"
          action={
            <Link
              to="/upload"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark"
            >
              <CloudUpload className="h-4 w-4" />
              去上传发票
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="概览" description="发票总量、金额统计与近期动态。" />

      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ReceiptText}
          label="总发票数"
          value={stats.total}
          sub="全部状态的发票记录"
        />
        <StatCard
          icon={Banknote}
          iconClass="bg-emerald-50 text-accent"
          label="本月发票金额"
          value={stats.monthAmount}
          decimals={2}
          prefix="¥"
          sub={`统计月份 ${MONTH_KEY}`}
        />
        <StatCard
          icon={Coins}
          iconClass="bg-amber-50 text-warning"
          label="本月税额"
          value={stats.monthTax}
          decimals={2}
          prefix="¥"
          sub="按开票日期在本月统计"
        />
        <StatCard
          icon={Hourglass}
          iconClass="bg-red-50 text-danger"
          label="待处理发票数"
          value={stats.pending}
          sub='状态为"已解析"或"待校正"'
        />
      </div>

      {/* 中部图表 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink">近12个月发票金额趋势</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="amountGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E9F2" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={{ stroke: '#E4E9F2' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(v) => [`¥${formatMoney(v)}`, '发票金额']}
                  contentStyle={tooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#amountGradient)"
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink">发票分类分布</h2>
          <div className="mt-4 h-64">
            {stats.pie.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted">暂无分类数据</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pie}
                    dataKey="count"
                    nameKey="category"
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    animationDuration={900}
                  >
                    {stats.pie.map((entry) => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? '#94A3B8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, name, item) => [`${v} 张 · ¥${formatMoney(item?.payload?.amount ?? 0)}`, name]}
                    contentStyle={tooltipStyle}
                  />
                  <Legend
                    iconType="circle"
                    formatter={(value) => <span className="text-xs text-muted">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 底部：供应商TOP5 + 最近上传 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink">供应商 TOP5（按累计金额）</h2>
          <div className="mt-4 h-64">
            {stats.suppliers.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted">
                暂无含销售方信息的发票
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.suppliers}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E9F2" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="short"
                    width={120}
                    tick={{ fontSize: 12, fill: '#0F172A' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v) => [`¥${formatMoney(v)}`, '累计金额']}
                    contentStyle={tooltipStyle}
                  />
                  <Bar
                    dataKey="amount"
                    fill="#2563EB"
                    radius={[0, 6, 6, 0]}
                    barSize={18}
                    animationDuration={900}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">最近上传</h2>
            <Link to="/invoices" className="text-xs font-medium text-primary hover:underline">
              查看全部
            </Link>
          </div>
          <div className="mt-2 divide-y divide-line">
            {stats.recent.map((inv) => (
              <Link
                key={inv.id}
                to={`/invoices/${inv.id}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink tabular-nums">
                    {inv.invoiceNumber ?? `#${inv.id}`}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {inv.invoiceDate ?? '日期未识别'} · {inv.sellerName ?? '销售方未识别'}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                  {inv.totalAmount != null ? `¥${formatMoney(inv.totalAmount)}` : '—'}
                </span>
                <StatusBadge status={inv.status} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
