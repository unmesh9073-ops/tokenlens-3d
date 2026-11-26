import { Html, Line, QuadraticBezierLine, RoundedBox, Text } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useStudioStore, type SelectedInspectorInfo } from '../../store/useStudioStore'
import type { MergeTreeNode } from '../../types/tokenizer'
import { CameraRig } from './CameraRig'

export const MAX_RENDERED_BYTES = 64
export const MAX_RENDERED_TOKENS = 40

const STAGE_X = {
  text: -8.4,
  bytes: -4.2,
  subwords: 0.0,
  ids: 4.2,
  vectors: 8.8,
} as const

const CATEGORY_COLORS: Record<string, string> = {
  word: '#38bdf8',
  code: '#818cf8',
  number: '#fbbf24',
  punctuation: '#fb7185',
  whitespace: '#94a3b8',
  emoji: '#34d399',
  indic: '#c084fc',
  cjk: '#f472b6',
  special: '#f59e0b',
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

function spansOverlap(a: [number, number] | null, b: [number, number]): boolean {
  if (!a) return false
  return a[0] < b[1] && b[0] < a[1]
}

interface GlassBlockProps {
  position: [number, number, number]
  size: [number, number, number]
  color: string
  label: string
  sublabel?: string
  highlighted: boolean
  dimmed: boolean
  accentRing?: boolean
  reducedMotion: boolean
  phaseOffset: number
  onClick: () => void
  onHoverChange?: (hovered: boolean) => void
}

function GlassBlock({
  position,
  size,
  color,
  label,
  sublabel,
  highlighted,
  dimmed,
  accentRing = false,
  reducedMotion,
  phaseOffset,
  onClick,
  onHoverChange,
}: GlassBlockProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return

    const targetScale = hovered || highlighted ? 1.07 : 1.0
    const alpha = 1 - Math.exp(-12 * delta)
    group.scale.x = THREE.MathUtils.lerp(group.scale.x, targetScale, alpha)
    group.scale.y = THREE.MathUtils.lerp(group.scale.y, targetScale, alpha)
    group.scale.z = THREE.MathUtils.lerp(group.scale.z, targetScale, alpha)

    if (!reducedMotion) {
      const t = state.clock.elapsedTime + phaseOffset
      group.position.y = position[1] + Math.sin(t * 1.1) * 0.025
    } else {
      group.position.y = position[1]
    }
  })

  const opacity = dimmed ? 0.14 : hovered || highlighted ? 0.56 : 0.34
  const emissiveIntensity = dimmed ? 0.04 : hovered || highlighted ? 0.45 : 0.16

  return (
    <group ref={groupRef} position={position}>
      <RoundedBox
        args={size}
        radius={0.07}
        smoothness={3}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
          onHoverChange?.(true)
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
          onHoverChange?.(false)
        }}
      >
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={opacity}
          roughness={0.16}
          metalness={0.08}
          clearcoat={1}
          clearcoatRoughness={0.12}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
        />
      </RoundedBox>

      {(accentRing || highlighted) && (
        <RoundedBox
          args={[size[0] + 0.05, size[1] + 0.05, size[2] + 0.05]}
          radius={0.08}
          smoothness={2}
        >
          <meshBasicMaterial
            color={accentRing ? '#34d399' : '#ffffff'}
            transparent
            opacity={0.38}
            wireframe
          />
        </RoundedBox>
      )}

      <Text
        position={[0, sublabel ? 0.06 : 0, size[2] / 2 + 0.015]}
        fontSize={Math.min(0.18, size[1] * 0.42)}
        maxWidth={size[0] - 0.14}
        color={dimmed ? '#94a3b8' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
      >
        {label.length > 14 ? `${label.slice(0, 12)}…` : label}
      </Text>

      {sublabel && (
        <Text
          position={[0, -0.11, size[2] / 2 + 0.015]}
          fontSize={0.1}
          maxWidth={size[0] - 0.12}
          color={dimmed ? '#64748b' : '#cbd5e1'}
          anchorX="center"
          anchorY="middle"
        >
          {sublabel}
        </Text>
      )}
    </group>
  )
}

