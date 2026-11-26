import { AnimatePresence, motion } from 'framer-motion'
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useStudioStore, type HealthStatus } from '../store/useStudioStore'
import type { CopilotAction } from '../types/tokenizer'

interface CopilotPanelProps {
  isOpen: boolean
  onClose: () => void
  health: HealthStatus | null
}

function formatActionLabel(action: CopilotAction): string {
  const args = action.args ?? {}
  switch (action.name) {
    case 'set_input_text':
      return `Text -> "${String(args.text ?? '').slice(0, 18)}${String(args.text ?? '').length > 18 ? '…' : ''}"`
    case 'switch_diagram':
      return `Diagram -> ${args.diagram === 'tree' ? '3D Merge Tree' : '3D Pipeline'}`
    case 'set_use_regex':
      return `Regex -> ${args.enabled ? 'ON' : 'OFF'}`
    case 'set_lab_mode':
      return `Lab -> ${args.mode === 'manual' ? 'Manual Merge' : 'Auto BPE'}`
    case 'highlight_token':
      return args.token_index !== undefined
        ? `Highlight #${args.token_index}`
        : `Highlight ${args.node_id}`
    case 'focus_camera':
      return `Camera -> ${String(args.preset ?? '')}`
    case 'set_timeline_step':
      return args.play ? 'Play Merges' : `Step ${args.step ?? 0}`
    case 'open_compare_sheet':
      return args.open ? 'Open Compare' : 'Close Compare'
    case 'open_train_modal':
      return args.open ? 'Open Trainer' : 'Close Trainer'
    default:
      return action.name
  }
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Split on `code` and **bold**
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return tokens.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="font-mono-tech rounded bg-white/[0.1] px-1.5 py-0.5 text-[11px] text-sky-200"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={idx}>{part}</Fragment>
  })
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1.5">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={idx} className="h-1" />
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
              <span>{renderInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          )
        }
        return <p key={idx}>{renderInlineMarkdown(line)}</p>
      })}
    </div>
  )
}

