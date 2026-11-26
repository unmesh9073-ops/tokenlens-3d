import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { BarChart3, CheckCircle2, Cpu, GitFork, HelpCircle, Layers, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CanvasErrorBoundary } from './components/CanvasErrorBoundary'
import { CompareSheet } from './components/CompareSheet'
import { CopilotPanel } from './components/CopilotPanel'
import { GuidedStoryOverlay } from './components/guided/GuidedStoryOverlay'
import { TrainModal } from './components/TrainModal'
import { PipelineHUD } from './components/pipeline/PipelineHUD'
import { PipelineScene3D } from './components/pipeline/PipelineScene3D'
import { MergeTreeHUD } from './components/tree/MergeTreeHUD'
import { MergeTreeScene3D } from './components/tree/MergeTreeScene3D'
import {
  useStudioStore,
  type DiagramView,
  type HealthStatus,
  type StudioMode,
} from './store/useStudioStore'

const MODE_OPTIONS: Array<{ id: StudioMode; label: string }> = [
  { id: 'playground', label: 'Playground' },
  { id: 'guided', label: 'Guided Story' },
]

const DIAGRAM_OPTIONS: Array<{ id: DiagramView; label: string; icon: typeof Layers }> = [
  { id: 'pipeline', label: '3D Pipeline', icon: Layers },
  { id: 'tree', label: '3D Merge Tree', icon: GitFork },
]

const INPUT_PRESETS: Array<{ label: string; text: string }> = [
  { label: 'English', text: 'Tokenization makes AI read!' },
  { label: 'Emojis', text: 'AI loves rockets 🚀✨' },
  { label: 'Python', text: 'def tokenize(x): return x + 1' },
  { label: 'Hindi', text: 'नमस्ते AI दुनिया' },
  { label: 'Regex Trap', text: 'dog. dog! dog? <|endoftext|>' },
]

