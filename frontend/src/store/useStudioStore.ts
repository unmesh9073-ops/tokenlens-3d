import { create } from 'zustand'
import { GUIDED_CHAPTERS } from '../components/guided/chapters'
import { tokenizerClient } from '../api/tokenizerClient'
import { playSpaceWhoosh, setSpatialSoundEnabled } from '../utils/spatialAudio'
import type {
  AnalyzeResponse,
  CompareResponse,
  CopilotAction,
  EmbeddingsProjectResponse,
  MergeTree,
  MergeTreeNode,
  PairFrequencyItem,
  TrainResponse,
  WorkspaceContext,
} from '../types/tokenizer'

export type StudioMode = 'playground' | 'guided'
export type DiagramView = 'pipeline' | 'tree'
export type SpatialSpace = 'hub' | 'pipeline' | 'tree' | 'vectors' | 'arena'
export type SpatialVolume = Exclude<SpatialSpace, 'hub'>
export type LabMode = 'auto' | 'manual'
export type CameraPreset = 'overview' | 'text' | 'bytes' | 'subwords' | 'ids' | 'vectors'
export type TreeCameraPreset = 'forest' | 'leaves' | 'roots' | 'focus'
export type PlaybackSpeed = 0.5 | 1 | 2

export interface HealthStatus {
  status: string
  gemini_configured: boolean
  chat_model: string
  embedding_model: string
  tiktoken_ready: boolean
  hf_tokenizers_ready: boolean
}

export interface CustomTokenizerEntry {
  id: string
  name: string
  vocabSize: number
}

export interface SelectedInspectorInfo {
  stage: 'chunk' | 'byte' | 'subword' | 'id' | 'vector'
  text: string
  bytesHex: string
  tokenId?: number
  byteSpan: [number, number]
  kindLabel: string
  explanation: string
}

export interface UndoSnapshot {
  inputText: string
  activeDiagram: DiagramView
  useRegex: boolean
  labMode: LabMode
  timelineStep: number
}

export interface CopilotChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: CopilotAction[]
  followUpChips?: string[]
  mode?: 'live' | 'demo'
  warning?: string | null
  previousSnapshot?: UndoSnapshot
}

const API_KEY_STORAGE_KEY = 'tokenlens_gemini_key'

