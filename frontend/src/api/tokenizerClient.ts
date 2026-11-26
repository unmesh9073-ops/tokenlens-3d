import type {
  AnalyzeRequest,
  AnalyzeResponse,
  CompareRequest,
  CompareResponse,
  CopilotChatRequest,
  CopilotChatResponse,
  EmbeddingsProjectRequest,
  EmbeddingsProjectResponse,
  ManualMergeRequest,
  ManualMergeResponse,
  TrainRequest,
  TrainResponse,
} from '../types/tokenizer'

async function postJson<TReq, TRes>(
  url: string,
  body: TReq,
  signal?: AbortSignal,
  apiKey?: string,
): Promise<TRes> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey && apiKey.trim()) {
    headers['X-Gemini-Api-Key'] = apiKey.trim()
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const errBody = (await res.json()) as { detail?: string }
      if (errBody?.detail) detail = errBody.detail
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(detail)
  }
  return (await res.json()) as TRes
}

export const tokenizerClient = {
  analyze: (req: AnalyzeRequest, signal?: AbortSignal) =>
    postJson<AnalyzeRequest, AnalyzeResponse>('/api/bpe/analyze', req, signal),

  train: (req: TrainRequest, signal?: AbortSignal) =>
    postJson<TrainRequest, TrainResponse>('/api/bpe/train', req, signal),

  manualMerge: (req: ManualMergeRequest, signal?: AbortSignal) =>
    postJson<ManualMergeRequest, ManualMergeResponse>('/api/bpe/manual-merge', req, signal),

  compare: (req: CompareRequest, signal?: AbortSignal) =>
    postJson<CompareRequest, CompareResponse>('/api/compare', req, signal),

  projectEmbeddings: (req: EmbeddingsProjectRequest, signal?: AbortSignal, apiKey?: string) =>
    postJson<EmbeddingsProjectRequest, EmbeddingsProjectResponse>(
      '/api/embeddings/project',
      req,
      signal,
      apiKey,
    ),

  sendCopilotMessage: (req: CopilotChatRequest, apiKey?: string, signal?: AbortSignal) =>
    postJson<CopilotChatRequest, CopilotChatResponse>(
      '/api/copilot/chat',
      req,
      signal,
      apiKey,
    ),
}
