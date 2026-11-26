import { Html, RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useStudioStore } from '../../store/useStudioStore'
import type { CompareTokenItem } from '../../types/tokenizer'
import { playHoverTick, playSelectClick } from '../../utils/spatialAudio'

const MODEL_COLORS = ['#38bdf8', '#34d399', '#a78bfa', '#fbbf24']
const MAX_VISIBLE_SLICES = 36

interface TowerSliceProps {
  token: CompareTokenItem
  color: string
  baseY: number
  sliceHeight: number
  intensity: number
  onHoverStart: (token: CompareTokenItem, worldPos: [number, number, number]) => void
  onHoverEnd: () => void
  onSelect: (token: CompareTokenItem, worldPos: [number, number, number]) => void
  towerX: number
}

function TowerSlice({
  token,
  color,
  baseY,
  sliceHeight,
  intensity,
  onHoverStart,
  onHoverEnd,
  onSelect,
  towerX,
}: TowerSliceProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const targetZ = hovered ? 0.24 : 0
    const targetScale = hovered ? 1.05 : 1
    meshRef.current.position.z = THREE.MathUtils.lerp(
      meshRef.current.position.z,
      targetZ,
      Math.min(1, delta * 14),
    )
    const s = THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, Math.min(1, delta * 14))
    meshRef.current.scale.set(s, s, s)
  })

  return (
    <RoundedBox
      ref={meshRef}
      args={[1.38, Math.max(0.08, sliceHeight - 0.03), 0.78]}
      radius={0.04}
      smoothness={3}
      position={[0, baseY, 0]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        playHoverTick()
        onHoverStart(token, [towerX, baseY - 0.5, 0.55])
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        onHoverEnd()
      }}
      onClick={(e) => {
        e.stopPropagation()
        playSelectClick()
        onSelect(token, [towerX, baseY - 0.5, 0.3])
      }}
    >
      <meshPhysicalMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered ? 0.85 : intensity}
        roughness={0.14}
        metalness={0.12}
        transparent
        opacity={hovered ? 0.96 : 0.78}
      />
    </RoundedBox>
  )
}

export function ModelArena3D() {
  const comparison = useStudioStore((s) => s.comparison)
  const inputText = useStudioStore((s) => s.inputText)
  const runComparison = useStudioStore((s) => s.runComparison)
  const setSelection = useStudioStore((s) => s.setSelection)

  const [hoveredSlice, setHoveredSlice] = useState<{
    token: CompareTokenItem
    modelName: string
    position: [number, number, number]
  } | null>(null)

  useEffect(() => {
    void runComparison()
  }, [inputText, runComparison])

  const models = comparison?.models ?? []
  const maxSlices = Math.max(1, ...models.map((m) => Math.min(m.tokens.length, MAX_VISIBLE_SLICES)))

  return (
    <group position={[0, -0.5, 0]}>
      {models.map((model, idx) => {
        const x = (idx - (models.length - 1) / 2) * 2.65
        const color = MODEL_COLORS[idx % MODEL_COLORS.length]
        const visibleTokens = model.tokens.slice(0, MAX_VISIBLE_SLICES)
        const overflowCount = Math.max(0, model.tokens.length - MAX_VISIBLE_SLICES)
        const sliceCount = Math.max(1, visibleTokens.length)
        const totalHeight = Math.max(0.85, (sliceCount / maxSlices) * 3.8)
        const sliceHeight = totalHeight / sliceCount

        return (
          <group key={model.model_id} position={[x, 0, 0]}>
            {visibleTokens.map((tok, sIdx) => (
              <TowerSlice
                key={`${model.model_id}-${sIdx}`}
                token={tok}
                color={color}
                baseY={sIdx * sliceHeight + sliceHeight / 2}
                sliceHeight={sliceHeight}
                intensity={0.32 + (sIdx / sliceCount) * 0.28}
                towerX={x}
                onHoverStart={(t, pos) =>
                  setHoveredSlice({ token: t, modelName: model.display_name, position: pos })
                }
                onHoverEnd={() => setHoveredSlice(null)}
                onSelect={(t, pos) =>
                  setSelection({
                    byteSpan: [0, t.bytes_hex ? t.bytes_hex.split(' ').length : 0],
                    tokenIndex: sIdx,
                    worldPosition: pos,
                    info: {
                      stage: 'subword',
                      text: t.text,
                      bytesHex: t.bytes_hex,
                      tokenId: t.token_id,
                      byteSpan: [0, t.bytes_hex ? t.bytes_hex.split(' ').length : 0],
                      kindLabel: `${model.display_name} Token`,
                      explanation: `Token #${t.token_id} in ${model.display_name}.`,
                    },
                  })
                }
              />
            ))}

            {overflowCount > 0 && (
              <Text
                position={[0, totalHeight + 0.16, 0]}
                fontSize={0.13}
                color="#cbd5e1"
                anchorX="center"
                anchorY="bottom"
              >
                {`+${overflowCount} more`}
              </Text>
            )}

            {/* Floating 3D Glass Header Plaque */}
            <Html
              position={[0, totalHeight + (overflowCount > 0 ? 0.72 : 0.55), 0]}
              center
              distanceFactor={10}
              style={{ pointerEvents: 'none' }}
            >
              <div className="pointer-events-none w-40 rounded-2xl border border-white/15 border-t-white/30 bg-slate-950/75 px-3 py-2 text-center shadow-xl backdrop-blur-xl">
                <div className="truncate text-[11px] font-semibold" style={{ color }}>
                  {model.display_name}
                </div>
                <div className="mt-1 flex items-center justify-center gap-2 font-mono text-[10px] text-slate-200">
                  <span>{model.token_count} tok</span>
                  <span className="text-slate-500">·</span>
                  <span>{model.fertility.toFixed(2)}×</span>
                </div>
                <div className="mt-0.5 font-mono text-[9px] text-slate-400">
                  {model.bytes_per_token.toFixed(2)} B/tok
                </div>
              </div>
            </Html>
          </group>
        )
      })}

      {hoveredSlice && (
        <Html position={hoveredSlice.position} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
          <div className="pointer-events-none rounded-xl border border-white/20 bg-slate-950/90 px-2.5 py-1.5 text-center shadow-2xl backdrop-blur-xl">
            <div className="font-mono text-xs font-semibold text-white">
              “{hoveredSlice.token.text || '␣'}”{' '}
              <span className="text-amber-300">#{hoveredSlice.token.token_id}</span>
            </div>
            {hoveredSlice.token.bytes_hex && (
              <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                {hoveredSlice.token.bytes_hex}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}