export function App() {
  const mode = useStudioStore((s) => s.mode)
  const activeDiagram = useStudioStore((s) => s.activeDiagram)
  const isCopilotOpen = useStudioStore((s) => s.isCopilotOpen)
  const inputText = useStudioStore((s) => s.inputText)
  const useRegex = useStudioStore((s) => s.useRegex)
  const labMode = useStudioStore((s) => s.labMode)
  const activeTokenizerId = useStudioStore((s) => s.activeTokenizerId)
  const customTokenizers = useStudioStore((s) => s.customTokenizers)
  const analysis = useStudioStore((s) => s.analysis)
  const embeddings = useStudioStore((s) => s.embeddings)

  const setMode = useStudioStore((s) => s.setMode)
  const setActiveDiagram = useStudioStore((s) => s.setActiveDiagram)
  const setCopilotOpen = useStudioStore((s) => s.setCopilotOpen)
  const toggleCopilot = useStudioStore((s) => s.toggleCopilot)
  const setInputText = useStudioStore((s) => s.setInputText)
  const setUseRegex = useStudioStore((s) => s.setUseRegex)
  const setLabMode = useStudioStore((s) => s.setLabMode)
  const setTrainModalOpen = useStudioStore((s) => s.setTrainModalOpen)
  const runComparison = useStudioStore((s) => s.runComparison)
  const fetchAnalysisAndEmbeddings = useStudioStore((s) => s.fetchAnalysisAndEmbeddings)
  const lastCopilotActionBanner = useStudioStore((s) => s.lastCopilotActionBanner)
  const dismissCopilotBanner = useStudioStore((s) => s.dismissCopilotBanner)

  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [healthState, setHealthState] = useState<'loading' | 'online' | 'offline'>('loading')
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<HealthStatus>
      })
      .then((data) => {
        if (!active) return
        setHealth(data)
        setHealthState('online')
      })
      .catch(() => {
        if (!active) return
        setHealthState('offline')
      })
    return () => {
      active = false
    }
  }, [])

  // Debounced analysis on text typing (~220ms)
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

  // Immediate re-analysis when regex toggle or active tokenizer changes
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

  // Global keyboard shortcuts (ignored while typing in inputs/textareas)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return
      }

      const state = useStudioStore.getState()

      if (e.key === 'Escape') {
        if (state.isCompareOpen) {
          state.setCompareOpen(false)
        } else if (state.isTrainModalOpen) {
          state.setTrainModalOpen(false)
        } else if (isShortcutsOpen) {
          setIsShortcutsOpen(false)
        } else {
          state.clearSelection()
        }
        return
      }

      if (e.shiftKey && state.mode === 'guided') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          state.prevGuidedChapter()
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          state.nextGuidedChapter()
          return
        }
      }

      if (state.activeDiagram === 'tree' && state.labMode === 'auto') {
        if (e.code === 'Space') {
          e.preventDefault()
          state.togglePlayTimeline()
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          state.stepTimelineBackward()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          state.stepTimelineForward()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isShortcutsOpen])

  const activeTokenizerName =
    customTokenizers.find((t) => t.id === activeTokenizerId)?.name ?? 'Default Starter'

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative h-screen w-screen overflow-hidden bg-[#06070B] text-white">
        {/* Subtle Radial Ambient Lighting */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(129,140,248,0.09),transparent_55%)]"
        />

        {/* Full-Viewport 3D Stage */}
        <main className="absolute inset-0">
          <CanvasErrorBoundary>
            {activeDiagram === 'pipeline' ? <PipelineScene3D /> : <MergeTreeScene3D />}
          </CanvasErrorBoundary>
        </main>

        {/* Floating Glass Top Pill Bar */}
        <header className="pointer-events-none fixed inset-x-0 top-4 z-20 flex justify-center px-4">
          <div className="glass-surface pointer-events-auto flex flex-wrap items-center justify-between gap-2.5 rounded-full px-3 py-1.5 sm:gap-3.5 sm:px-4">
            <div className="flex items-center gap-2 pr-1">
              <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-400 shadow-[0_0_12px_rgba(56,189,248,0.75)]" />
              <span className="text-[14px] font-semibold tracking-tight text-white">
                TokenLens 3D
              </span>
            </div>

            <nav
              aria-label="Studio Mode"
              className="flex items-center rounded-full bg-white/[0.05] p-0.5 ring-1 ring-white/[0.08]"
            >
              {MODE_OPTIONS.map((item) => {
                const active = mode === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className={`pressable relative rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                      active ? 'text-white' : 'text-white/60 hover:text-white/85'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="mode-pill"
                        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                        className="absolute inset-0 rounded-full bg-white/[0.14] ring-1 ring-white/[0.18]"
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </button>
                )
              })}
            </nav>

            <nav
              aria-label="3D Visualization"
              className="flex items-center rounded-full bg-white/[0.05] p-0.5 ring-1 ring-white/[0.08]"
            >
              {DIAGRAM_OPTIONS.map((item) => {
                const Icon = item.icon
                const active = activeDiagram === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveDiagram(item.id)}
                    className={`pressable relative flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                      active ? 'text-white' : 'text-white/60 hover:text-white/85'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="diagram-pill"
                        transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                        className="absolute inset-0 rounded-full bg-sky-400/20 ring-1 ring-sky-400/35"
                      />
                    )}
                    <Icon className="relative z-10 h-3.5 w-3.5" />
                    <span className="relative z-10">{item.label}</span>
                  </button>
                )
              })}
            </nav>

            <div
              title={
                healthState === 'online'
                  ? `Backend online (${health?.chat_model ?? 'ready'})`
                  : 'Backend offline — start uvicorn on port 8010'
              }
              className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/75 ring-1 ring-white/[0.08]"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  healthState === 'online'
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : healthState === 'loading'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                }`}
              />
              <span className="font-mono-tech">
                {healthState === 'online'
                  ? 'API Ready'
                  : healthState === 'loading'
                    ? 'Checking'
                    : 'API Offline'}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleCopilot}
              aria-pressed={isCopilotOpen}
              className={`pressable flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ring-1 ${
                isCopilotOpen
                  ? 'bg-sky-400/20 text-sky-200 ring-sky-400/40'
                  : 'bg-white/[0.06] text-white/80 ring-white/[0.12] hover:bg-white/[0.12]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Ask Gemini</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsShortcutsOpen((v) => !v)}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts"
                className="pressable flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-white/70 ring-1 ring-white/[0.12] hover:bg-white/[0.12] hover:text-white"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>

              <AnimatePresence>
                {isShortcutsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.22 }}
                    className="glass-panel-heavy absolute right-0 top-9 z-40 w-64 rounded-2xl p-3 text-[11px] text-white/80"
                  >
                    <div className="mb-2 font-semibold text-white">Keyboard Shortcuts</div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span>Play / Pause Tree</span>
                        <kbd className="font-mono-tech rounded bg-white/[0.1] px-1.5 py-0.5 text-[10px]">Space</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span>Step Merge Timeline</span>
                        <kbd className="font-mono-tech rounded bg-white/[0.1] px-1.5 py-0.5 text-[10px]">← / →</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span>Switch Story Chapter</span>
                        <kbd className="font-mono-tech rounded bg-white/[0.1] px-1.5 py-0.5 text-[10px]">Shift + ← / →</kbd>
                      </div>
                      <div className="flex justify-between">
                        <span>Close / Clear Selection</span>
                        <kbd className="font-mono-tech rounded bg-white/[0.1] px-1.5 py-0.5 text-[10px]">Esc</kbd>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Pipeline, Tree & Guided Story Floating HUDs */}
        <PipelineHUD />
        <MergeTreeHUD />
        <GuidedStoryOverlay />

        {/* Right Docked Ask Gemini Side Panel */}
        <div className="pointer-events-none fixed right-4 top-20 z-20">
          <CopilotPanel
            isOpen={isCopilotOpen}
            onClose={() => setCopilotOpen(false)}
            health={health}
          />
        </div>

        {/* Transient Co-Pilot Action Toast */}
        <AnimatePresence>
          {lastCopilotActionBanner && (
            <motion.div
              key="copilot-banner"
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
              className="pointer-events-none fixed inset-x-0 top-[7.5rem] z-30 flex justify-center px-4"
            >
              <div className="glass-surface pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-medium text-sky-200 ring-1 ring-sky-400/35">
                <Sparkles className="h-3 w-3 text-sky-300" />
                <span>{lastCopilotActionBanner}</span>
                <button
                  type="button"
                  onClick={dismissCopilotBanner}
                  aria-label="Dismiss notification"
                  className="text-white/50 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Floating Input & Controls Dock */}
        <footer className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <div className="glass-surface pointer-events-auto flex w-full max-w-4xl flex-col gap-2 rounded-3xl px-4 py-2.5">
            {/* Row 1: Presets & Lab Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {INPUT_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setInputText(preset.text)}
                    className={`pressable rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${
                      inputText === preset.text
                        ? 'bg-sky-400/20 text-sky-200 ring-sky-400/40'
                        : 'bg-white/[0.05] text-white/70 ring-white/[0.1] hover:bg-white/[0.1] hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* Regex Split Toggle */}
                <button
                  type="button"
                  onClick={() => setUseRegex(!useRegex)}
                  className={`pressable rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${
                    useRegex
                      ? 'bg-sky-400/20 text-sky-200 ring-sky-400/35'
                      : 'bg-white/[0.05] text-white/65 ring-white/[0.1]'
                  }`}
                >
                  Regex Split: {useRegex ? 'ON' : 'OFF'}
                </button>

                {/* Lab Mode Segmented Toggle */}
                <div className="flex items-center rounded-full bg-white/[0.05] p-0.5 ring-1 ring-white/[0.08]">
                  {(['auto', 'manual'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setLabMode(m)}
                      className={`pressable rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        labMode === m
                          ? 'bg-white/[0.16] text-white'
                          : 'text-white/60 hover:text-white/85'
                      }`}
                    >
                      {m === 'auto' ? 'Auto BPE' : 'Manual Merge'}
                    </button>
                  ))}
                </div>

                {/* Compare LLMs Button */}
                <button
                  type="button"
                  onClick={() => void runComparison()}
                  className="pressable flex items-center gap-1 rounded-full bg-indigo-400/15 px-2.5 py-0.5 text-[11px] font-medium text-indigo-200 ring-1 ring-indigo-400/35 hover:bg-indigo-400/25"
                >
                  <BarChart3 className="h-3 w-3" />
                  Compare LLMs
                </button>

                {/* Train Custom Button */}
                <button
                  type="button"
                  onClick={() => setTrainModalOpen(true)}
                  className="pressable flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-200 ring-1 ring-emerald-400/35 hover:bg-emerald-400/25"
                >
                  <Cpu className="h-3 w-3" />
                  {activeTokenizerName}
                </button>
              </div>
            </div>

            {/* Row 2: Text Input */}
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 focus-within:border-sky-400/50">
              <span className="font-mono-tech shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-white/[0.1]">
                INPUT
              </span>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                aria-label="Tokenizer input text"
                placeholder="Type text to tokenize in 3D..."
                className="w-full bg-transparent text-[14px] tracking-tight text-white placeholder:text-white/40 focus:outline-none"
              />
              <span className="font-mono-tech shrink-0 text-[11px] text-white/50">
                {inputText.length} chars
              </span>
            </div>

            {/* Row 3: Live Metrics Strip */}
            <div className="font-mono-tech flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/65">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Bytes: <strong className="text-white">{analysis?.metrics.byte_count ?? 0}</strong>
                </span>
                <span>
                  Tokens: <strong className="text-white">{analysis?.metrics.token_count ?? 0}</strong>
                </span>
                <span>
                  Compression:{' '}
                  <strong className="text-sky-300">
                    {analysis ? `${analysis.metrics.compression_ratio.toFixed(2)}×` : '—'}
                  </strong>
                </span>
                <span>
                  Fertility:{' '}
                  <strong className="text-indigo-300">
                    {analysis ? analysis.metrics.fertility.toFixed(2) : '—'}
                  </strong>
                </span>
                {analysis?.is_lossless && (
                  <span className="flex items-center gap-1 text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    Lossless
                  </span>
                )}
              </div>

              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/75 ring-1 ring-white/[0.1]">
                {embeddings?.source === 'gemini_live' ? 'Gemini Live' : 'Local Vectors'}
              </span>
            </div>
          </div>
        </footer>

        {/* Drawers / Modals */}
        <CompareSheet />
        <TrainModal />
      </div>
    </MotionConfig>
  )
}

export default App
