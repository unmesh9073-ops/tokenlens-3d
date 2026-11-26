export interface ChunkItem {
  chunk_index: number
  text: string
  is_special: boolean
  byte_start: number
  byte_end: number
}

export interface RawByteItem {
  byte_index: number
  value: number
  hex: string
  char_preview: string
  chunk_index: number
}

export interface PairFrequencyItem {
  pair: [number, number]
  left_text: string
  right_text: string
  count: number
}

export interface MergeStepItem {
  step_index: number
  rule_rank: number
  pair: [number, number]
  new_id: number
  merged_text: string
  merged_hex: string
  occurrences: number
  top_pair_frequencies: PairFrequencyItem[]
  active_node_ids: string[]
}

export interface MergeTreeNode {
  node_id: string
  token_id: int_or_number
  display_text: string
  bytes_hex: string
  left_child_id: string | null
  right_child_id: string | null
  depth: number
  merge_step: number | null
  byte_span: [number, number]
  chunk_index: number
  is_leaf: boolean
  is_special: boolean
}

type int_or_number = number

export interface MergeTree {
  nodes: MergeTreeNode[]
  root_node_ids: string[]
}

export interface FinalTokenItem {
  index: number
  token_id: number
  root_node_id: string
  text: string
  bytes_hex: string
  byte_span: [number, number]
  chunk_index: number
  is_special: boolean
}

export interface TokenizerMetrics {
  char_count: number
  byte_count: number
  word_count: number
  token_count: number
  compression_ratio: number
  fertility: number
}

export interface AnalyzeRequest {
  text: string
  tokenizer_id?: string | null
  use_regex?: boolean
  max_merges?: number | null
}

export interface AnalyzeResponse {
  tokenizer_id: string
  use_regex: boolean
  chunks: ChunkItem[]
  raw_bytes: RawByteItem[]
  merge_steps: MergeStepItem[]
  merge_tree: MergeTree
  final_tokens: FinalTokenItem[]
  decoded_text: string
  is_lossless: boolean
  metrics: TokenizerMetrics
}

export interface TrainRequest {
  corpus: string
  num_merges?: number
  use_regex?: boolean
  name?: string | null
}

export interface TrainMergeRecord {
  step: number
  pair: [number, number]
  new_id: number
  count: number
  merged_text: string
  merged_hex: string
  top_candidates: PairFrequencyItem[]
  compression_ratio: float_or_number
}

type float_or_number = number

export interface TrainResponse {
  tokenizer_id: string
  name: string
  vocab_size: number
  use_regex: boolean
  merges_learned: number
  merge_history: TrainMergeRecord[]
}

export interface ManualMergeRequest {
  tokenizer_id?: string | null
  nodes: MergeTreeNode[]
  sequence_node_ids: string[]
  left_token_id: number
  right_token_id: number
  use_regex?: boolean
}

export interface ManualMergeResponse {
  sequence_node_ids: string[]
  merge_tree: MergeTree
  pair_frequencies: PairFrequencyItem[]
  merges_applied: number
  new_token_id: number
}

export interface CompareRequest {
  text: string
  tokenizer_id?: string | null
  use_regex?: boolean
}

export interface CompareTokenItem {
  token_id: number
  text: string
  bytes_hex: string
}

export interface CompareModelResult {
  model_id: string
  display_name: string
  vocab_size: number
  tokens: CompareTokenItem[]
  token_count: number
  fertility: number
  bytes_per_token: number
  compression_ratio: number
  encode_time_us: number
  is_fallback: boolean
}

export interface CompareResponse {
  text: string
  byte_count: number
  models: CompareModelResult[]
}

export interface EmbeddingTokenInput {
  index?: number | null
  token_id?: number
  text: string
}

export interface EmbeddingsProjectRequest {
  tokens: EmbeddingTokenInput[]
}

export interface EmbeddingPoint3D {
  index: number
  token_id: number
  text: string
  x: number
  y: number
  z: number
  category: string
}

export interface EmbeddingSimilarity {
  source_index: number
  target_index: number
  similarity: number
}

export interface EmbeddingsProjectResponse {
  source: 'gemini_live' | 'local_fallback'
  model: string
  points: EmbeddingPoint3D[]
  similarities: EmbeddingSimilarity[]
}

export type CopilotActionName =
  | 'set_input_text'
  | 'switch_diagram'
  | 'set_use_regex'
  | 'set_lab_mode'
  | 'highlight_token'
  | 'focus_camera'
  | 'set_timeline_step'
  | 'open_compare_sheet'
  | 'open_train_modal'

export interface CopilotAction {
  name: CopilotActionName
  args: Record<string, unknown>
}

export interface CopilotMessagePayload {
  role: 'user' | 'assistant'
  content: string
}

export interface WorkspaceContext {
  mode: 'playground' | 'guided'
  active_diagram: 'pipeline' | 'tree'
  input_text: string
  use_regex: boolean
  lab_mode: 'auto' | 'manual'
  active_tokenizer_id: string
  timeline_step: number
  total_merge_steps: number
  metrics?: {
    char_count: number
    byte_count: number
    token_count: number
    compression_ratio: number
    fertility: number
  }
  selected_token?: {
    index?: number
    token_id?: number
    text: string
    bytes_hex: string
    byte_span?: [number, number]
    is_special: boolean
    depth?: number
  }
  tokens_preview: Array<{
    index: number
    token_id: number
    text: string
    bytes_hex: string
  }>
  guided_chapter?: string | null
}

export interface CopilotChatRequest {
  message: string
  history: CopilotMessagePayload[]
  context: WorkspaceContext
}

export interface CopilotChatResponse {
  reply: string
  mode: 'live' | 'demo'
  model: string
  actions: CopilotAction[]
  follow_up_chips: string[]
  warning?: string | null
}
