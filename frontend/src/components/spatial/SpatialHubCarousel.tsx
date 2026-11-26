import { Line, RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useStudioStore, type SpatialVolume } from '../../store/useStudioStore'

interface VolumeMeta {
  id: SpatialVolume
  indexLabel: string
  title: string
  color: string
  arcPos: [number, number, number]
  arcRotY: number
}

const VOLUMES: VolumeMeta[] = [
  {
    id: 'pipeline',
    indexLabel: '01',
    title: 'PIPELINE',
    color: '#38bdf8',
    arcPos: [-5.1, 0.3, -1.1],
    arcRotY: 0.28,
  },
  {
    id: 'tree',
    indexLabel: '02',
    title: 'MERGE FOREST',
    color: '#a78bfa',
    arcPos: [-1.75, 0.45, -0.15],
    arcRotY: 0.1,
  },
  {
    id: 'vectors',
    indexLabel: '03',
    title: 'VECTOR GALAXY',
    color: '#34d399',
    arcPos: [1.75, 0.45, -0.15],
    arcRotY: -0.1,
  },
  {
    id: 'arena',
    indexLabel: '04',
    title: 'MODEL ARENA',
    color: '#fbbf24',
    arcPos: [5.1, 0.3, -1.1],
    arcRotY: -0.28,
  },
]

function VolumeSculpture({
  id,
  color,
  reducedMotion,
}: {
  id: SpatialVolume
  color: string
  reducedMotion: boolean
}) {
  const innerRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!innerRef.current || reducedMotion) return
    const t = state.clock.elapsedTime
    if (id === 'vectors') {
      innerRef.current.rotation.y = t * 0.35
    } else if (id === 'pipeline') {
      innerRef.current.position.y = Math.sin(t * 1.4) * 0.05
    } else if (id === 'tree') {
      innerRef.current.rotation.y = Math.sin(t * 0.5) * 0.12
    } else if (id === 'arena') {
      innerRef.current.position.y = Math.cos(t * 1.2) * 0.04
    }
  })

  if (id === 'pipeline') {
    return (
      <group ref={innerRef} position={[0, 0.25, 0]}>
        {[-0.65, -0.22, 0.22, 0.65].map((x, idx) => (
          <RoundedBox
            key={idx}
            args={[0.32, 0.55 + (idx % 2) * 0.22, 0.32]}
            radius={0.06}
            smoothness={4}
            position={[x, (idx % 2) * 0.1, 0]}
          >
            <meshPhysicalMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.45}
              roughness={0.15}
              metalness={0.1}
              transparent
              opacity={0.78}
            />
          </RoundedBox>
        ))}
      </group>
    )
  }

  if (id === 'tree') {
    return (
      <group ref={innerRef} position={[0, 0.1, 0]}>
        <RoundedBox args={[0.42, 0.26, 0.26]} radius={0.05} position={[0, 0.65, 0]}>
          <meshPhysicalMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.55}
            roughness={0.15}
            transparent
            opacity={0.85}
          />
        </RoundedBox>
        {[-0.45, 0.45].map((x, idx) => (
          <group key={idx}>
            <RoundedBox args={[0.32, 0.22, 0.22]} radius={0.04} position={[x, 0.15, 0]}>
              <meshPhysicalMaterial
                color="#38bdf8"
                emissive="#38bdf8"
                emissiveIntensity={0.4}
                roughness={0.18}
                transparent
                opacity={0.8}
              />
            </RoundedBox>
            <Line
              points={[
                [0, 0.52, 0],
                [x, 0.26, 0],
              ]}
              color="#c084fc"
              lineWidth={1.6}
              transparent
              opacity={0.75}
            />
          </group>
        ))}
      </group>
    )
  }

  if (id === 'vectors') {
    const orbs: Array<[number, number, number]> = [
      [-0.42, 0.45, 0.22],
      [0.38, 0.58, -0.18],
      [0.05, 0.15, 0.36],
      [-0.22, -0.1, -0.3],
      [0.44, 0.05, 0.18],
    ]
    return (
      <group ref={innerRef} position={[0, 0.28, 0]}>
        {orbs.map((pos, idx) => (
          <mesh key={idx} position={pos}>
            <sphereGeometry args={[0.13, 20, 20]} />
            <meshPhysicalMaterial
              color={idx % 2 === 0 ? color : '#38bdf8'}
              emissive={idx % 2 === 0 ? color : '#38bdf8'}
              emissiveIntensity={0.6}
              roughness={0.12}
              transparent
              opacity={0.88}
            />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2.4, 0.2, 0]}>
          <torusGeometry args={[0.72, 0.012, 12, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} />
        </mesh>
      </group>
    )
  }

  // arena
  return (
    <group ref={innerRef} position={[0, -0.05, 0]}>
      {[
        { x: -0.54, h: 0.95, c: '#38bdf8' },
        { x: -0.18, h: 0.62, c: '#34d399' },
        { x: 0.18, h: 0.72, c: '#a78bfa' },
        { x: 0.54, h: 0.84, c: '#fbbf24' },
      ].map((col, idx) => (
        <RoundedBox
          key={idx}
          args={[0.24, col.h, 0.24]}
          radius={0.04}
          position={[col.x, col.h / 2 - 0.1, 0]}
        >
          <meshPhysicalMaterial
            color={col.c}
            emissive={col.c}
            emissiveIntensity={0.45}
            roughness={0.15}
            transparent
            opacity={0.82}
          />
        </RoundedBox>
      ))}
    </group>
  )
}

function HubVolumePedestal({
  meta,
  index,
  statText,
  reducedMotion,
}: {
  meta: VolumeMeta
  index: number
  statText: string
  reducedMotion: boolean
}) {
  const activeSpace = useStudioStore((s) => s.activeSpace)
  const hoveredVolume = useStudioStore((s) => s.hoveredVolume)
  const hubCarouselIndex = useStudioStore((s) => s.hubCarouselIndex)
  const setActiveSpace = useStudioStore((s) => s.setActiveSpace)
  const setHoveredVolume = useStudioStore((s) => s.setHoveredVolume)
  const setHubCarouselIndex = useStudioStore((s) => s.setHubCarouselIndex)

  const groupRef = useRef<THREE.Group>(null)
  const isHub = activeSpace === 'hub'
  const isHovered = hoveredVolume === meta.id
  const isFocused = isHub && hubCarouselIndex === index

  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    const alpha = 1 - Math.exp(-8 * delta)

    const targetZ = isHub ? meta.arcPos[2] + (isHovered || isFocused ? 0.65 : 0) : -14
    const targetY = isHub ? meta.arcPos[1] + (isHovered ? 0.12 : 0) : -2.5
    const targetScale = isHub ? (isHovered ? 1.06 : isFocused ? 1.03 : 0.98) : 0.65

    group.position.x = THREE.MathUtils.lerp(group.position.x, meta.arcPos[0], alpha)
    group.position.y = THREE.MathUtils.lerp(group.position.y, targetY, alpha)
    group.position.z = THREE.MathUtils.lerp(group.position.z, targetZ, alpha)
    group.scale.setScalar(THREE.MathUtils.lerp(group.scale.x, targetScale, alpha))
  })

  return (
    <group
      ref={groupRef}
      position={meta.arcPos}
      rotation={[0, meta.arcRotY, 0]}
      onPointerOver={(e) => {
        if (!isHub) return
        e.stopPropagation()
        setHoveredVolume(meta.id)
        setHubCarouselIndex(index)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        if (!isHub) return
        setHoveredVolume(null)
        document.body.style.cursor = 'auto'
      }}
      onClick={(e) => {
        if (!isHub) return
        e.stopPropagation()
        document.body.style.cursor = 'auto'
        setActiveSpace(meta.id)
      }}
    >
      {/* Translucent Glass Pedestal Card */}
      <RoundedBox args={[2.55, 2.75, 0.32]} radius={0.18} smoothness={4} position={[0, 0.22, -0.35]}>
        <meshPhysicalMaterial
          color="#0f172a"
          emissive={meta.color}
          emissiveIntensity={isHovered || isFocused ? 0.2 : 0.06}
          roughness={0.14}
          metalness={0.15}
          transparent
          opacity={isHub ? 0.56 : 0.1}
        />
      </RoundedBox>

      {/* 3D Sculpture */}
      <VolumeSculpture id={meta.id} color={meta.color} reducedMotion={reducedMotion} />

      {/* 3D World-Space Typography */}
      <Text
        position={[-0.92, 1.3, -0.16]}
        fontSize={0.17}
        color={meta.color}
        anchorX="left"
        anchorY="middle"
      >
        {meta.indexLabel}
      </Text>
      <Text
        position={[0, -0.78, -0.16]}
        fontSize={0.19}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.06}
      >
        {meta.title}
      </Text>
      <Text
        position={[0, -1.04, -0.16]}
        fontSize={0.13}
        color="#94a3b8"
        anchorX="center"
        anchorY="middle"
      >
        {statText}
      </Text>
    </group>
  )
}

