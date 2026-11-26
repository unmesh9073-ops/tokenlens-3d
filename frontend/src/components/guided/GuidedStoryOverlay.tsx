import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  Orbit,
  Play,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStudioStore } from '../../store/useStudioStore'
import { GUIDED_CHAPTERS } from './chapters'

export function GuidedStoryOverlay() {
  const mode = useStudioStore((s) => s.mode)
  const guidedChapterIndex = useStudioStore((s) => s.guidedChapterIndex)
  const completedChapters = useStudioStore((s) => s.completedChapters)

  const selectedByteSpan = useStudioStore((s) => s.selectedByteSpan)
  const timelineStep = useStudioStore((s) => s.timelineStep)
  const manualTree = useStudioStore((s) => s.manualTree)
  const isCompareOpen = useStudioStore((s) => s.isCompareOpen)
  const useRegex = useStudioStore((s) => s.useRegex)
  const vectorCompareIndices = useStudioStore((s) => s.vectorCompareIndices)

  const setMode = useStudioStore((s) => s.setMode)
  const setGuidedChapter = useStudioStore((s) => s.setGuidedChapter)
  const nextGuidedChapter = useStudioStore((s) => s.nextGuidedChapter)
  const prevGuidedChapter = useStudioStore((s) => s.prevGuidedChapter)
  const markChapterComplete = useStudioStore((s) => s.markChapterComplete)
  const togglePlayTimeline = useStudioStore((s) => s.togglePlayTimeline)
  const runComparison = useStudioStore((s) => s.runComparison)
  const setUseRegex = useStudioStore((s) => s.setUseRegex)
  const setCameraPreset = useStudioStore((s) => s.setCameraPreset)
  const setCopilotOpen = useStudioStore((s) => s.setCopilotOpen)
  const sendCopilotPrompt = useStudioStore((s) => s.sendCopilotPrompt)

  const [isMinimized, setIsMinimized] = useState(false)

  const chapter = GUIDED_CHAPTERS[guidedChapterIndex] ?? GUIDED_CHAPTERS[0]
  const isComplete = completedChapters.includes(chapter.id)

  // Auto-detect micro-task completion for the active chapter
  useEffect(() => {
    if (mode !== 'guided') return
    if (chapter.id === 'why-tokens' && selectedByteSpan !== null) {
      markChapterComplete('why-tokens')
    } else if (chapter.id === 'how-bpe-merges' && (timelineStep > 0 || selectedByteSpan !== null)) {
      markChapterComplete('how-bpe-merges')
    } else if (
      chapter.id === 'manual-lab' &&
      manualTree?.nodes.some((n) => n.token_id >= 256)
    ) {
      markChapterComplete('manual-lab')
    } else if (chapter.id === 'multilingual-tax' && isCompareOpen) {
      markChapterComplete('multilingual-tax')
    } else if (
      chapter.id === 'regex-and-vectors' &&
      (!useRegex || vectorCompareIndices.length === 2)
    ) {
      markChapterComplete('regex-and-vectors')
    }
  }, [
    mode,
    chapter.id,
    selectedByteSpan,
    timelineStep,
    manualTree,
    isCompareOpen,
    useRegex,
    vectorCompareIndices,
    markChapterComplete,
  ])

  if (mode !== 'guided') return null

  return (
    <div className="pointer-events-none fixed bottom-[9.25rem] left-4 z-20 max-w-[calc(100vw-2rem)]">
      <AnimatePresence mode="wait">
        {isMinimized ? (
          <motion.button
            key="guided-pill"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
            type="button"
            onClick={() => setIsMinimized(false)}
            className="glass-surface pressable pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-medium text-white"
          >
            <BookOpen className="h-3.5 w-3.5 text-sky-300" />
            <span>
              Chapter {chapter.number}/{GUIDED_CHAPTERS.length}: {chapter.title}
            </span>
          </motion.button>
        ) : (
          <motion.section
            key={`guided-card-${chapter.id}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
            aria-label="Guided Visual Story"
            className="glass-panel-heavy pointer-events-auto w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl p-4"
          >
            {/* Header & Chapter Progress Pills */}
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {GUIDED_CHAPTERS.map((ch, idx) => {
                  const active = idx === guidedChapterIndex
                  const done = completedChapters.includes(ch.id)
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setGuidedChapter(idx)}
                      title={`Chapter ${ch.number}: ${ch.title}`}
                      className={`pressable font-mono-tech flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold ring-1 ${
                        active
                          ? 'bg-sky-400/25 text-sky-100 ring-sky-400/50'
                          : done
                            ? 'bg-emerald-400/15 text-emerald-200 ring-emerald-400/35'
                            : 'bg-white/[0.05] text-white/60 ring-white/[0.1] hover:bg-white/[0.1]'
                      }`}
                    >
                      {done && <CheckCircle2 className="h-3 w-3 text-emerald-300" />}
                      {ch.number}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                aria-label="Minimize story card"
                className="pressable flex h-6 w-6 items-center justify-center rounded-full text-white/55 hover:bg-white/[0.08] hover:text-white"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Chapter Title & Copy */}
            <h2 className="text-[15px] font-semibold tracking-tight text-white">
              {chapter.title}
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/75">
              {chapter.summary}
            </p>

            {/* Interactive Micro-Task */}
            <div
              className={`mt-3 rounded-2xl border px-3 py-2 text-[11px] leading-snug ${
                isComplete
                  ? 'border-emerald-400/35 bg-emerald-400/12 text-emerald-100'
                  : 'border-white/[0.1] bg-white/[0.04] text-white/80'
              }`}
            >
              <div className="mb-0.5 flex items-center gap-1.5 font-semibold">
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${isComplete ? 'text-emerald-300' : 'text-white/40'}`}
                />
                <span>{isComplete ? 'Completed!' : 'Try it in 3D'}</span>
              </div>
              <p>{chapter.taskPrompt}</p>
            </div>

            {/* Chapter-Specific CTAs + Ask Gemini */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chapter.id === 'how-bpe-merges' && (
                <button
                  type="button"
                  onClick={togglePlayTimeline}
                  className="pressable flex items-center gap-1 rounded-full bg-sky-400/20 px-3 py-1 text-[11px] font-semibold text-sky-200 ring-1 ring-sky-400/40 hover:bg-sky-400/30"
                >
                  <Play className="h-3 w-3" />
                  Play Merge Animation
                </button>
              )}

              {chapter.id === 'multilingual-tax' && (
                <button
                  type="button"
                  onClick={() => void runComparison()}
                  className="pressable flex items-center gap-1 rounded-full bg-indigo-400/20 px-3 py-1 text-[11px] font-semibold text-indigo-200 ring-1 ring-indigo-400/40 hover:bg-indigo-400/30"
                >
                  <BarChart3 className="h-3 w-3" />
                  Open Real LLM Comparison
                </button>
              )}

              {chapter.id === 'regex-and-vectors' && (
                <>
                  <button
                    type="button"
                    onClick={() => setUseRegex(!useRegex)}
                    className="pressable flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-medium text-amber-200 ring-1 ring-amber-400/35"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Toggle Regex {useRegex ? 'OFF' : 'ON'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraPreset('vectors')}
                    className="pressable flex items-center gap-1 rounded-full bg-sky-400/15 px-2.5 py-1 text-[11px] font-medium text-sky-200 ring-1 ring-sky-400/35"
                  >
                    <Orbit className="h-3 w-3" />
                    Fly to 3D Vector Space
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setCopilotOpen(true)
                  void sendCopilotPrompt(chapter.suggestedQuestion)
                }}
                className="pressable flex items-center gap-1 rounded-full bg-white/[0.08] px-3 py-1 text-[11px] font-medium text-white/90 ring-1 ring-white/[0.14] hover:bg-white/[0.14]"
              >
                <Sparkles className="h-3 w-3 text-sky-300" />
                Ask Gemini
              </button>
            </div>

            {/* Footer Navigation */}
            <div className="mt-3.5 flex items-center justify-between border-t border-white/[0.08] pt-2.5">
              <button
                type="button"
                onClick={prevGuidedChapter}
                disabled={guidedChapterIndex === 0}
                className="pressable flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-white/75 hover:bg-white/[0.08] disabled:opacity-35"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              {guidedChapterIndex < GUIDED_CHAPTERS.length - 1 ? (
                <button
                  type="button"
                  onClick={nextGuidedChapter}
                  className="pressable flex items-center gap-1 rounded-full bg-white/[0.12] px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/[0.2]"
                >
                  Next Chapter
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode('playground')}
                  className="pressable flex items-center gap-1 rounded-full bg-emerald-400/20 px-3 py-1 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-400/30"
                >
                  Start Exploring Playground
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
