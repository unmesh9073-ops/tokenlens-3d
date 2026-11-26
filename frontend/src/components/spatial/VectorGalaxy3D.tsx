import { Html, Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStudioStore } from '../../store/useStudioStore'
import { playHoverTick, playSelectClick } from '../../utils/spatialAudio'

export function VectorGalaxy3D({ reducedMotion }: { reducedMotion: boolean }) {
  const embeddings = useStudioStore((s) => s.embeddings)
  const vectorCompareIndices = useStudioStore((s) => s.vectorCompareIndices)
  const toggleVectorCompareIndex = useStudioStore((s) => s.toggleVectorCompareIndex)
  const setSelection = useStudioStore((s) => s.setSelection)

  const ringRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!ringRef.current || reducedMotion) return
    ringRef.current.rotation.y += delta * 0.08
  })

  const points = embeddings?.points ?? []

  const positions = useMemo(() => {
    return points.map(
      (pt) => [pt.x * 3.2, pt.y * 2.4 + 0.35, pt.z * 3.2] as [number, number, number],
    )
  }, [points])

  const similarityInfo = useMemo(() => {
    if (vectorCompareIndices.length !== 2) return null
    const [aIdx, bIdx] = vectorCompareIndices
    const a = points[aIdx]
    const b = points[bIdx]
    if (!a || !b) return null
    const posA = positions[aIdx]
    const posB = positions[bIdx]
    const dot = a.x * b.x + a.y * b.y + a.z * b.z
    const magA = Math.hypot(a.x, a.y, a.z) || 1
    const magB = Math.hypot(b.x, b.y, b.z) || 1
    const cos = Math.max(-1, Math.min(1, dot / (magA * magB)))
    const mid: [number, number, number] = [
      (posA[0] + posB[0]) / 2,
      (posA[1] + posB[1]) / 2 + 0.35,
      (posA[2] + posB[2]) / 2,
    ]
    return { posA, posB, mid, cos }
  }, [points, positions, vectorCompareIndices])

  return (
    <group>
      {/* Orbital Guide Rings */}
      <group ref={ringRef} position={[0, 0.35, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.6, 0.012, 12, 72]} />
          <meshBasicMaterial color="#34d399" transparent opacity={0.22} />
        </mesh>
        <mesh rotation={[Math.PI / 2.6, 0.35, 0]}>
          <torusGeometry args={[2.5, 0.01, 12, 64]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.18} />
        </mesh>
      </group>

      {points.map((pt, idx) => {
        const pos = positions[idx]
        const isSelected = vectorCompareIndices.includes(idx)
        return (
          <group
            key={`${pt.text}-${idx}`}
            position={pos}
            onPointerOver={(e) => {
              e.stopPropagation()
              playHoverTick()
            }}
            onClick={(e) => {
              e.stopPropagation()
              playSelectClick()
              toggleVectorCompareIndex(idx)
              setSelection({
                byteSpan: null,
                tokenIndex: idx,
                worldPosition: pos,
                info: {
                  stage: 'vector',
                  text: pt.text,
                  bytesHex: '',
                  byteSpan: [0, 0],
                  kindLabel: '3D Semantic Embedding',
                  explanation: `PCA coordinates (${[pt.x, pt.y, pt.z].map((c) => c.toFixed(2)).join(', ')}). Click another orb to measure cosine similarity.`,
                },
              })
            }}
          >
            <mesh>
              <sphereGeometry args={[isSelected ? 0.24 : 0.16, 24, 24]} />
              <meshPhysicalMaterial
                color={isSelected ? '#fbbf24' : '#34d399'}
                emissive={isSelected ? '#fbbf24' : '#34d399'}
                emissiveIntensity={isSelected ? 0.9 : 0.45}
                roughness={0.12}
                metalness={0.1}
                transparent
                opacity={0.9}
              />
            </mesh>
            <Text
              position={[0, 0.32, 0]}
              fontSize={0.18}
              color={isSelected ? '#fef08a' : '#e2e8f0'}
              anchorX="center"
              anchorY="bottom"
            >
              {pt.text}
            </Text>
          </group>
        )
      })}

      {similarityInfo && (
        <group>
          <Line
            points={[similarityInfo.posA, similarityInfo.posB]}
            color="#fbbf24"
            lineWidth={2.5}
            transparent
            opacity={0.9}
          />
          <Html position={similarityInfo.mid} center>
            <div className="rounded-full border border-amber-400/40 bg-slate-950/85 px-3 py-1 text-xs font-mono text-amber-200 shadow-lg backdrop-blur-xl">
              cos = {similarityInfo.cos.toFixed(2)}
            </div>
          </Html>
        </group>
      )}
    </group>
  )
}
