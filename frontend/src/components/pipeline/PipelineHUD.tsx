import { AnimatePresence, motion } from 'framer-motion'
import { Combine, Eye, RotateCcw, X } from 'lucide-react'
import { useStudioStore, type CameraPreset } from '../../store/useStudioStore'
import { MAX_RENDERED_BYTES, MAX_RENDERED_TOKENS } from './PipelineScene3D'

const CAMERA_PRESETS: Array<{ id: CameraPreset; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'bytes', label: 'Bytes' },
  { id: 'subwords', label: 'Subwords' },
  { id: 'ids', label: 'IDs' },
  { id: 'vectors', label: '3D Vectors' },
]

export function PipelineHUD() {
  const activeDiagram = useStudioStore((s) => s.activeDiagram)
  const cameraPreset = useStudioStore((s) => s.cameraPreset)
  const setCameraPreset = useStudioStore((s) => s.setCameraPreset)
  const analysis = useStudioStore((s) => s.analysis)
  const inspectorInfo = useStudioStore((s) => s.inspectorInfo)
  const clearSelection = useStudioStore((s) => s.clearSelection)
  const labMode = useStudioStore((s) => s.labMode)
  const manualPairFrequencies = useStudioStore((s) => s.manualPairFrequencies)
  const manualNodes = useStudioStore((s) => s.manualNodes)
  const performManualMerge = useStudioStore((s) => s.performManualMerge)
  const resetManualLab = useStudioStore((s) => s.resetManualLab)

  if (activeDiagram !== 'pipeline') return null

  const isTruncated =
    (analysis?.raw_bytes.length ?? 0) > MAX_RENDERED_BYTES ||
    (analysis?.final_tokens.length ?? 0) > MAX_RENDERED_TOKENS

  return (
    <>
      {/* Camera Preset Pills (Top Center-Left below header) */}
      <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-10 flex flex-wrap items-center justify-center gap-2 px-4">
        <div className="glass-surface pointer-events-auto flex items-center gap-1 rounded-full p-1">
          <Eye className="ml-2 mr-1 h-3.5 w-3.5 text-white/50" />
          {CAMERA_PRESETS.map((preset) => {
            const active = cameraPreset === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setCameraPreset(preset.id)}
                className={`pressable relative rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active ? 'text-white' : 'text-white/60 hover:text-white/90'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="camera-preset-pill"
                    transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                    className="absolute inset-0 rounded-full bg-white/[0.14] ring-1 ring-white/[0.2]"
                  />
                )}
                <span className="relative z-10">{preset.label}</span>
              </button>
            )
          })}
        </div>

        {isTruncated && (
          <div className="glass-surface pointer-events-auto rounded-full px-3 py-1 text-[11px] font-medium text-amber-200 ring-1 ring-amber-400/30">
            Showing first {MAX_RENDERED_BYTES} bytes in 3D
          </div>
        )}
      </div>

      {/* Top-Left Floating Inspector & Manual Merge HUD */}
      <div className="pointer-events-none fixed left-4 top-20 z-10 flex w-[300px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        <AnimatePresence>
          {inspectorInfo && (
            <motion.div
              key="inspector-card"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="glass-panel-heavy pointer-events-auto rounded-2xl p-3.5"
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                    {inspectorInfo.kindLabel}
                  </span>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-[16px] font-semibold tracking-tight text-white">
                      {inspectorInfo.text || '␣'}
                    </span>
                    {inspectorInfo.tokenId !== undefined && (
                      <span className="font-mono-tech rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[11px] text-emerald-300">
                        #{inspectorInfo.tokenId}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  aria-label="Clear selection"
                  className="pressable rounded-full p-1 text-white/50 hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="font-mono-tech mb-2 flex flex-wrap gap-1.5 text-[11px] text-white/70">
                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5">
                  {inspectorInfo.bytesHex}
                </span>
                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5">
                  bytes [{inspectorInfo.byteSpan[0]}..{inspectorInfo.byteSpan[1]})
                </span>
              </div>

              <p className="text-[12px] leading-relaxed text-white/75">
                {inspectorInfo.explanation}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {labMode === 'manual' && (
            <motion.div
              key="manual-pair-card"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="glass-panel-heavy pointer-events-auto rounded-2xl p-3.5"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Combine className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="text-[12px] font-semibold text-white">
                    Live Adjacent Pairs
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void resetManualLab()}
                  className="pressable flex items-center gap-1 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/80 hover:bg-white/[0.14]"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              </div>

              <p className="mb-2.5 text-[11px] text-white/60">
                Active blocks: <span className="font-mono-tech text-white">{manualNodes.length}</span>.
                Click two adjacent 3D blocks or merge a top pair below:
              </p>

              {manualPairFrequencies.length === 0 ? (
                <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-[11px] text-white/55">
                  No mergeable adjacent pairs remain in current chunk boundaries.
                </div>
              ) : (
                <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto pr-1">
                  {manualPairFrequencies.slice(0, 6).map((item) => (
                    <button
                      key={`${item.pair[0]}-${item.pair[1]}`}
                      type="button"
                      onClick={() => void performManualMerge(item.pair[0], item.pair[1])}
                      className="pressable flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-left text-[12px] hover:border-emerald-400/40 hover:bg-emerald-400/10"
                    >
                      <span className="font-mono-tech text-white/90">
                        &ldquo;{item.left_text}&rdquo; + &ldquo;{item.right_text}&rdquo;
                      </span>
                      <span className="font-mono-tech rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] text-emerald-300">
                        ×{item.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