function readStoredApiKey(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.sessionStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

const INITIAL_COPILOT_MESSAGE: CopilotChatEntry = {
  id: 'welcome',
  role: 'assistant',
  content:
    'I can inspect your live 3D tokens, animate BPE merges step-by-step, and explain why words or emojis split the way they do.',
}

function computePairFrequencies(
  sequenceNodeIds: string[],
  nodes: MergeTreeNode[],
  useRegex: boolean,
): PairFrequencyItem[] {
  const byId = new Map(nodes.map((n) => [n.node_id, n]))
  const counts = new Map<string, PairFrequencyItem>()

  for (let i = 0; i < sequenceNodeIds.length - 1; i++) {
    const left = byId.get(sequenceNodeIds[i])
    const right = byId.get(sequenceNodeIds[i + 1])
    if (!left || !right) continue
    if (left.is_special || right.is_special) continue
    if (useRegex && left.chunk_index !== right.chunk_index) continue

    const key = `${left.token_id}:${right.token_id}`
    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, {
        pair: [left.token_id, right.token_id],
        left_text: left.display_text,
        right_text: right.display_text,
        count: 1,
      })
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
}

interface StudioState {
  mode: StudioMode
  activeDiagram: DiagramView
  activeSpace: SpatialSpace
  hoveredVolume: SpatialVolume | null
  hubCarouselIndex: number
  isSpotlightOpen: boolean
  isControlsOpen: boolean
  isCopilotOpen: boolean
  isSoundEnabled: boolean
  selectedWorldPosition: [number, number, number] | null
  mergeBurstEvent: { id: number; position: [number, number, number]; color: string } | null
  inputText: string
  useRegex: boolean
  activeTokenizerId: string
  customTokenizers: CustomTokenizerEntry[]

  analysis: AnalyzeResponse | null
  embeddings: EmbeddingsProjectResponse | null
  comparison: CompareResponse | null
  isLoading: boolean
  error: string | null

  labMode: LabMode
  manualNodes: string[]
  manualTree: MergeTree | null
  manualPairFrequencies: PairFrequencyItem[]
  manualSelectedIndex: number | null

  selectedByteSpan: [number, number] | null
  selectedTokenIndex: number | null
  selectedNodeId: string | null
  inspectorInfo: SelectedInspectorInfo | null
  vectorCompareIndices: number[]
  cameraPreset: CameraPreset

  timelineStep: number
  isPlayingTimeline: boolean
  playbackSpeed: PlaybackSpeed
  treeCameraPreset: TreeCameraPreset

  isCompareOpen: boolean
  isCompareLoading: boolean
  isTrainModalOpen: boolean
  isTraining: boolean
  lastTrainResult: TrainResponse | null

  copilotMessages: CopilotChatEntry[]
  isCopilotThinking: boolean
  userApiKey: string
  lastCopilotActionBanner: string | null

  guidedChapterIndex: number
  completedChapters: string[]

  setMode: (mode: StudioMode) => void
  setActiveDiagram: (diagram: DiagramView) => void
  setActiveSpace: (space: SpatialSpace) => void
  setHoveredVolume: (volume: SpatialVolume | null) => void
  setHubCarouselIndex: (index: number) => void
  setSpotlightOpen: (open: boolean) => void
  toggleSpotlight: () => void
  setControlsOpen: (open: boolean) => void
  toggleControls: () => void
  setCopilotOpen: (open: boolean) => void
  toggleCopilot: () => void
  toggleSound: () => void
  triggerMergeBurst: (position: [number, number, number], color?: string) => void
  setInputText: (text: string) => void
  setUseRegex: (useRegex: boolean) => void
  setActiveTokenizerId: (id: string) => void
  setLabMode: (mode: LabMode) => void
  setCameraPreset: (preset: CameraPreset) => void
  setTimelineStep: (step: number) => void
  stepTimelineForward: () => void
  stepTimelineBackward: () => void
  togglePlayTimeline: () => void
  setPlayingTimeline: (playing: boolean) => void
  setPlaybackSpeed: (speed: PlaybackSpeed) => void
  setTreeCameraPreset: (preset: TreeCameraPreset) => void
  setCompareOpen: (open: boolean) => void
  setTrainModalOpen: (open: boolean) => void

  setSelection: (
    selection: {
      byteSpan: [number, number] | null
      tokenIndex?: number | null
      nodeId?: string | null
      info?: SelectedInspectorInfo | null
      worldPosition?: [number, number, number] | null
    },
  ) => void
  clearSelection: () => void
  toggleVectorCompareIndex: (index: number) => void
  setManualSelectedIndex: (index: number | null) => void

  fetchAnalysisAndEmbeddings: (signal?: AbortSignal) => Promise<void>
  resetManualLab: () => Promise<void>
  performManualMerge: (leftTokenId: number, rightTokenId: number) => Promise<void>
  runComparison: () => Promise<void>
  trainCustomTokenizer: (corpus: string, numMerges: number, useRegex: boolean, name?: string) => Promise<TrainResponse>

  setUserApiKey: (key: string) => void
  clearCopilotChat: () => void
  dismissCopilotBanner: () => void
  executeCopilotActions: (actions: CopilotAction[]) => void
  undoCopilotSnapshot: (snapshot: UndoSnapshot) => void
  sendCopilotPrompt: (message: string) => Promise<void>

  setGuidedChapter: (index: number) => void
  nextGuidedChapter: () => void
  prevGuidedChapter: () => void
  markChapterComplete: (chapterId: string) => void
}

export const useStudioStore = create<StudioState>((set, get) => ({
  mode: 'playground',
  activeDiagram: 'pipeline',
  activeSpace: 'hub',
  hoveredVolume: null,
  hubCarouselIndex: 0,
  isSpotlightOpen: false,
  isControlsOpen: false,
  isCopilotOpen: false,
  isSoundEnabled: true,
  selectedWorldPosition: null,
  mergeBurstEvent: null,
  inputText: 'Tokenization makes AI read!',
  useRegex: true,
  activeTokenizerId: 'default',
  customTokenizers: [{ id: 'default', name: 'Default Starter', vocabSize: 359 }],

  analysis: null,
  embeddings: null,
  comparison: null,
  isLoading: false,
  error: null,

  labMode: 'auto',
  manualNodes: [],
  manualTree: null,
  manualPairFrequencies: [],
  manualSelectedIndex: null,

  selectedByteSpan: null,
  selectedTokenIndex: null,
  selectedNodeId: null,
  inspectorInfo: null,
  vectorCompareIndices: [],
  cameraPreset: 'overview',

  timelineStep: 0,
  isPlayingTimeline: false,
  playbackSpeed: 1,
  treeCameraPreset: 'forest',

  isCompareOpen: false,
  isCompareLoading: false,
  isTrainModalOpen: false,
  isTraining: false,
  lastTrainResult: null,

  copilotMessages: [INITIAL_COPILOT_MESSAGE],
  isCopilotThinking: false,
  userApiKey: readStoredApiKey(),
  lastCopilotActionBanner: null,

  guidedChapterIndex: 0,
  completedChapters: [],

  setMode: (mode) => {
    set({ mode })
    if (mode === 'guided') {
      get().setGuidedChapter(get().guidedChapterIndex)
    }
  },
  setActiveDiagram: (activeDiagram) => set({ activeDiagram, activeSpace: activeDiagram }),
  setActiveSpace: (activeSpace) => {
    const prev = get().activeSpace
    if (prev !== activeSpace) {
      playSpaceWhoosh()
    }
    set((state) => ({
      activeSpace,
      activeDiagram:
        activeSpace === 'pipeline' || activeSpace === 'tree' ? activeSpace : state.activeDiagram,
      isControlsOpen: activeSpace === 'hub' ? false : state.isControlsOpen,
      selectedWorldPosition: prev !== activeSpace ? null : state.selectedWorldPosition,
      inspectorInfo: prev !== activeSpace ? null : state.inspectorInfo,
    }))
  },
  setHoveredVolume: (hoveredVolume) => set({ hoveredVolume }),
  setHubCarouselIndex: (hubCarouselIndex) =>
    set({ hubCarouselIndex: ((hubCarouselIndex % 4) + 4) % 4 }),
  setSpotlightOpen: (isSpotlightOpen) => set({ isSpotlightOpen }),
  toggleSpotlight: () => set((state) => ({ isSpotlightOpen: !state.isSpotlightOpen })),
  setControlsOpen: (isControlsOpen) => set({ isControlsOpen }),
  toggleControls: () => set((state) => ({ isControlsOpen: !state.isControlsOpen })),
  setCopilotOpen: (isCopilotOpen) => set({ isCopilotOpen }),
  toggleCopilot: () => set((state) => ({ isCopilotOpen: !state.isCopilotOpen })),
  toggleSound: () =>
    set((state) => {
      const next = !state.isSoundEnabled
      setSpatialSoundEnabled(next)
      return { isSoundEnabled: next }
    }),
  triggerMergeBurst: (position, color = '#a78bfa') =>
    set({ mergeBurstEvent: { id: Date.now() + Math.random(), position, color } }),
  setInputText: (inputText) => set({ inputText }),
  setUseRegex: (useRegex) => set({ useRegex }),
  setActiveTokenizerId: (id) => set({ activeTokenizerId: id }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setTimelineStep: (step) => {
    const total = get().analysis?.merge_steps.length ?? 0
    const clamped = Math.max(0, Math.min(step, total))
    set({ timelineStep: clamped })
  },
  stepTimelineForward: () => {
    const { timelineStep, analysis } = get()
    const total = analysis?.merge_steps.length ?? 0
    if (timelineStep < total) {
      set({ timelineStep: timelineStep + 1 })
    } else {
      set({ isPlayingTimeline: false })
    }
  },
  stepTimelineBackward: () => {
    const { timelineStep } = get()
    set({ timelineStep: Math.max(0, timelineStep - 1), isPlayingTimeline: false })
  },
  togglePlayTimeline: () => {
    const { isPlayingTimeline, timelineStep, analysis } = get()
    const total = analysis?.merge_steps.length ?? 0
    if (!isPlayingTimeline) {
      if (total === 0) return
      set({
        isPlayingTimeline: true,
        timelineStep: timelineStep >= total ? 0 : timelineStep,
      })
    } else {
      set({ isPlayingTimeline: false })
    }
  },
  setPlayingTimeline: (isPlayingTimeline) => set({ isPlayingTimeline }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setTreeCameraPreset: (treeCameraPreset) => set({ treeCameraPreset }),
  setCompareOpen: (isCompareOpen) => set({ isCompareOpen }),
  setTrainModalOpen: (isTrainModalOpen) => set({ isTrainModalOpen }),
  setManualSelectedIndex: (manualSelectedIndex) => set({ manualSelectedIndex }),

  setLabMode: (labMode) => {
    set({ labMode, manualSelectedIndex: null })
    if (labMode === 'manual') {
      void get().resetManualLab()
    }
  },

  setSelection: ({
    byteSpan,
    tokenIndex = null,
    nodeId = null,
    info = null,
    worldPosition = null,
  }) =>
    set({
      selectedByteSpan: byteSpan,
      selectedTokenIndex: tokenIndex,
      selectedNodeId: nodeId,
      inspectorInfo: info,
      selectedWorldPosition: worldPosition,
    }),

  clearSelection: () =>
    set({
      selectedByteSpan: null,
      selectedTokenIndex: null,
      selectedNodeId: null,
      inspectorInfo: null,
      selectedWorldPosition: null,
      manualSelectedIndex: null,
    }),

  toggleVectorCompareIndex: (index) =>
    set((state) => {
      if (state.vectorCompareIndices.includes(index)) {
        return {
          vectorCompareIndices: state.vectorCompareIndices.filter((i) => i !== index),
        }
      }
      if (state.vectorCompareIndices.length >= 2) {
        return { vectorCompareIndices: [state.vectorCompareIndices[1], index] }
      }
      return { vectorCompareIndices: [...state.vectorCompareIndices, index] }
    }),

  fetchAnalysisAndEmbeddings: async (signal) => {
    const { inputText, activeTokenizerId, useRegex, labMode } = get()
    set({ isLoading: true, error: null })
    try {
      const analysis = await tokenizerClient.analyze(
        {
          text: inputText,
          tokenizer_id: activeTokenizerId,
          use_regex: useRegex,
        },
        signal,
      )

      const tokensForEmbed = analysis.final_tokens.slice(0, 40).map((t) => ({
        index: t.index,
        token_id: t.token_id,
        text: t.text,
      }))

      const embeddings = await tokenizerClient.projectEmbeddings(
        { tokens: tokensForEmbed },
        signal,
        get().userApiKey,
      )

      if (signal?.aborted) return

      set({
        analysis,
        embeddings,
        isLoading: false,
        timelineStep: analysis.merge_steps.length,
        isPlayingTimeline: false,
        vectorCompareIndices:
          embeddings.points.length >= 2 ? [0, 1] : embeddings.points.length === 1 ? [0] : [],
      })

      if (labMode === 'manual') {
        await get().resetManualLab()
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to analyze text',
      })
    }
  },

  resetManualLab: async () => {
    const { inputText, activeTokenizerId, useRegex } = get()
    try {
      const rawTrace = await tokenizerClient.analyze({
        text: inputText,
        tokenizer_id: activeTokenizerId,
        use_regex: useRegex,
        max_merges: 0,
      })
      const freqs = computePairFrequencies(
        rawTrace.merge_tree.root_node_ids,
        rawTrace.merge_tree.nodes,
        useRegex,
      )
      set({
        manualNodes: rawTrace.merge_tree.root_node_ids,
        manualTree: rawTrace.merge_tree,
        manualPairFrequencies: freqs,
        manualSelectedIndex: null,
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to initialize manual lab',
      })
    }
  },

  performManualMerge: async (leftTokenId, rightTokenId) => {
    const { activeTokenizerId, manualTree, manualNodes, useRegex } = get()
    if (!manualTree || manualNodes.length < 2) return
    try {
      const res = await tokenizerClient.manualMerge({
        tokenizer_id: activeTokenizerId,
        nodes: manualTree.nodes,
        sequence_node_ids: manualNodes,
        left_token_id: leftTokenId,
        right_token_id: rightTokenId,
        use_regex: useRegex,
      })
      set({
        manualNodes: res.sequence_node_ids,
        manualTree: res.merge_tree,
        manualPairFrequencies: res.pair_frequencies,
        manualSelectedIndex: null,
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Manual merge failed',
      })
    }
  },

  runComparison: async () => {
    const { inputText, activeTokenizerId, useRegex } = get()
    set({ isCompareLoading: true, isCompareOpen: true })
    try {
      const comparison = await tokenizerClient.compare({
        text: inputText,
        tokenizer_id: activeTokenizerId,
        use_regex: useRegex,
      })
      set({ comparison, isCompareLoading: false })
    } catch (err) {
      set({
        isCompareLoading: false,
        error: err instanceof Error ? err.message : 'Comparison failed',
      })
    }
  },

  trainCustomTokenizer: async (corpus, numMerges, useRegex, name) => {
    set({ isTraining: true })
    try {
      const res = await tokenizerClient.train({
        corpus,
        num_merges: numMerges,
        use_regex: useRegex,
        name: name?.trim() || undefined,
      })
      set((state) => ({
        isTraining: false,
        lastTrainResult: res,
        activeTokenizerId: res.tokenizer_id,
        useRegex: res.use_regex,
        customTokenizers: [
          ...state.customTokenizers.filter((t) => t.id !== res.tokenizer_id),
          { id: res.tokenizer_id, name: res.name, vocabSize: res.vocab_size },
        ],
      }))
      await get().fetchAnalysisAndEmbeddings()
      return res
    } catch (err) {
      set({
        isTraining: false,
        error: err instanceof Error ? err.message : 'Training failed',
      })
      throw err
    }
  },

  setUserApiKey: (key) => {
    const trimmed = key.trim()
    try {
      if (trimmed) {
        window.sessionStorage.setItem(API_KEY_STORAGE_KEY, trimmed)
      } else {
        window.sessionStorage.removeItem(API_KEY_STORAGE_KEY)
      }
    } catch {
      // ignore storage errors
    }
    set({ userApiKey: trimmed })
    void get().fetchAnalysisAndEmbeddings()
  },

  clearCopilotChat: () =>
    set({
      copilotMessages: [INITIAL_COPILOT_MESSAGE],
      lastCopilotActionBanner: null,
    }),

  dismissCopilotBanner: () => set({ lastCopilotActionBanner: null }),

  executeCopilotActions: (actions) => {
    if (!actions || actions.length === 0) return
    const summaryParts: string[] = []

    for (const action of actions) {
      const args = action.args ?? {}
      switch (action.name) {
        case 'set_input_text':
          if (typeof args.text === 'string') {
            set({ inputText: args.text })
            summaryParts.push(`Loaded "${args.text.slice(0, 22)}${args.text.length > 22 ? '…' : ''}"`)
          }
          break
        case 'switch_diagram':
          if (args.diagram === 'pipeline' || args.diagram === 'tree') {
            set({ activeDiagram: args.diagram, activeSpace: args.diagram })
            summaryParts.push(args.diagram === 'tree' ? '3D Merge Tree' : '3D Pipeline')
          }
          break
        case 'set_use_regex':
          if (typeof args.enabled === 'boolean') {
            set({ useRegex: args.enabled })
            summaryParts.push(`Regex ${args.enabled ? 'ON' : 'OFF'}`)
          }
          break
        case 'set_lab_mode':
          if (args.mode === 'auto' || args.mode === 'manual') {
            get().setLabMode(args.mode)
            summaryParts.push(args.mode === 'manual' ? 'Manual Lab' : 'Auto BPE')
          }
          break
        case 'highlight_token': {
          const analysis = get().analysis
          if (typeof args.token_index === 'number' && analysis) {
            const tok = analysis.final_tokens.find((t) => t.index === args.token_index)
            if (tok) {
              get().setSelection({
                byteSpan: tok.byte_span,
                tokenIndex: tok.index,
                nodeId: tok.root_node_id,
              })
              summaryParts.push(`Highlighted "${tok.text}"`)
            }
          } else if (typeof args.node_id === 'string' && analysis) {
            const node = analysis.merge_tree.nodes.find((n) => n.node_id === args.node_id)
            if (node) {
              get().setSelection({
                byteSpan: node.byte_span,
                nodeId: node.node_id,
              })
              summaryParts.push(`Highlighted "${node.display_text}"`)
            }
          }
          break
        }
        case 'focus_camera': {
          const preset = String(args.preset ?? '')
          if (['forest', 'leaves', 'roots', 'focus'].includes(preset)) {
            set({ treeCameraPreset: preset as TreeCameraPreset, activeSpace: 'tree', activeDiagram: 'tree' })
            summaryParts.push(`Camera -> ${preset}`)
          } else if (preset === 'vectors') {
            set({ cameraPreset: 'vectors', activeSpace: 'vectors' })
            summaryParts.push('Camera -> vectors')
          } else if (['overview', 'text', 'bytes', 'subwords', 'ids'].includes(preset)) {
            set({ cameraPreset: preset as CameraPreset, activeSpace: 'pipeline', activeDiagram: 'pipeline' })
            summaryParts.push(`Camera -> ${preset}`)
          }
          break
        }
        case 'set_timeline_step':
          if (typeof args.step === 'number') {
            get().setTimelineStep(args.step)
          }
          if (typeof args.play === 'boolean') {
            if (args.play && get().timelineStep >= (get().analysis?.merge_steps.length ?? 0)) {
              set({ timelineStep: 0 })
            }
            set({ isPlayingTimeline: args.play })
            summaryParts.push(args.play ? 'Playing merges' : `Step ${args.step ?? get().timelineStep}`)
          }
          break
        case 'open_compare_sheet':
          if (args.open === true) {
            set({ activeSpace: 'arena' })
            void get().runComparison()
            summaryParts.push('Opened Model Arena')
          } else if (args.open === false) {
            set({ isCompareOpen: false })
          }
          break
        case 'open_train_modal':
          if (typeof args.open === 'boolean') {
            set({ isTrainModalOpen: args.open })
            if (args.open) summaryParts.push('Opened Trainer')
          }
          break
      }
    }

    if (summaryParts.length > 0) {
      set({ lastCopilotActionBanner: `Co-Pilot: ${summaryParts.join(' · ')}` })
    }
  },

  undoCopilotSnapshot: (snapshot) => {
    set({
      inputText: snapshot.inputText,
      activeDiagram: snapshot.activeDiagram,
      useRegex: snapshot.useRegex,
      labMode: snapshot.labMode,
      timelineStep: snapshot.timelineStep,
      isPlayingTimeline: false,
      lastCopilotActionBanner: 'Reverted Co-Pilot scene changes',
    })
  },

  sendCopilotPrompt: async (message) => {
    const trimmed = message.trim()
    if (!trimmed) return

    const state = get()
    const snapshot: UndoSnapshot = {
      inputText: state.inputText,
      activeDiagram: state.activeDiagram,
      useRegex: state.useRegex,
      labMode: state.labMode,
      timelineStep: state.timelineStep,
    }

    const userEntry: CopilotChatEntry = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    const history = state.copilotMessages
      .filter((m) => m.id !== 'welcome')
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }))

    const selectedToken = state.inspectorInfo
      ? {
          index: state.selectedTokenIndex ?? undefined,
          token_id: state.inspectorInfo.tokenId,
          text: state.inspectorInfo.text,
          bytes_hex: state.inspectorInfo.bytesHex,
          byte_span: state.inspectorInfo.byteSpan,
          is_special: state.inspectorInfo.kindLabel.toLowerCase().includes('special'),
        }
      : undefined

    const context: WorkspaceContext = {
      mode: state.mode,
      active_diagram: state.activeDiagram,
      input_text: state.inputText,
      use_regex: state.useRegex,
      lab_mode: state.labMode,
      active_tokenizer_id: state.activeTokenizerId,
      timeline_step: state.timelineStep,
      total_merge_steps: state.analysis?.merge_steps.length ?? 0,
      metrics: state.analysis
        ? {
            char_count: state.analysis.metrics.char_count,
            byte_count: state.analysis.metrics.byte_count,
            token_count: state.analysis.metrics.token_count,
            compression_ratio: state.analysis.metrics.compression_ratio,
            fertility: state.analysis.metrics.fertility,
          }
        : undefined,
      selected_token: selectedToken,
      tokens_preview: (state.analysis?.final_tokens ?? []).slice(0, 30).map((t) => ({
        index: t.index,
        token_id: t.token_id,
        text: t.text,
        bytes_hex: t.bytes_hex,
      })),
      guided_chapter:
        state.mode === 'guided'
          ? GUIDED_CHAPTERS[state.guidedChapterIndex]?.title ?? null
          : null,
    }

    set((s) => ({
      copilotMessages: [...s.copilotMessages, userEntry],
      isCopilotThinking: true,
    }))

    try {
      const res = await tokenizerClient.sendCopilotMessage(
        { message: trimmed, history, context },
        state.userApiKey,
      )

      if (res.actions && res.actions.length > 0) {
        get().executeCopilotActions(res.actions)
      }

      const assistantEntry: CopilotChatEntry = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        actions: res.actions,
        followUpChips: res.follow_up_chips,
        mode: res.mode,
        warning: res.warning,
        previousSnapshot: res.actions && res.actions.length > 0 ? snapshot : undefined,
      }

      set((s) => ({
        copilotMessages: [...s.copilotMessages, assistantEntry],
        isCopilotThinking: false,
      }))
    } catch (err) {
      set((s) => ({
        copilotMessages: [
          ...s.copilotMessages,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content:
              err instanceof Error
                ? `Could not reach Co-Pilot: ${err.message}`
                : 'Could not reach Co-Pilot.',
            mode: 'demo',
          },
        ],
        isCopilotThinking: false,
      }))
    }
  },

  setGuidedChapter: (index) => {
    const clamped = Math.max(0, Math.min(index, GUIDED_CHAPTERS.length - 1))
    const chapter = GUIDED_CHAPTERS[clamped]
    if (!chapter) return
    const { cfg } = { cfg: chapter.config }
    get().setActiveSpace(cfg.activeSpace)
    set({
      guidedChapterIndex: clamped,
      activeDiagram: cfg.activeDiagram,
      useRegex: cfg.useRegex,
      inputText: cfg.inputText,
      isPlayingTimeline: false,
      selectedByteSpan: null,
      selectedTokenIndex: null,
      selectedNodeId: null,
      inspectorInfo: null,
      ...(cfg.cameraPreset ? { cameraPreset: cfg.cameraPreset } : {}),
      ...(cfg.treeCameraPreset ? { treeCameraPreset: cfg.treeCameraPreset } : {}),
      ...(cfg.timelineStep !== undefined ? { timelineStep: cfg.timelineStep } : {}),
    })
    get().setLabMode(cfg.labMode)
  },

  nextGuidedChapter: () => {
    const { guidedChapterIndex, setGuidedChapter } = get()
    if (guidedChapterIndex < GUIDED_CHAPTERS.length - 1) {
      setGuidedChapter(guidedChapterIndex + 1)
    }
  },

  prevGuidedChapter: () => {
    const { guidedChapterIndex, setGuidedChapter } = get()
    if (guidedChapterIndex > 0) {
      setGuidedChapter(guidedChapterIndex - 1)
    }
  },

  markChapterComplete: (chapterId) =>
    set((state) =>
      state.completedChapters.includes(chapterId)
        ? state
        : { completedChapters: [...state.completedChapters, chapterId] },
    ),
}))
