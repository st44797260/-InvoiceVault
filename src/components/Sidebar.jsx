import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChartColumn,
  CircleHelp,
  CloudUpload,
  FileText,
  Files,
  FolderArchive,
  LayoutDashboard,
  Settings,
  X,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: '概览', icon: LayoutDashboard, end: true },
  { to: '/invoices', label: '发票管理', icon: FileText },
  { to: '/upload', label: '上传发票', icon: CloudUpload },
  { to: '/archive', label: '归档分类', icon: FolderArchive },
  { to: '/reports', label: '统计报表', icon: ChartColumn },
  { to: '/settings', label: '设置', icon: Settings },
]

/** 侧边栏内容：桌面端与移动端抽屉共用 */
function SidebarContent({ onNavigate }) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
          <Files className="h-5 w-5" />
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-ink">
          InvoiceVault
        </span>
      </div>

      {/* 主导航 */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-soft text-primary'
                  : 'text-muted hover:bg-slate-50 hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* 底部帮助 */}
      <div className="border-t border-line p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-slate-50 hover:text-ink"
        >
          <CircleHelp className="h-[18px] w-[18px] shrink-0" />
          帮助
        </button>
      </div>
    </>
  )
}

export default function Sidebar({ mobileOpen = false, onClose }) {
  return (
    <>
      {/* 桌面端固定侧边栏 */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white md:flex">
        <SidebarContent />
      </aside>

      {/* 移动端抽屉 */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] md:hidden"
              onClick={onClose}
            />
            <motion.aside
              key="sidebar-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-line bg-white md:hidden"
              aria-label="导航菜单"
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭菜单"
                className="absolute right-3 top-6 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-ink"
              >
                <X className="h-4.5 w-4.5" />
              </button>
              <SidebarContent onNavigate={onClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
