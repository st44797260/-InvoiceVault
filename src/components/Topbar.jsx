import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, CloudUpload, Menu, Search } from 'lucide-react'

function getBreadcrumbs(pathname) {
  if (pathname === '/') return ['概览']
  if (/^\/invoices\/[^/]+$/.test(pathname)) return ['发票管理', '发票详情']
  if (pathname.startsWith('/invoices')) return ['发票管理']
  if (pathname.startsWith('/upload')) return ['上传发票']
  if (pathname.startsWith('/archive')) return ['归档分类']
  if (pathname.startsWith('/reports')) return ['统计报表']
  if (pathname.startsWith('/settings')) return ['设置']
  return []
}

export default function Topbar({ onOpenMenu }) {
  const { pathname } = useLocation()
  const crumbs = getBreadcrumbs(pathname)

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-white/80 px-4 backdrop-blur sm:gap-3 sm:px-6">
      {/* 移动端汉堡菜单 */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="打开导航菜单"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-ink md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* 面包屑 */}
      <nav
        aria-label="面包屑"
        className="flex min-w-0 shrink items-center gap-1 overflow-hidden"
      >
        {crumbs.length === 0 ? (
          <span className="truncate text-sm font-medium text-ink">InvoiceVault</span>
        ) : (
          crumbs.map((label, i) => (
            <span key={label} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />}
              <span
                className={`truncate text-sm ${
                  i === crumbs.length - 1 ? 'font-medium text-ink' : 'text-muted'
                }`}
              >
                {label}
              </span>
            </span>
          ))
        )}
      </nav>

      {/* 全局搜索（移动端隐藏） */}
      <div className="relative ml-auto hidden w-full max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="搜索发票号、销售方、购买方…"
          className="h-9 w-full rounded-lg border border-line bg-page pl-9 pr-3 text-sm text-ink placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
      </div>

      {/* 上传发票按钮 */}
      <Link
        to="/upload"
        className="ml-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark active:scale-[0.98] sm:px-4 md:ml-0"
      >
        <CloudUpload className="h-4 w-4" />
        <span className="hidden sm:inline">上传发票</span>
        <span className="sm:hidden">上传</span>
      </Link>
    </header>
  )
}
