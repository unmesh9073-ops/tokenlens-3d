import { motion } from 'framer-motion'
import { Command, Cpu, LayoutGrid, SlidersHorizontal, Sparkles } from 'lucide-react'
import { useStudioStore } from '../../store/useStudioStore'

export function OrnamentDock() {
  const activeSpace = useStudioStore((s) => s.activeSpace)
  const isSpotlightOpen = useStudioStore((s) => s.isSpotlightOpen)
  const isControlsOpen = useStudioStore((s) => s.isControlsOpen)
  const isCopilotOpen = useStudioStore((s) => s.isCopilotOpen)
  const isCopilotThinking = useStudioStore((s) => s.isCopilotThinking)

  const setActiveSpace = useStudioStore((s) => s.setActiveSpace)
  const toggleSpotlight = useStudioStore((s) => s.toggleSpotlight)
  const toggleControls = useStudioStore((s) => s.toggleControls)
  const setTrainModalOpen = useStudioStore((s) => s.setTrainModalOpen)
  const toggleCopilot = useStudioStore((s) => s.toggleCopilot)

  const hasContextControls = activeSpace === 'tree' || activeSpace === 'pipeline'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <motion.nav
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.45 }}
        aria-label="Spatial Ornament Dock"
        className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/12 border-t-white/25 bg-slate-950/70 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => setActiveSpace('hub')}
          className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
            activeSpace === 'hub'
              ? 'bg-white/15 text-white'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span>Spaces</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={toggleSpotlight}
          className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
            isSpotlightOpen
              ? 'bg-sky-400/20 text-sky-200 ring-1 ring-sky-400/35'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          <Command className="h-3.5 w-3.5" />
          <span>Text</span>
          <kbd className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">
            ⌘K
          </kbd>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          disabled={!hasContextControls}
          onClick={toggleControls}
          className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
            !hasContextControls
              ? 'cursor-not-allowed text-slate-600'
              : isControlsOpen
                ? 'bg-violet-400/20 text-violet-200 ring-1 ring-violet-400/35'
                : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Controls</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => setTrainModalOpen(true)}
          className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/8 hover:text-white"
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>Train</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={toggleCopilot}
          className={`relative flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
            isCopilotOpen
              ? 'bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-400/35'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'
          }`}
        >
          <Sparkles className={`h-3.5 w-3.5 ${isCopilotThinking ? 'animate-pulse text-emerald-300' : ''}`} />
          <span>Ask Gemini</span>
          {isCopilotThinking && !isCopilotOpen && (
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
          )}
        </motion.button>
      </motion.nav>
    </div>
  )
}
