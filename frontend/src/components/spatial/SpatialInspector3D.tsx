import { Html } from '@react-three/drei'
import { Sparkles, X } from 'lucide-react'
import { useMemo } from 'react'
import { useStudioStore } from '../../store/useStudioStore'
import { playSelectClick } from '../../utils/spatialAudio'

function getBadgeLabel(kindLabel: string, tokenId?: number): string {
  const lower = kindLabel.toLowerCase()
  if (lower.includes('special')) return 'Special Token'
  if (lower.includes('byte') || (tokenId !== undefined && tokenId < 256)) return 'Raw Byte'
  return 'Merged Subword'
}

export function SpatialInspector3D() {
  const activeSpace = useStudioStore((s) => s.activeSpace)
  const inspectorInfo = useStudioStore((s) => s.inspectorInfo)
  const selectedWorldPosition = useStudioStore((s) => s.selectedWorldPosition)
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId)
  const analysis = useStudioStore((s) => s.analysis)
  const clearSelection = useStudioStore((s) => s.clearSelection)
  const setSelection = useStudioStore((s) => s.setSelection)
  const setCopilotOpen = useStudioStore((s) => s.setCopilotOpen)
  const sendCopilotPrompt = useStudioStore((s) => s.sendCopilotPrompt)

  const treeChildren = useMemo(() => {
    if (activeSpace !== 'tree' || !selectedNodeId || !analysis?.merge_tree) return null
    const nodes = analysis.merge_tree.nodes
    const current = nodes.find((n) => n.node_id === selectedNodeId)
    if (!current || (!current.left_child_id && !current.right_child_id)) return null
    const left = current.left_child_id
      ? nodes.find((n) => n.node_id === current.left_child_id) ?? null
      : null
    const right = current.right_child_id
      ? nodes.find((n) => n.node_id === current.right_child_id) ?? null
      : null
    return { left, right }
  }, [activeSpace, selectedNodeId, analysis])

  if (!inspectorInfo || activeSpace === 'hub') return null

  const anchorPos: [number, number, number] = selectedWorldPosition
    ? [selectedWorldPosition[0], selectedWorldPosition[1] + 0.85, selectedWorldPosition[2]]
    : [0, 2.2, 0]

  const badge = getBadgeLabel(inspectorInfo.kindLabel, inspectorInfo.tokenId)

  const handleSelectChild = (childId: string, label: string, tokenId: number, bytesHex: string, span: [number, number]) => {
    playSelectClick()
    setSelection({
      byteSpan: span,
      nodeId: childId,
      worldPosition: anchorPos,
      info: {
        stage: 'subword',
        text: label,
        bytesHex,
        tokenId,
        byteSpan: span,
        kindLabel: tokenId < 256 ? 'Raw Byte' : 'Merged Subword',
        explanation: `Child node "${label}" (#${tokenId}) in the BPE merge tree.`,
      },
    })
  }

  const handleAskGemini = () => {
    playSelectClick()
    setCopilotOpen(true)
    const idPart = inspectorInfo.tokenId !== undefined ? `token #${inspectorInfo.tokenId}` : 'this token'
    void sendCopilotPrompt(`Why is '${inspectorInfo.text || ' '}' ${idPart}?`)
  }

  return (
    <Html
      position={anchorPos}
      center
      distanceFactor={10}
      style={{ pointerEvents: 'none' }}
    >
      <div className="pointer-events-none w-64 select-none rounded-2xl border border-white/20 border-t-white/35 bg-slate-950/80 p-3 text-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-sky-400/30">
              {badge}
            </span>
            {inspectorInfo.tokenId !== undefined && (
              <span className="font-mono text-[11px] font-semibold text-amber-300">
                #{inspectorInfo.tokenId}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              playSelectClick()
              clearSelection()
            }}
            aria-label="Close inspector"
            className="pointer-events-auto flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-2">
          <div className="truncate font-mono text-sm font-semibold text-white">
            “{inspectorInfo.text || '␣'}”
          </div>
          <div className="shrink-0 font-mono text-[10px] text-slate-400">
            [{inspectorInfo.byteSpan[0]}..{inspectorInfo.byteSpan[1]})
          </div>
        </div>

        {inspectorInfo.bytesHex && (
          <div className="mt-1.5 truncate rounded-lg bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-300">
            {inspectorInfo.bytesHex}
          </div>
        )}

        {treeChildren && (treeChildren.left || treeChildren.right) && (
          <div className="mt-2.5 flex items-center gap-1.5">
            {treeChildren.left && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const l = treeChildren.left!
                  handleSelectChild(l.node_id, l.display_text, l.token_id, l.bytes_hex, l.byte_span)
                }}
                className="pointer-events-auto flex-1 truncate rounded-lg border border-white/12 bg-white/8 px-2 py-1 text-[10px] font-medium text-slate-200 transition-colors hover:bg-white/15"
              >
                L: “{treeChildren.left.display_text}”
              </button>
            )}
            {treeChildren.right && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const r = treeChildren.right!
                  handleSelectChild(r.node_id, r.display_text, r.token_id, r.bytes_hex, r.byte_span)
                }}
                className="pointer-events-auto flex-1 truncate rounded-lg border border-white/12 bg-white/8 px-2 py-1 text-[10px] font-medium text-slate-200 transition-colors hover:bg-white/15"
              >
                R: “{treeChildren.right.display_text}”
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleAskGemini()
          }}
          className="pointer-events-auto mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-200 transition-colors hover:bg-emerald-400/25"
        >
          <Sparkles className="h-3 w-3" />
          <span>Ask Gemini</span>
        </button>
      </div>
    </Html>
  )
}
