import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useEffect } from 'react'

/**
 * 数字滚动动画：挂载时从 0 滚动到目标值，之后随值变化平滑滚动。
 * 通过 MotionValue 渲染，滚动过程不触发 React 重渲染。
 */
export default function AnimatedNumber({ value, decimals = 0 }) {
  const motionValue = useMotionValue(0)
  const text = useTransform(motionValue, (v) =>
    v.toLocaleString('zh-CN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  )

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.9, ease: 'easeOut' })
    return () => controls.stop()
  }, [motionValue, value])

  return <motion.span className="tabular-nums">{text}</motion.span>
}
