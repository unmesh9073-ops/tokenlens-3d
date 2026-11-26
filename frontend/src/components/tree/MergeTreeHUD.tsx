import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Combine,
  Eye,
  GitBranch,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  useStudioStore,
  type PlaybackSpeed,
  type TreeCameraPreset,
} from '../../store/useStudioStore'
import type { MergeTreeNode } from '../../types/tokenizer'
import { TREE_MAX_BYTES } from './treeLayout'

const TREE_CAMERA_PRESETS: Array<{ id: TreeCameraPreset; label: string }> = [
  { id: 'forest', label: 'Full Forest' },
  { id: 'leaves', label: 'Byte Leaves' },
  { id: 'roots', label: 'Top Tokens' },
  { id: 'focus', label: 'Focus Node' },
]

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 2]
const SPEED_INTERVAL_MS: Record<PlaybackSpeed, number> = {
  0.5: 1600,
  1: 950,
  2: 450,
}

export function MergeTreeHUD() {
  const activeDiagram = useStudioStore((s) => s.activeDiagram)
  const analysis = useStudioStore((s) => s.analysis)
  const labMode = useStudioStore((s) => s.labMode)
  const manualTree = useStudioStore((s) => s.manualTree)
  const manualPairFrequencies = useStudioStore((s) => s.manualPairFrequencies)
  const isCopilotOpen = useStudioStore((s) => s.isCopilotOpen)

  const timelineStep = useStudioStore((s) => s.timelineStep)
  const isPlayingTimeline = useStudioStore((s) => s.isPlayingTimeline)
  const playbackSpeed = useStudioStore((s) => s.playbackSpeed)
  const treeCameraPreset = useStudioStore((s) => s.treeCameraPreset)

  const selectedNodeId = useStudioStore((s) => s.selectedNodeId)
  const selectedByteSpan = useStudioStore((s) => s.selectedByteSpan)

  const setTimelineStep = useStudioStore((s) => s.setTimelineStep)
  const stepTimelineForward = useStudioStore((s) => s.stepTimelineForward)
  const stepTimelineBackward = useStudioStore((s) => s.stepTimelineBackward)
  const togglePlayTimeline = useStudioStore((s) => s.togglePlayTimeline)
  const setPlayingTimeline = useStudioStore((s) => s.setPlayingTimeline)
  const setPlaybackSpeed = useStudioStore((s) => s.setPlaybackSpeed)
  const setTreeCameraPreset = useStudioStore((s) => s.setTreeCameraPreset)
  const setSelection = useStudioStore((s) => s.setSelection)
  const clearSelection = useStudioStore((s) => s.clearSelection)
  const performManualMerge = useStudioStore((s) => s.performManualMerge)
  const resetManualLab = useStudioStore((s) => s.resetManualLab)

  const [isFreqCollapsed, setIsFreqCollapsed] = useState(false)

  const totalSteps = analysis?.merge_steps.length ?? 0

  // Playback timer
  useEffect(() => {
    if (activeDiagram !== 'tree' || labMode !== 'auto' || !isPlayingTimeline) return
    const timer = window.setInterval(() => {
      const state = useStudioStore.getState()
      const maxSteps = state.analysis?.merge_steps.length ?? 0
      if (state.timelineStep >= maxSteps) {
        state.setPlayingTimeline(false)
      } else {
        state.stepTimelineForward()
      }
    }, SPEED_INTERVAL_MS[playbackSpeed])
    return () => window.clearInterval(timer)
  }, [activeDiagram, labMode, isPlayingTimeline, playbackSpeed])

  const activeTree = labMode === 'manual' ? manualTree : (analysis?.merge_tree ?? null)
  const nodeMap = useMemo(() => {
    const map = new Map<string, MergeTreeNode>()
    for (const n of activeTree?.nodes ?? []) {
      map.set(n.node_id, n)
    }
    return map
  }, [activeTree])

  const selectedNode = useMemo(() => {
    if (selectedNodeId && nodeMap.has(selectedNodeId)) {
      return nodeMap.get(selectedNodeId) ?? null
    }
    if (selectedByteSpan && activeTree) {
      return (
        activeTree.nodes.find(
          (n) =>
            n.byte_span[0] === selectedByteSpan[0] &&
            n.byte_span[1] === selectedByteSpan[1],
        ) ?? null
      )
    }
    return null
  }, [selectedNodeId, nodeMap, selectedByteSpan, activeTree])

  const currentStepData =
    timelineStep > 0 && analysis ? analysis.merge_steps[timelineStep - 1] : null

  const pairFrequencies = useMemo(() => {
    if (labMode === 'manual') return manualPairFrequencies
    if (!analysis || analysis.merge_steps.length === 0) return []
    if (timelineStep === 0) return analysis.merge_steps[0].top_pair_frequencies
    return analysis.merge_steps[timelineStep - 1]?.top_pair_frequencies ?? []
  }, [labMode, manualPairFrequencies, analysis, timelineStep])

  const winningPair = currentStepData?.pair ?? null
  const maxPairCount = Math.max(1, ...pairFrequencies.map((p) => p.count))

  if (activeDiagram !== 'tree') return null

  const isTruncated = (analysis?.raw_bytes.length ?? 0) > TREE_MAX_BYTES

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackSpeed)
    setPlaybackSpeed(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length])
  }

  const selectChildNode = (childId: string | null) => {
    if (!childId) return
    const child = nodeMap.get(childId)
    if (!child) return
    setSelection({
      byteSpan: child.byte_span,
      nodeId: child.node_id,
    })
    setTreeCameraPreset('focus')
  }

  const narrationText = (() => {
    const leafCount = analysis?.raw_bytes.length ?? 0
    if (timelineStep === 0 || !currentStepData) {
      return `Step 0 / ${totalSteps} · Raw UTF-8 Bytes (${leafCount} tokens)`
    }
    const leftChild = nodeMap
      .get(
        activeTree?.nodes.find((n) => n.merge_step === currentStepData.step_index)
          ?.left_child_id ?? '',
      )
      ?.display_text ?? `#${currentStepData.pair[0]}`
    const rightChild = nodeMap
      .get(
        activeTree?.nodes.find((n) => n.merge_step === currentStepData.step_index)
          ?.right_child_id ?? '',
      )
      ?.display_text ?? `#${currentStepData.pair[1]}`

    return `Step ${timelineStep} / ${totalSteps} · Merged '${leftChild}' + '${rightChild}' → '${currentStepData.merged_text}' (#${currentStepData.new_id}) · occurred ${currentStepData.occurrences}× · seq ${currentStepData.active_node_ids.length}`
  })()

  return (
    <>
      {/* Top-Center Tree Camera Preset Pills */}
      <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-10 flex flex-wrap items-center justify-center gap-2 px-4">
        <div className="glass-surface pointer-events-auto flex items-center gap-1 rounded-full p-1">
          <Eye className="ml-2 mr-1 h-3.5 w-3.5 text-white/50" />
          {TREE_CAMERA_PRESETS.map((preset) => {
            const active = treeCameraPreset === preset.id
            const disabled =
              preset.id === 'focus' && !selectedNode && timelineStep === 0
            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                onClick={() => setTreeCameraPreset(preset.id)}
                className={`pressable relative rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                  active ? 'text-white' : 'text-white/60 hover:text-white/90'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tree-camera-pill"
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
            Showing first {TREE_MAX_BYTES} bytes in 3D
          </div>
        )}
      </div>

      {/* Top-Left Tree Node Lineage Inspector */}
      <div className="pointer-events-none fixed left-4 top-20 z-10 flex w-[305px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              key="tree-node-inspector"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="glass-panel-heavy pointer-events-auto rounded-2xl p-3.5"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                    {selectedNode.is_special
                      ? 'Special Token'
                      : selectedNode.is_leaf
                        ? 'UTF-8 Byte Leaf'
                        : `Merged Subword · Depth ${selectedNode.depth}`}
                  </span>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="text-[16px] font-semibold tracking-tight text-white">
                      {selectedNode.display_text}
                    </span>
                    <span className="font-mono-tech rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[11px] text-emerald-300">
                      #{selectedNode.token_id}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  aria-label="Clear node selection"
                  className="pressable rounded-full p-1 text-white/50 hover:bg-white/[0.08] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="font-mono-tech mb-2.5 flex flex-wrap gap-1.5 text-[11px] text-white/70">
                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5">
                  {selectedNode.bytes_hex}
                </span>
                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5">
                  depth {selectedNode.depth}
                </span>
                {selectedNode.merge_step !== null && (
                  <span className="rounded-md bg-sky-400/15 px-1.5 py-0.5 text-sky-200">
                    step {selectedNode.merge_step + 1}
                  </span>
                )}
              </div>

              {(selectedNode.left_child_id || selectedNode.right_child_id) && (
                <div className="border-t border-white/[0.08] pt-2.5">
                  <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                    <GitBranch className="h-3 w-3" />
                    Walk Children
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {selectedNode.left_child_id && (
                      <button
                        type="button"
                        onClick={() => selectChildNode(selectedNode.left_child_id)}
                        className="pressable truncate rounded-xl border border-white/[0.1] bg-white/[0.05] px-2.5 py-1.5 text-left text-[11px] text-white/85 hover:border-sky-400/40 hover:bg-sky-400/10"
                      >
                        <span className="text-white/45">L: </span>
                        <span className="font-mono-tech">
                          {nodeMap.get(selectedNode.left_child_id)?.display_text ?? ''}
                        </span>
                      </button>
                    )}
                    {selectedNode.right_child_id && (
                      <button
                        type="button"
                        onClick={() => selectChildNode(selectedNode.right_child_id)}
                        className="pressable truncate rounded-xl border border-white/[0.1] bg-white/[0.05] px-2.5 py-1.5 text-left text-[11px] text-white/85 hover:border-sky-400/40 hover:bg-sky-400/10"
                      >
                        <span className="text-white/45">R: </span>
                        <span className="font-mono-tech">
                          {nodeMap.get(selectedNode.right_child_id)?.display_text ?? ''}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Top-Right Live Pair-Frequency Inspector Card */}
      <div
        className={`pointer-events-none fixed top-20 z-10 w-[290px] max-w-[calc(100vw-2rem)] transition-[right] duration-300 ${
          isCopilotOpen ? 'right-[364px] hidden lg:block' : 'right-4'
        }`}
      >
        <div className="glass-panel-heavy pointer-events-auto overflow-hidden rounded-2xl">
          <button
            type="button"
            onClick={() => setIsFreqCollapsed((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-left hover:bg-white/[0.03]"
          >
            <div className="flex items-center gap-1.5">
              <Combine className="h-3.5 w-3.5 text-sky-300" />
              <span className="text-[12px] font-semibold text-white">
                {labMode === 'manual' ? 'Manual Pair Frequencies' : 'Pair-Frequency Inspector'}
              </span>
            </div>
            {isFreqCollapsed ? (
              <ChevronDown className="h-3.5 w-3.5 text-white/55" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5 text-white/55" />
            )}
          </button>

          {!isFreqCollapsed && (
            <div className="border-t border-white/[0.08] px-3.5 py-2.5">
              {labMode === 'manual' && (
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] text-white/60">
                    Click a pair to merge:
                  </span>
                  <button
                    type="button"
                    onClick={() => void resetManualLab()}
                    className="pressable flex items-center gap-1 rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] text-white/80 hover:bg-white/[0.14]"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Reset
                  </button>
                </div>
              )}

              {pairFrequencies.length === 0 ? (
                <p className="py-1 text-[11px] text-white/50">
                  No adjacent pairs available at this step.
                </p>
              ) : (
                <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto pr-0.5">
                  {pairFrequencies.slice(0, 7).map((item) => {
                    const isWinner =
                      labMode === 'auto' &&
                      winningPair !== null &&
                      winningPair[0] === item.pair[0] &&
                      winningPair[1] === item.pair[1]
                    const fillPct = Math.max(10, (item.count / maxPairCount) * 100)

                    return (
                      <button
                        key={`${item.pair[0]}-${item.pair[1]}`}
                        type="button"
                        disabled={labMode !== 'manual'}
                        onClick={() => {
                          if (labMode === 'manual') {
                            void performManualMerge(item.pair[0], item.pair[1])
                          }
                        }}
                        className={`relative overflow-hidden rounded-xl border px-2.5 py-1.5 text-left text-[11px] ${
                          isWinner
                            ? 'border-sky-400/45 bg-sky-400/15'
                            : 'border-white/[0.08] bg-white/[0.04]'
                        } ${labMode === 'manual' ? 'pressable cursor-pointer hover:border-emerald-400/40' : 'cursor-default'}`}
                      >
                        <div
                          className={`pointer-events-none absolute inset-y-0 left-0 ${
                            isWinner ? 'bg-sky-400/20' : 'bg-white/[0.05]'
                          }`}
                          style={{ width: `${fillPct}%` }}
                        />
                        <div className="relative z-10 flex items-center justify-between gap-2">
                          <span className="font-mono-tech truncate text-white/90">
                            &ldquo;{item.left_text}&rdquo; + &ldquo;{item.right_text}&rdquo;
                          </span>
                          <span
                            className={`font-mono-tech shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
                              isWinner
                                ? 'bg-sky-400/30 text-sky-100'
                                : 'bg-white/[0.08] text-white/75'
                            }`}
                          >
                            ×{item.count}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Merge Timeline Scrubber Bar (above Bottom Input Dock in Auto mode) */}
      {labMode === 'auto' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[8.75rem] z-20 flex justify-center px-4">
          <div className="glass-surface pointer-events-auto flex w-full max-w-3xl flex-col gap-2 rounded-2xl px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setPlayingTimeline(false)
                    setTimelineStep(0)
                  }}
                  title="Reset to Raw Bytes (Step 0)"
                  className="pressable flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-white/80 hover:bg-white/[0.14]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={stepTimelineBackward}
                  disabled={timelineStep <= 0}
                  aria-label="Step backward"
                  className="pressable flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-white/80 hover:bg-white/[0.14] disabled:opacity-35"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={togglePlayTimeline}
                  disabled={totalSteps === 0}
                  aria-label={isPlayingTimeline ? 'Pause timeline' : 'Play timeline'}
                  className="pressable flex h-7 items-center gap-1 rounded-full bg-sky-400/20 px-3 text-[11px] font-semibold text-sky-200 ring-1 ring-sky-400/40 hover:bg-sky-400/30 disabled:opacity-40"
                >
                  {isPlayingTimeline ? (
                    <>
                      <Pause className="h-3 w-3" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" /> Play
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={stepTimelineForward}
                  disabled={timelineStep >= totalSteps}
                  aria-label="Step forward"
                  className="pressable flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-white/80 hover:bg-white/[0.14] disabled:opacity-35"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={cycleSpeed}
                  className="pressable font-mono-tech rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/[0.14]"
                >
                  {playbackSpeed}x
                </button>
              </div>

              <span className="font-mono-tech truncate text-[11px] text-sky-200/90">
                {narrationText}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={totalSteps}
              step={1}
              value={timelineStep}
              onChange={(e) => {
                setPlayingTimeline(false)
                setTimelineStep(Number(e.target.value))
              }}
              aria-label="BPE merge timeline step"
              className="h-1.5 w-full cursor-pointer accent-sky-400"
            />
          </div>
        </div>
      )}
    </>
  )
}
