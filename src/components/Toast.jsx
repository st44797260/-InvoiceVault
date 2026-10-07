import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

/** 右下角轻提示，message 变化或置空时自动隐藏（2.4s） */
export default function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(onDone, 2400)
    return () => clearTimeout(timer)
  }, [message, onDone])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink shadow-lg"
        >
          <CheckCircle2 className="h-4 w-4 text-accent" />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