function StageHeader({
  x,
  title,
  subtitle,
}: {
  x: number
  title: string
  subtitle: string
}) {
  return (
    <group position={[x, 2.75, 0]}>
      <Text
        position={[0, 0.16, 0]}
        fontSize={0.22}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
      >
        {title}
      </Text>
      <Text
        position={[0, -0.1, 0]}
        fontSize={0.12}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        {subtitle}
      </Text>
    </group>
  )
}

function VectorSpaceStage({
  reducedMotion,
}: {
  reducedMotion: boolean
}) {
  const embeddings = useStudioStore((s) => s.embeddings)
  const selectedByteSpan = useStudioStore((s) => s.selectedByteSpan)
  const analysis = useStudioStore((s) => s.analysis)
  const vectorCompareIndices = useStudioStore((s) => s.vectorCompareIndices)
  const toggleVectorCompareIndex = useStudioStore((s) => s.toggleVectorCompareIndex)
  const setSelection = useStudioStore((s) => s.setSelection)

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const cubeCenter = useMemo(() => new THREE.Vector3(STAGE_X.vectors, 0, 0), [])
  const scale = 1.25

  const points = embeddings?.points ?? []

  const similarityInfo = useMemo(() => {
    if (!embeddings || vectorCompareIndices.length < 2) return null
    const [a, b] = vectorCompareIndices
    const ptA = points.find((p) => p.index === a)
    const ptB = points.find((p) => p.index === b)
    if (!ptA || !ptB) return null

    const pair = embeddings.similarities.find(
      (s) =>
        (s.source_index === a && s.target_index === b) ||
        (s.source_index === b && s.target_index === a),
    )

    const posA: [number, number, number] = [
      cubeCenter.x + ptA.x * scale,
      ptA.y * scale,
      ptA.z * scale,
    ]
    const posB: [number, number, number] = [
      cubeCenter.x + ptB.x * scale,
      ptB.y * scale,
      ptB.z * scale,
    ]
    const mid: [number, number, number] = [
      (posA[0] + posB[0]) / 2,
      (posA[1] + posB[1]) / 2 + 0.18,
      (posA[2] + posB[2]) / 2,
    ]

    return {
      posA,
      posB,
      mid,
      similarity: pair ? pair.similarity : 1.0,
      labelA: ptA.text,
      labelB: ptB.text,
    }
  }, [embeddings, vectorCompareIndices, points, cubeCenter])

  return (
    <group>
      <StageHeader
        x={STAGE_X.vectors}
        title="5. 3D Vectors"
        subtitle={embeddings?.source === 'gemini_live' ? 'Gemini Embedding 2' : 'PCA 3D Space'}
      />

      {/* Translucent 3D Coordinate Wireframe Cube */}
      <mesh position={[STAGE_X.vectors, 0, 0]}>
        <boxGeometry args={[2.9, 2.9, 2.9]} />
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.14} />
      </mesh>

      {/* Semantic Orbs */}
      {points.map((pt) => {
        const tokenMeta = analysis?.final_tokens.find((t) => t.index === pt.index)
        const isLineageHit = tokenMeta
          ? spansOverlap(selectedByteSpan, tokenMeta.byte_span)
          : false
        const isCompareSelected = vectorCompareIndices.includes(pt.index)
        const color = CATEGORY_COLORS[pt.category] ?? '#38bdf8'
        const pos: [number, number, number] = [
          STAGE_X.vectors + pt.x * scale,
          pt.y * scale,
          pt.z * scale,
        ]

        return (
          <group key={`vec-${pt.index}`} position={pos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation()
                toggleVectorCompareIndex(pt.index)
                if (tokenMeta) {
                  const info: SelectedInspectorInfo = {
                    stage: 'vector',
                    text: pt.text,
                    bytesHex: tokenMeta.bytes_hex,
                    tokenId: pt.token_id,
                    byteSpan: tokenMeta.byte_span,
                    kindLabel: `3D Vector (${pt.category})`,
                    explanation: `Coordinates (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}, ${pt.z.toFixed(2)}) projected via PCA. Click two orbs to measure cosine similarity.`,
                  }
                  setSelection({
                    byteSpan: tokenMeta.byte_span,
                    tokenIndex: pt.index,
                    nodeId: tokenMeta.root_node_id,
                    info,
                  })
                }
              }}
              onPointerOver={(e) => {
                e.stopPropagation()
                setHoveredIdx(pt.index)
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                setHoveredIdx(null)
                document.body.style.cursor = 'auto'
              }}
            >
              <sphereGeometry
                args={[isCompareSelected || isLineageHit ? 0.14 : 0.1, 20, 20]}
              />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={
                  isCompareSelected || isLineageHit || hoveredIdx === pt.index
                    ? 0.9
                    : 0.35
                }
                roughness={0.2}
              />
            </mesh>

            {(hoveredIdx === pt.index || isCompareSelected || isLineageHit) && (
              <Html center position={[0, 0.24, 0]} style={{ pointerEvents: 'none' }}>
                <div className="rounded-full border border-white/20 bg-black/75 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-white backdrop-blur-md">
                  {pt.text}
                </div>
              </Html>
            )}
          </group>
        )
      })}

      {/* Cosine Similarity Beam */}
      {similarityInfo && (
        <>
          <Line
            points={[similarityInfo.posA, similarityInfo.posB]}
            color={reducedMotion ? '#38bdf8' : '#7dd3fc'}
            lineWidth={2.2}
            transparent
            opacity={0.85}
          />
          <Html center position={similarityInfo.mid} style={{ pointerEvents: 'none' }}>
            <div className="font-mono-tech rounded-full border border-sky-400/40 bg-slate-950/85 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-sky-200 shadow-lg backdrop-blur-md">
              cos = {similarityInfo.similarity.toFixed(2)}
            </div>
          </Html>
        </>
      )}
    </group>
  )
}

