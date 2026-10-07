/** 骨架屏基础块：脉冲灰块，用 className 控制形状 */
export default function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />
}
