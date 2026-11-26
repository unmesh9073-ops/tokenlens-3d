import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { ArrowLeft, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { useEffect } from 'react'
import { CompareSheet } from './components/CompareSheet'
import { CopilotPanel } from './components/CopilotPanel'
import { GuidedStoryOverlay } from './components/guided/GuidedStoryOverlay'
import { TrainModal } from './components/TrainModal'
import { OrnamentDock } from './components/spatial/OrnamentDock'
import { SpatialWorld3D } from './components/spatial/SpatialWorld3D'
import { SpotlightInput } from './components/spatial/SpotlightInput'
import { useStudioStore, type SpatialVolume } from './store/useStudioStore'

const VOLUME_TITLES: Record<SpatialVolume, { num: string; title: string }> = {
  pipeline: { num: '01', title: 'Assembly Pipeline' },
  tree: { num: '02', title: 'Merge Forest' },
  vectors: { num: '03', title: 'Vector Galaxy' },
  arena: { num: '04', title: 'Model Arena' },
}

export function App() {
  const activeSpace = useStudioStore((s) => s.activeSpace)
  const setActiveSpace = useStudioStore((s) => s.setActiveSpace)
  const setSpotlightOpen = useStudioStore((s) => s.setSpotlightOpen)
  const isControlsOpen = useStudioStore((s) => s.isControlsOpen)

  const inputText = useStudioStore((s) => s.inputText)
  const useRegex = useStudioStore((s) => s.useRegex)
  const activeTokenizerId = useStudioStore((s) => s.activeTokenizerId)
  const analysis = useStudioStore((s) => s.analysis)
  const labMode = useStudioStore((s) => s.labMode)
  const setLabMode = useStudioStore((s) => s.setLabMode)
  const resetManualLab = useStudioStore((s) => s.resetManualLab)

  const timelineStep = useStudioStore((s) => s.timelineStep)
  const setTimelineStep = useStudioStore((s) => s.setTimelineStep)
  const isPlayingTimeline = useStudioStore((s) => s.isPlayingTimeline)
  const setPlayingTimeline = useStudioStore((s) => s.setPlayingTimeline)

  const fetchAnalysisAndEmbeddings = useStudioStore((s) => s.fetchAnalysisAndEmbeddings)
  const lastCopilotActionBanner = useStudioStore((s) => s.lastCopilotActionBanner)
  const dismissCopilotBanner = useStudioStore((s) => s.dismissCopilotBanner)

  // Debounced analysis on text typing
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetchAnalysisAndEmbeddings(controller.signal)
    }, 220)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [inputText, fetchAnalysisAndEmbeddings])

  // Immediate re-analysis when regex or tokenizer changes
  useEffect(() => {
    const controller = new AbortController()
    void fetchAnalysisAndEmbeddings(controller.signal)
    return () => controller.abort()
  }, [useRegex, activeTokenizerId, fetchAnalysisAndEmbeddings])

  // Auto-dismiss transient Co-Pilot action toast
  useEffect(() => {
    if (!lastCopilotActionBanner) return
    const timer = window.setTimeout(() => dismissCopilotBanner(), 4500)
    return () => window.clearTimeout(timer)
  }, [lastCopilotActionBanner, dismissCopilotBanner])

  // Timeline playback loop for Merge Forest
  const totalMergeSteps = analysis?.merge_steps.length ?? 0
  useEffect(() => {
    if (!isPlayingTimeline) return
    const timer = window.setInterval(() => {
      const current = useStudioStore.getState().timelineStep
      if (current >= totalMergeSteps) {
        setPlayingTimeline(false)
      } else {
        setTimelineStep(current + 1)
      }
    }, 650)
    return () => window.clearInterval(timer)
  }, [isPlayingTimeline, totalMergeSteps, setTimelineStep, setPlayingTimeline])

  const isCopilotOpen = useStudioStore((s) => s.isCopilotOpen)
  const setCopilotOpen = useStudioStore((s) => s.setCopilotOpen)
  const isSoundEnabled = useStudioStore((s) => s.isSoundEnabled)
  const toggleSound = useStudioStore((s) => s.toggleSound)
  const tokenCount = analysis?.final_tokens.length ?? 0
  const fertility = analysis?.metrics.fertility ?? 1
  const truncatedPreview =
    inputText.length > 28 ? `${inputText.slice(0, 28)}…` : inputText

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative h-screen w-screen overflow-hidden bg-[#05060A] text-slate-100 select-none">
        {/* Full-Viewport Unified 3D Spatial World */}
        <SpatialWorld3D />

        {/* Subtle Top-Right Spatial Audio Toggle */}
        <button
          type="button"
          onClick={toggleSound}
          aria-label={isSoundEnabled ? 'Mute spatial audio' : 'Unmute spatial audio'}
          title={isSoundEnabled ? 'Mute spatial audio' : 'Unmute spatial audio'}
          className="fixed top-6 right-6 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-slate-950/60 text-slate-300 backdrop-blur-xl transition-colors hover:border-white/25 hover:text-white"
        >
          {isSoundEnabled ? (
            <Volume2 className="h-3.5 w-3.5" />
          ) : (
            <VolumeX className="h-3.5 w-3.5 text-slate-500" />
          )}
        </button>

        {/* Minimal Top-Left Spatial Header */}
        <header className="pointer-events-none fixed top-6 left-6 z-30 flex items-center gap-3">
          {activeSpace === 'hub' ? (
            <>
              <span className="text-sm font-semibold tracking-tight text-white/95">
                TokenLens
              </span>
              <button
                type="button"
                onClick={() => setSpotlightOpen(true)}
                className="pointer-events-auto rounded-full border border-white/12 bg-slate-950/60 px-3.5 py-1.5 text-xs text-slate-300 backdrop-blur-xl transition-colors hover:border-white/25 hover:text-white"
              >
                “{truncatedPreview}” · {tokenCount} tokens
              </button>
            </>
          ) : (
            <>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => setActiveSpace('hub')}
                className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/70 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur-xl transition-colors hover:bg-white/10"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Spaces</span>
              </motion.button>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/55 px-3.5 py-1.5 text-xs backdrop-blur-xl">
                <span className="font-mono text-sky-400">
                  {VOLUME_TITLES[activeSpace].num}
                </span>
                <span className="font-medium text-white/95">
                  {VOLUME_TITLES[activeSpace].title}
                </span>
              </div>
              <div className="hidden rounded-full border border-white/10 bg-slate-950/55 px-3 py-1.5 text-xs font-mono text-slate-300 backdrop-blur-xl sm:block">
                {tokenCount} tokens · {fertility.toFixed(2)}×
              </div>
            </>
          )}
        </header>

        {/* Context-Only Floating Controls Tray */}
        <AnimatePresence>
          {isControlsOpen && (activeSpace === 'tree' || activeSpace === 'pipeline') && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
              className="fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/15 bg-slate-950/80 px-4 py-2 shadow-2xl backdrop-blur-2xl"
            >
              {activeSpace === 'tree' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPlayingTimeline && timelineStep >= totalMergeSteps) {
                        setTimelineStep(0)
                      }
                      setPlayingTimeline(!isPlayingTimeline)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                    aria-label={isPlayingTimeline ? 'Pause' : 'Play'}
                  >
                    {isPlayingTimeline ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, totalMergeSteps)}
                    value={timelineStep}
                    onChange={(e) => setTimelineStep(Number(e.target.value))}
                    className="w-40 accent-violet-400"
                  />
                  <span className="font-mono text-xs text-slate-300">
                    {timelineStep}/{totalMergeSteps}
                  </span>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setLabMode(labMode === 'auto' ? 'manual' : 'auto')}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20"
                  >
                    {labMode === 'manual' ? 'Manual Lab' : 'Auto BPE'}
                  </button>
                  {labMode === 'manual' && (
                    <button
                      type="button"
                      onClick={() => resetManualLab()}
                      className="flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-400/30"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transient Co-Pilot Action Banner */}
        <AnimatePresence>
          {lastCopilotActionBanner && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="fixed top-6 right-6 z-40 rounded-full border border-emerald-400/30 bg-slate-950/85 px-4 py-1.5 text-xs text-emerald-200 shadow-lg backdrop-blur-xl"
            >
              {lastCopilotActionBanner}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Single Centered Bottom visionOS Ornament Dock */}
        <OrnamentDock />
        <GuidedStoryOverlay />

        {/* On-Demand Spotlight Input Orb */}
        <SpotlightInput />

        {/* Floating visionOS Ask Gemini Window */}
        <CopilotPanel
          isOpen={isCopilotOpen}
          onClose={() => setCopilotOpen(false)}
          health={null}
        />

        {/* Floating Sheets */}
        <TrainModal />
        <CompareSheet />
      </div>
    </MotionConfig>
  )
}
export default App
