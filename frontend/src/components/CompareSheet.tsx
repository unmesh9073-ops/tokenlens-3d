import { AnimatePresence, motion } from 'framer-motion'
import { BarChart3, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { useStudioStore } from '../store/useStudioStore'
import type { CompareTokenItem } from '../types/tokenizer'

const PILL_PALETTE = [
  'bg-sky-400/15 border-sky-400/30 text-sky-100',
  'bg-indigo-400/15 border-indigo-400/30 text-indigo-100',
  'bg-emerald-400/15 border-emerald-400/30 text-emerald-100',
  'bg-amber-400/15 border-amber-400/30 text-amber-100',
  'bg-rose-400/15 border-rose-400/30 text-rose-100',
  'bg-violet-400/15 border-violet-400/30 text-violet-100',
]

export function CompareSheet() {
  const isOpen = useStudioStore((s) => s.isCompareOpen)
  const setOpen = useStudioStore((s) => s.setCompareOpen)
  const comparison = useStudioStore((s) => s.comparison)
  const isLoading = useStudioStore((s) => s.isCompareLoading)
  const [hoveredToken, setHoveredToken] = useState<{
    modelName: string
    token: CompareTokenItem
  } | null>(null)

  const maxTokens = Math.max(
    1,
    ...(comparison?.models.map((m) => m.token_count) ?? [1]),
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="compare-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 flex justify-end bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.section
            key="compare-sheet"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Real LLM Tokenizer Comparison"
            className="glass-panel-heavy flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.1] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-400/15 text-indigo-300 ring-1 ring-indigo-400/30">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-white">
                    Real LLM Tokenizer Comparison
                  </h2>
                  <p className="text-[12px] text-white/55">
                    Compare token counts, fertility, and subword splits side-by-side
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close comparison drawer"
                className="pressable flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {isLoading ? (
                <div className="flex h-48 items-center justify-center gap-2 text-sm text-white/70">
                  <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                  Comparing tokenizers...
                </div>
              ) : !comparison ? (
                <div className="text-sm text-white/60">No comparison data yet.</div>
              ) : (
                <>
                  {/* Hovered Token Detail Banner */}
                  <div className="flex min-h-[38px] items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[12px]">
                    {hoveredToken ? (
                      <>
                        <span className="text-white/70">
                          {hoveredToken.modelName}:{' '}
                          <strong className="text-white">{hoveredToken.token.text}</strong>
                        </span>
                        <span className="font-mono-tech text-sky-300">
                          ID #{hoveredToken.token.token_id} · {hoveredToken.token.bytes_hex}
                        </span>
                      </>
                    ) : (
                      <span className="text-white/50">
                        Hover any token pill below to inspect its integer ID and UTF-8 bytes
                      </span>
                    )}
                  </div>

                  {comparison.models.map((model) => {
                    const widthPct = Math.max(8, (model.token_count / maxTokens) * 100)
                    return (
                      <div
                        key={model.model_id}
                        className="rounded-2xl border border-white/[0.1] bg-white/[0.04] p-4"
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-semibold text-white">
                              {model.display_name}
                            </span>
                            {model.is_fallback && (
                              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200 ring-1 ring-amber-400/30">
                                Offline Local
                              </span>
                            )}
                          </div>
                          <div className="font-mono-tech flex items-center gap-3 text-[11px] text-white/70">
                            <span>
                              <strong className="text-white">{model.token_count}</strong> tokens
                            </span>
                            <span>fertility {model.fertility.toFixed(2)}</span>
                            <span>{model.compression_ratio.toFixed(2)} B/tok</span>
                          </div>
                        </div>

                        {/* Bar */}
                        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>

                        {/* Token Pills */}
                        <div className="flex flex-wrap gap-1.5">
                          {model.tokens.map((tok, idx) => (
                            <span
                              key={`${model.model_id}-${idx}`}
                              onMouseEnter={() =>
                                setHoveredToken({ modelName: model.display_name, token: tok })
                              }
                              className={`font-mono-tech cursor-default rounded-lg border px-2 py-0.5 text-[12px] transition-transform hover:scale-105 ${
                                PILL_PALETTE[idx % PILL_PALETTE.length]
                              }`}
                            >
                              {tok.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
