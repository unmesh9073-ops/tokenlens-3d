import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useStudioStore } from '../../store/useStudioStore'

const INPUT_PRESETS: Array<{ label: string; text: string }> = [
  { label: 'English', text: 'Tokenization makes AI read!' },
  { label: 'Emojis', text: 'AI loves rockets 🚀✨' },
  { label: 'Python', text: 'def tokenize(x): return x + 1' },
  { label: 'Hindi', text: 'नमस्ते AI दुनिया' },
  { label: 'Regex Trap', text: 'dog. dog! dog? <|endoftext|>' },
]

export function SpotlightInput() {
  const isSpotlightOpen = useStudioStore((s) => s.isSpotlightOpen)
  const setSpotlightOpen = useStudioStore((s) => s.setSpotlightOpen)
  const inputText = useStudioStore((s) => s.inputText)
  const setInputText = useStudioStore((s) => s.setInputText)
  const useRegex = useStudioStore((s) => s.useRegex)
  const setUseRegex = useStudioStore((s) => s.setUseRegex)
  const labMode = useStudioStore((s) => s.labMode)
  const setLabMode = useStudioStore((s) => s.setLabMode)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSpotlightOpen) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 40)
      return () => window.clearTimeout(id)
    }
  }, [isSpotlightOpen])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSpotlightOpen(!isSpotlightOpen)
      } else if (e.key === '/' && !isSpotlightOpen) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !target?.isContentEditable) {
          e.preventDefault()
          setSpotlightOpen(true)
        }
      } else if (e.key === 'Escape' && isSpotlightOpen) {
        e.preventDefault()
        setSpotlightOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSpotlightOpen, setSpotlightOpen])

  return (
    <AnimatePresence>
      {isSpotlightOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center pb-24 px-4"
          onClick={() => setSpotlightOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl border border-white/15 border-t-white/30 bg-slate-950/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5">
              <Sparkles className="h-4 w-4 shrink-0 text-sky-400" />
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type any text, code, emoji, or multilingual phrase..."
                className="w-full bg-transparent text-sm text-white placeholder-slate-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setSpotlightOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Close Spotlight"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {INPUT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setInputText(preset.text)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      inputText === preset.text
                        ? 'bg-sky-400/20 text-sky-200 ring-1 ring-sky-400/40'
                        : 'bg-white/6 text-slate-300 hover:bg-white/12 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUseRegex(!useRegex)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    useRegex
                      ? 'bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-400/40'
                      : 'bg-white/6 text-slate-400 hover:text-white'
                  }`}
                >
                  Regex {useRegex ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setLabMode(labMode === 'auto' ? 'manual' : 'auto')}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    labMode === 'manual'
                      ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/40'
                      : 'bg-white/6 text-slate-300 hover:text-white'
                  }`}
                >
                  {labMode === 'manual' ? 'Manual Merge' : 'Auto BPE'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