export function PipelineContent() {
  const analysis = useStudioStore((s) => s.analysis)
  const labMode = useStudioStore((s) => s.labMode)
  const useRegex = useStudioStore((s) => s.useRegex)
  const manualNodes = useStudioStore((s) => s.manualNodes)
  const manualTree = useStudioStore((s) => s.manualTree)
  const manualSelectedIndex = useStudioStore((s) => s.manualSelectedIndex)
  const selectedByteSpan = useStudioStore((s) => s.selectedByteSpan)
  const setSelection = useStudioStore((s) => s.setSelection)
  const setManualSelectedIndex = useStudioStore((s) => s.setManualSelectedIndex)
  const performManualMerge = useStudioStore((s) => s.performManualMerge)

  const reducedMotion = usePrefersReducedMotion()

  const visibleChunks = useMemo(
    () => (analysis?.chunks ?? []).slice(0, MAX_RENDERED_TOKENS),
    [analysis],
  )
  const visibleBytes = useMemo(
    () => (analysis?.raw_bytes ?? []).slice(0, MAX_RENDERED_BYTES),
    [analysis],
  )

  const stage3Items = useMemo(() => {
    if (labMode === 'manual' && manualTree) {
      const byId = new Map(manualTree.nodes.map((n) => [n.node_id, n]))
      return manualNodes
        .slice(0, MAX_RENDERED_TOKENS)
        .map((id, index) => {
          const node = byId.get(id)
          if (!node) return null
          return {
            key: node.node_id,
            index,
            tokenId: node.token_id,
            text: node.display_text,
            bytesHex: node.bytes_hex,
            byteSpan: node.byte_span,
            chunkIndex: node.chunk_index,
            isSpecial: node.is_special,
            isLeaf: node.is_leaf,
            node,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    }

    return (analysis?.final_tokens ?? []).slice(0, MAX_RENDERED_TOKENS).map((t) => ({
      key: t.root_node_id,
      index: t.index,
      tokenId: t.token_id,
      text: t.text,
      bytesHex: t.bytes_hex,
      byteSpan: t.byte_span,
      chunkIndex: t.chunk_index,
      isSpecial: t.is_special,
      isLeaf: t.token_id < 256,
      node: null as MergeTreeNode | null,
    }))
  }, [labMode, manualTree, manualNodes, analysis])

  // Compute centered Y layouts for each vertical column
  const chunkPositions = useMemo(() => {
    const gap = 0.62
    const startY = ((visibleChunks.length - 1) * gap) / 2
    return visibleChunks.map((_, i) => [STAGE_X.text, startY - i * gap, 0] as [number, number, number])
  }, [visibleChunks])

  const bytePositions = useMemo(() => {
    const cols = visibleBytes.length > 16 ? 2 : 1
    const rows = Math.ceil(visibleBytes.length / cols)
    const rowGap = 0.42
    const colGap = 1.05
    const startY = ((rows - 1) * rowGap) / 2
    return visibleBytes.map((_, i) => {
      const col = Math.floor(i / rows)
      const row = i % rows
      const xOffset = cols === 2 ? (col === 0 ? -colGap / 2 : colGap / 2) : 0
      return [STAGE_X.bytes + xOffset, startY - row * rowGap, 0] as [number, number, number]
    })
  }, [visibleBytes])

  const subwordPositions = useMemo(() => {
    const gap = 0.64
    const startY = ((stage3Items.length - 1) * gap) / 2
    return stage3Items.map((_, i) => [STAGE_X.subwords, startY - i * gap, 0] as [number, number, number])
  }, [stage3Items])

  const idPositions = useMemo(() => {
    const gap = 0.64
    const startY = ((stage3Items.length - 1) * gap) / 2
    return stage3Items.map((_, i) => [STAGE_X.ids, startY - i * gap, 0] as [number, number, number])
  }, [stage3Items])

  const hasSelection = selectedByteSpan !== null

  const canPairWithManualSelected = (idx: number): boolean => {
    if (labMode !== 'manual' || manualSelectedIndex === null) return false
    if (Math.abs(idx - manualSelectedIndex) !== 1) return false
    const a = stage3Items[manualSelectedIndex]
    const b = stage3Items[idx]
    if (!a || !b || a.isSpecial || b.isSpecial) return false
    if (useRegex && a.chunkIndex !== b.chunkIndex) return false
    return true
  }

  return (
    <group>
      {/* Stage Headers */}
      <StageHeader
        x={STAGE_X.text}
        title="1. Pre-Tokenize"
        subtitle={useRegex ? 'Regex Split ON' : 'Raw Stream (OFF)'}
      />
      <StageHeader x={STAGE_X.bytes} title="2. UTF-8 Bytes" subtitle="Base Vocab 0–255" />
      <StageHeader
        x={STAGE_X.subwords}
        title="3. Subwords"
        subtitle={labMode === 'manual' ? 'Click 2 Adjacent Blocks' : 'Trained BPE Merges'}
      />
      <StageHeader x={STAGE_X.ids} title="4. Token IDs" subtitle="Integer Inputs" />

      {/* Stage 1: Chunks */}
      {visibleChunks.map((chunk, i) => {
        const span: [number, number] = [chunk.byte_start, chunk.byte_end]
        const hit = spansOverlap(selectedByteSpan, span)
        return (
          <GlassBlock
            key={`chunk-${chunk.chunk_index}`}
            position={chunkPositions[i]}
            size={[1.65, 0.48, 0.34]}
            color={chunk.is_special ? '#f59e0b' : '#38bdf8'}
            label={chunk.text.replace(/ /g, '␣')}
            sublabel={chunk.is_special ? 'Special Token' : `Chunk #${chunk.chunk_index}`}
            highlighted={hit}
            dimmed={hasSelection && !hit}
            reducedMotion={reducedMotion}
            phaseOffset={i * 0.4}
            onClick={() =>
              setSelection({
                byteSpan: span,
                info: {
                  stage: 'chunk',
                  text: chunk.text,
                  bytesHex: `${chunk.byte_end - chunk.byte_start} bytes`,
                  byteSpan: span,
                  kindLabel: chunk.is_special ? 'Special Control Token' : 'Pre-Tokenized Chunk',
                  explanation: chunk.is_special
                    ? 'Special tokens are matched intact before regex splitting and never merge with neighbors.'
                    : useRegex
                      ? 'Regex pre-tokenization isolates words, spaces, and punctuation so merges cannot cross boundaries.'
                      : 'Regex splitting is OFF, so the entire text flows as a single chunk.',
                },
              })
            }
          />
        )
      })}

      {/* Stage 2: UTF-8 Bytes */}
      {visibleBytes.map((b, i) => {
        const span: [number, number] = [b.byte_index, b.byte_index + 1]
        const hit = spansOverlap(selectedByteSpan, span)
        return (
          <GlassBlock
            key={`byte-${b.byte_index}`}
            position={bytePositions[i]}
            size={[0.92, 0.34, 0.28]}
            color="#60a5fa"
            label={b.char_preview}
            sublabel={b.hex}
            highlighted={hit}
            dimmed={hasSelection && !hit}
            reducedMotion={reducedMotion}
            phaseOffset={i * 0.2}
            onClick={() =>
              setSelection({
                byteSpan: span,
                info: {
                  stage: 'byte',
                  text: b.char_preview,
                  bytesHex: b.hex,
                  tokenId: b.value,
                  byteSpan: span,
                  kindLabel: 'Raw UTF-8 Byte',
                  explanation: `Byte #${b.byte_index} has decimal value ${b.value} (${b.hex}). Every UTF-8 character is 1–4 bytes, so BPE never needs an [UNK] token.`,
                },
              })
            }
          />
        )
      })}

      {/* Stage 3: Subwords (Auto & Manual) */}
      {stage3Items.map((item, i) => {
        const hit = spansOverlap(selectedByteSpan, item.byteSpan)
        const isManualFirst = labMode === 'manual' && manualSelectedIndex === i
        const isValidNeighbor = canPairWithManualSelected(i)
        const width = Math.min(2.1, 1.15 + (item.byteSpan[1] - item.byteSpan[0]) * 0.08)

        return (
          <GlassBlock
            key={`sub-${item.key}`}
            position={subwordPositions[i]}
            size={[width, 0.48, 0.38]}
            color={
              item.isSpecial
                ? '#f59e0b'
                : isValidNeighbor
                  ? '#34d399'
                  : item.isLeaf
                    ? '#818cf8'
                    : '#c084fc'
            }
            label={item.text}
            sublabel={
              item.isSpecial
                ? 'Special'
                : `${item.byteSpan[1] - item.byteSpan[0]}B · #${item.tokenId}`
            }
            highlighted={hit || isManualFirst}
            dimmed={hasSelection && !hit && !isManualFirst && !isValidNeighbor}
            accentRing={isValidNeighbor || isManualFirst}
            reducedMotion={reducedMotion}
            phaseOffset={i * 0.35}
            onClick={() => {
              if (labMode === 'manual') {
                if (manualSelectedIndex === null) {
                  setManualSelectedIndex(i)
                } else if (manualSelectedIndex === i) {
                  setManualSelectedIndex(null)
                } else if (canPairWithManualSelected(i)) {
                  const first = stage3Items[manualSelectedIndex]
                  const left = manualSelectedIndex < i ? first : item
                  const right = manualSelectedIndex < i ? item : first
                  void performManualMerge(left.tokenId, right.tokenId)
                } else {
                  setManualSelectedIndex(i)
                }
              }

              setSelection({
                byteSpan: item.byteSpan,
                tokenIndex: item.index,
                nodeId: item.key,
                info: {
                  stage: 'subword',
                  text: item.text,
                  bytesHex: item.bytesHex,
                  tokenId: item.tokenId,
                  byteSpan: item.byteSpan,
                  kindLabel: item.isSpecial
                    ? 'Special Token'
                    : item.isLeaf
                      ? 'Unmerged Byte Leaf'
                      : 'Merged Subword Token',
                  explanation:
                    labMode === 'manual'
                      ? 'Click an adjacent highlighted green block to merge this pair into a new token.'
                      : item.isLeaf
                        ? 'This byte did not match a learned BPE merge rule, so it stays as a single-byte token.'
                        : `Merged from UTF-8 bytes [${item.byteSpan[0]}..${item.byteSpan[1]}) into token ID #${item.tokenId}.`,
                },
              })
            }}
          />
        )
      })}

      {/* Stage 4: Token IDs */}
      {stage3Items.map((item, i) => {
        const hit = spansOverlap(selectedByteSpan, item.byteSpan)
        return (
          <GlassBlock
            key={`id-${item.key}`}
            position={idPositions[i]}
            size={[1.25, 0.46, 0.36]}
            color={item.isSpecial ? '#f59e0b' : '#34d399'}
            label={`#${item.tokenId}`}
            sublabel={item.text}
            highlighted={hit}
            dimmed={hasSelection && !hit}
            reducedMotion={reducedMotion}
            phaseOffset={i * 0.3}
            onClick={() =>
              setSelection({
                byteSpan: item.byteSpan,
                tokenIndex: item.index,
                nodeId: item.key,
                info: {
                  stage: 'id',
                  text: item.text,
                  bytesHex: item.bytesHex,
                  tokenId: item.tokenId,
                  byteSpan: item.byteSpan,
                  kindLabel: 'Vocabulary Token ID',
                  explanation: `LLMs never see letters directly—they look up row #${item.tokenId} in their embedding matrix.`,
                },
              })
            }
          />
        )
      })}

      {/* Connecting Ribbons: Bytes -> Subwords */}
      {visibleBytes.map((b, bIdx) => {
        const span: [number, number] = [b.byte_index, b.byte_index + 1]
        const parentIdx = stage3Items.findIndex(
          (s) => b.byte_index >= s.byteSpan[0] && b.byte_index < s.byteSpan[1],
        )
        if (parentIdx === -1) return null
        const start = bytePositions[bIdx]
        const end = subwordPositions[parentIdx]
        const hit = spansOverlap(selectedByteSpan, span)
        const mid: [number, number, number] = [
          (start[0] + end[0]) / 2,
          (start[1] + end[1]) / 2 + 0.15,
          0.18,
        ]
        return (
          <QuadraticBezierLine
            key={`rib-bs-${b.byte_index}`}
            start={[start[0] + 0.46, start[1], start[2]]}
            end={[end[0] - 0.6, end[1], end[2]]}
            mid={mid}
            color={hit ? '#38bdf8' : '#334155'}
            lineWidth={hit ? 2.2 : 1}
            transparent
            opacity={hasSelection ? (hit ? 0.95 : 0.12) : 0.4}
          />
        )
      })}

      {/* Connecting Filaments: Subwords -> Token IDs */}
      {stage3Items.map((item, idx) => {
        const start = subwordPositions[idx]
        const end = idPositions[idx]
        const hit = spansOverlap(selectedByteSpan, item.byteSpan)
        return (
          <Line
            key={`rib-si-${item.key}`}
            points={[
              [start[0] + 0.62, start[1], start[2]],
              [end[0] - 0.62, end[1], end[2]],
            ]}
            color={hit ? '#34d399' : '#334155'}
            lineWidth={hit ? 2.2 : 1}
            transparent
            opacity={hasSelection ? (hit ? 0.95 : 0.12) : 0.42}
          />
        )
      })}

      {/* Stage 5: 3D Vector Space */}
      <VectorSpaceStage reducedMotion={reducedMotion} />
    </group>
  )
}

export function PipelineScene3D() {
  const clearSelection = useStudioStore((s) => s.clearSelection)

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0.2, 2.2, 16.5], fov: 44 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => clearSelection()}
      >
        <color attach="background" args={['#06070B']} />
        <fog attach="fog" args={['#06070B', 18, 36]} />

        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 8, 8]} intensity={1.7} color="#e0f2fe" />
        <directionalLight position={[-6, -4, 4]} intensity={0.85} color="#818cf8" />
        <pointLight position={[0, 3, 6]} intensity={1.3} color="#38bdf8" distance={22} />

        <gridHelper args={[28, 28, '#1e293b', '#0f172a']} position={[0, -2.6, 0]} />

        <PipelineContent />
        <CameraRig />
      </Canvas>
    </div>
  )
}