export function CopilotPanel({ isOpen, onClose, health }: CopilotPanelProps) {
  const activeDiagram = useStudioStore((s) => s.activeDiagram)
  const analysis = useStudioStore((s) => s.analysis)
  const timelineStep = useStudioStore((s) => s.timelineStep)
  const inspectorInfo = useStudioStore((s) => s.inspectorInfo)
  const copilotMessages = useStudioStore((s) => s.copilotMessages)
  const isCopilotThinking = useStudioStore((s) => s.isCopilotThinking)
  const userApiKey = useStudioStore((s) => s.userApiKey)

  const setUserApiKey = useStudioStore((s) => s.setUserApiKey)
  const clearCopilotChat = useStudioStore((s) => s.clearCopilotChat)
  const sendCopilotPrompt = useStudioStore((s) => s.sendCopilotPrompt)
  const executeCopilotActions = useStudioStore((s) => s.executeCopilotActions)
  const undoCopilotSnapshot = useStudioStore((s) => s.undoCopilotSnapshot)

  const [draft, setDraft] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [keyInput, setKeyInput] = useState(userApiKey)
  const [showKey, setShowKey] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isLiveApi = Boolean(userApiKey.trim() || health?.gemini_configured)

  // Auto-scroll to newest messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [copilotMessages, isCopilotThinking])

  // Escape closes settings popover
  useEffect(() => {
    if (!isSettingsOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSettingsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSettingsOpen])

  const contextSummary = useMemo(() => {
    const viewLabel = activeDiagram === 'pipeline' ? '3D Pipeline' : '3D Merge Tree'
    const tokCount = analysis?.metrics.token_count ?? 0
    const parts = [viewLabel]
    if (activeDiagram === 'tree') {
      parts.push(`Step ${timelineStep}/${analysis?.merge_steps.length ?? 0}`)
    } else {
      parts.push(`${tokCount} tokens`)
    }
    if (inspectorInfo?.tokenId !== undefined) {
      parts.push(`Selected #${inspectorInfo.tokenId}`)
    } else if (inspectorInfo?.text) {
      parts.push(`Selected "${inspectorInfo.text}"`)
    }
    return `Reading: ${parts.join(' · ')}`
  }, [activeDiagram, analysis, timelineStep, inspectorInfo])

  const starterChips = useMemo(() => {
    const chips: string[] = []
    if (inspectorInfo?.tokenId !== undefined) {
      chips.push(`Why is "${inspectorInfo.text}" token #${inspectorInfo.tokenId}?`)
    }
    if (activeDiagram === 'pipeline') {
      chips.push('Walk me through these 5 stages')
      chips.push('Show why emojis cost extra tokens')
      chips.push('Compare with GPT-4o')
    } else {
      chips.push('Animate how BPE merged this')
      chips.push('Show what happens with Regex OFF')
      chips.push('Let me merge bytes manually')
    }
    return chips.slice(0, 3)
  }, [activeDiagram, inspectorInfo])

  const handleSend = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isCopilotThinking) return
    setDraft('')
    void sendCopilotPrompt(trimmed)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="copilot-panel"
          initial={{ x: 32, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 32, opacity: 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.36 }}
          aria-label="Ask Gemini Co-Pilot"
          className="glass-panel-heavy pointer-events-auto flex h-[calc(100vh-12rem)] w-[348px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl"
        >
          {/* Chrome-style Header */}
          <div className="flex items-center justify-between border-b border-white/[0.1] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold tracking-tight text-white">
                  Ask Gemini
                </span>
                <span className="font-mono-tech text-[10px] text-white/50">
                  {health?.chat_model ?? 'gemini-4-hydrogen'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setKeyInput(userApiKey)
                  setIsSettingsOpen((v) => !v)
                }}
                title="Configure Gemini API Key"
                className={`pressable flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide ${
                  isLiveApi
                    ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30'
                    : 'bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30'
                }`}
              >
                <KeyRound className="h-2.5 w-2.5" />
                {isLiveApi ? 'Live API' : 'Demo Mode'}
              </button>

              <button
                type="button"
                onClick={clearCopilotChat}
                title="New Chat"
                aria-label="New Chat"
                className="pressable flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.08] hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Ask Gemini panel"
                className="pressable flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Chrome-Style Active Context Pill */}
          <div className="border-b border-white/[0.07] bg-white/[0.02] px-4 py-1.5">
            <div className="font-mono-tech truncate text-[10px] text-sky-200/80">
              {contextSummary}
            </div>
          </div>

          {/* Inline API Key Settings Drawer */}
          <AnimatePresence>
            {isSettingsOpen && (
              <motion.div
                key="api-key-drawer"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
                className="border-b border-white/[0.1] bg-slate-950/60 p-3.5 text-[11px]"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-semibold text-white">Gemini API Key (Session Only)</span>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="text-white/50 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mb-2 leading-relaxed text-white/60">
                  No key needed—Demo Mode works fully offline. Paste a Gemini API key to unlock live Gemini responses &amp; live 3D embeddings.
                </p>
                <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.05] px-2.5 py-1.5">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="AIza..."
                    className="font-mono-tech w-full bg-transparent text-[11px] text-white placeholder:text-white/35 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                    className="text-white/50 hover:text-white"
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-end gap-1.5">
                  {userApiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setKeyInput('')
                        setUserApiKey('')
                        setIsSettingsOpen(false)
                      }}
                      className="pressable flex items-center gap-1 rounded-full bg-rose-400/15 px-2.5 py-1 text-[10px] font-medium text-rose-200 ring-1 ring-rose-400/30"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setUserApiKey(keyInput)
                      setIsSettingsOpen(false)
                    }}
                    className="pressable rounded-full bg-sky-400/20 px-3 py-1 text-[10px] font-semibold text-sky-200 ring-1 ring-sky-400/40"
                  >
                    Save Key
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-3.5 text-[13px] leading-relaxed"
          >
            {copilotMessages.map((msg, index) => {
              const isLatestAssistant =
                msg.role === 'assistant' && index === copilotMessages.length - 1
              return (
                <div key={msg.id} className="space-y-2">
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 ${
                      msg.role === 'user'
                        ? 'ml-6 bg-sky-500/20 text-white ring-1 ring-sky-400/25'
                        : 'mr-1 bg-white/[0.05] text-white/85 ring-1 ring-white/[0.08]'
                    }`}
                  >
                    {msg.warning && (
                      <div className="mb-1.5 rounded-lg bg-amber-400/15 px-2 py-1 text-[10px] text-amber-200 ring-1 ring-amber-400/25">
                        {msg.warning}
                      </div>
                    )}

                    <MarkdownMessage content={msg.content} />

                    {/* Executed Action Pills + Undo / Replay */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-2.5 border-t border-white/[0.08] pt-2">
                        <div className="flex flex-wrap gap-1">
                          {msg.actions.map((act, aIdx) => (
                            <span
                              key={`${msg.id}-act-${aIdx}`}
                              className="font-mono-tech rounded-full bg-sky-400/12 px-2 py-0.5 text-[10px] text-sky-200 ring-1 ring-sky-400/25"
                            >
                              {formatActionLabel(act)}
                            </span>
                          ))}
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          {msg.previousSnapshot && (
                            <button
                              type="button"
                              onClick={() => undoCopilotSnapshot(msg.previousSnapshot!)}
                              className="pressable flex items-center gap-1 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-white/75 hover:bg-white/[0.14] hover:text-white"
                            >
                              <Undo2 className="h-2.5 w-2.5" />
                              Undo
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => executeCopilotActions(msg.actions!)}
                            className="pressable flex items-center gap-1 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-white/75 hover:bg-white/[0.14] hover:text-white"
                          >
                            <Play className="h-2.5 w-2.5" />
                            Replay
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Follow-up Chips under latest assistant message */}
                  {isLatestAssistant && msg.followUpChips && msg.followUpChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {msg.followUpChips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => handleSend(chip)}
                          className="pressable rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/80 hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-white"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {isCopilotThinking && (
              <div className="mr-4 flex items-center gap-2 rounded-2xl bg-white/[0.05] px-3.5 py-2.5 text-[12px] text-white/70 ring-1 ring-white/[0.08]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                Inspecting 3D workspace...
              </div>
            )}

            {/* Dynamic Starter Chips on fresh chat */}
            {copilotMessages.length <= 1 && !isCopilotThinking && (
              <div className="pt-1">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/45">
                  Try asking
                </p>
                <div className="flex flex-col gap-1.5">
                  {starterChips.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSend(q)}
                      className="pressable rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-left text-[12px] text-white/80 hover:border-white/[0.2] hover:bg-white/[0.09] hover:text-white"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend(draft)
            }}
            className="border-t border-white/[0.1] p-3"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 focus-within:border-sky-400/50">
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend(draft)
                  }
                }}
                placeholder="Ask about tokens, bytes, or merges..."
                className="max-h-24 w-full resize-none bg-transparent py-1 text-[13px] text-white placeholder:text-white/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isCopilotThinking || !draft.trim()}
                aria-label="Send message"
                className="pressable mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-400/20 text-sky-300 hover:bg-sky-400/30 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