export function SpatialHubCarousel({ reducedMotion }: { reducedMotion: boolean }) {
  const activeSpace = useStudioStore((s) => s.activeSpace)
  const hubCarouselIndex = useStudioStore((s) => s.hubCarouselIndex)
  const setHubCarouselIndex = useStudioStore((s) => s.setHubCarouselIndex)
  const setActiveSpace = useStudioStore((s) => s.setActiveSpace)
  const analysis = useStudioStore((s) => s.analysis)
  const embeddings = useStudioStore((s) => s.embeddings)
  const comparison = useStudioStore((s) => s.comparison)

  // Keyboard navigation in Hub mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      if (e.key === 'Escape' && activeSpace !== 'hub') {
        setActiveSpace('hub')
        return
      }
      if (activeSpace !== 'hub') return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setHubCarouselIndex(hubCarouselIndex + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setHubCarouselIndex(hubCarouselIndex - 1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        setActiveSpace(VOLUMES[hubCarouselIndex].id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeSpace, hubCarouselIndex, setHubCarouselIndex, setActiveSpace])

  const tokenCount = analysis?.final_tokens.length ?? 0
  const mergeCount = analysis?.merge_steps.length ?? 0
  const vectorCount = embeddings?.points.length ?? 0
  const modelCount = comparison?.models.length ?? 4

  const stats: Record<SpatialVolume, string> = {
    pipeline: `${tokenCount} tokens`,
    tree: `${mergeCount} merges`,
    vectors: `${vectorCount} vectors`,
    arena: `${modelCount} models`,
  }

  return (
    <group>
      {VOLUMES.map((meta, idx) => (
        <HubVolumePedestal
          key={meta.id}
          meta={meta}
          index={idx}
          statText={stats[meta.id]}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  )
}
