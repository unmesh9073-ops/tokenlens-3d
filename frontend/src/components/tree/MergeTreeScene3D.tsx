import { QuadraticBezierLine, RoundedBox, Text } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useStudioStore } from '../../store/useStudioStore'
import type { MergeTreeNode } from '../../types/tokenizer'
import { TreeCameraRig } from './TreeCameraRig'
import {
  computeForestLayout,
  getAncestorIds,
  getDescendantIds,
  type PositionedTreeNode,
} from './treeLayout'

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

interface TreeNodeMeshProps {
  item: PositionedTreeNode
  isFrontier: boolean
  isNewlyMerged: boolean
  isSelected: boolean
  isLineage: boolean
  dimmed: boolean
  isManualValidNeighbor: boolean
  reducedMotion: boolean
  onSelect: () => void
}

function TreeNodeMesh({
  item,
  isFrontier,
  isNewlyMerged,
  isSelected,
  isLineage,
  dimmed,
  isManualValidNeighbor,
  reducedMotion,
  onSelect,
}: TreeNodeMeshProps) {
  const groupRef = useRef<THREE.Group>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const { node, position, width } = item
  const height = node.is_leaf ? 0.44 : 0.5
  const depthZ = 0.32

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return

    const targetScale = hovered || isSelected || isNewlyMerged ? 1.08 : 1.0
    const alpha = 1 - Math.exp(-12 * delta)
    group.scale.x = THREE.MathUtils.lerp(group.scale.x, targetScale, alpha)
    group.scale.y = THREE.MathUtils.lerp(group.scale.y, targetScale, alpha)
    group.scale.z = THREE.MathUtils.lerp(group.scale.z, targetScale, alpha)

    if (!reducedMotion && isFrontier) {
      const t = state.clock.elapsedTime + position[0] * 0.4
      group.position.y = position[1] + Math.sin(t * 1.2) * 0.022
    } else {
      group.position.y = position[1]
    }

    if (haloRef.current && isNewlyMerged && !reducedMotion) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 4.5) * 0.04
      haloRef.current.scale.set(pulse, pulse, pulse)
    }
  })

  const baseColor = node.is_special
    ? '#f59e0b'
    : isManualValidNeighbor
      ? '#34d399'
      : isNewlyMerged
        ? '#38bdf8'
        : node.is_leaf
          ? '#60a5fa'
          : isFrontier
            ? '#c084fc'
            : '#818cf8'

  const opacity = dimmed
    ? 0.14
    : isSelected || hovered || isNewlyMerged
      ? 0.62
      : isFrontier
        ? 0.44
        : 0.22

  const emissiveIntensity = dimmed
    ? 0.03
    : isNewlyMerged || isSelected || hovered
      ? 0.55
      : isFrontier || isLineage
        ? 0.24
        : 0.08

  return (
    <group ref={groupRef} position={position}>
      <RoundedBox
        args={[width, height, depthZ]}
        radius={0.07}
        smoothness={3}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <meshPhysicalMaterial
          color={baseColor}
          transparent
          opacity={opacity}
          roughness={0.16}
          metalness={0.08}
          clearcoat={1}
          clearcoatRoughness={0.12}
          emissive={baseColor}
          emissiveIntensity={emissiveIntensity}
        />
      </RoundedBox>

      {(isNewlyMerged || isSelected || isManualValidNeighbor) && (
        <RoundedBox
          ref={haloRef}
          args={[width + 0.06, height + 0.06, depthZ + 0.06]}
          radius={0.08}
          smoothness={2}
        >
          <meshBasicMaterial
            color={isManualValidNeighbor ? '#34d399' : isNewlyMerged ? '#7dd3fc' : '#ffffff'}
            transparent
            opacity={0.45}
            wireframe
          />
        </RoundedBox>
      )}

      <Text
        position={[0, 0.06, depthZ / 2 + 0.015]}
        fontSize={0.16}
        maxWidth={width - 0.1}
        color={dimmed ? '#64748b' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
      >
        {node.display_text.length > 12
          ? `${node.display_text.slice(0, 10)}…`
          : node.display_text}
      </Text>

      <Text
        position={[0, -0.11, depthZ / 2 + 0.015]}
        fontSize={0.09}
        maxWidth={width - 0.08}
        color={dimmed ? '#475569' : '#cbd5e1'}
        anchorX="center"
        anchorY="middle"
      >
        {node.is_special ? 'Special' : `#${node.token_id}`}
      </Text>
    </group>
  )
}

export function MergeTreeContent({ embedded = false }: { embedded?: boolean }) {
  const analysis = useStudioStore((s) => s.analysis)
  const labMode = useStudioStore((s) => s.labMode)
  const useRegex = useStudioStore((s) => s.useRegex)
  const manualTree = useStudioStore((s) => s.manualTree)
  const manualNodes = useStudioStore((s) => s.manualNodes)
  const manualSelectedIndex = useStudioStore((s) => s.manualSelectedIndex)
  const timelineStep = useStudioStore((s) => s.timelineStep)
  const selectedNodeId = useStudioStore((s) => s.selectedNodeId)
  const selectedByteSpan = useStudioStore((s) => s.selectedByteSpan)
  const setSelection = useStudioStore((s) => s.setSelection)
  const setManualSelectedIndex = useStudioStore((s) => s.setManualSelectedIndex)
  const performManualMerge = useStudioStore((s) => s.performManualMerge)

  const reducedMotion = usePrefersReducedMotion()

  const activeTree = labMode === 'manual' ? manualTree : (analysis?.merge_tree ?? null)

  const layout = useMemo(
    () => computeForestLayout(activeTree, useRegex),
    [activeTree, useRegex],
  )

  // Determine which nodes are visible at `timelineStep` (in auto mode) or all (in manual mode)
  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of layout.nodes) {
      if (labMode === 'manual') {
        ids.add(item.node.node_id)
      } else if (
        item.node.is_leaf ||
        (item.node.merge_step !== null && item.node.merge_step < timelineStep)
      ) {
        ids.add(item.node.node_id)
      }
    }
    return ids
  }, [layout.nodes, labMode, timelineStep])

  const frontierSet = useMemo(() => {
    if (labMode === 'manual') {
      return new Set(manualNodes)
    }
    if (timelineStep === 0 || !analysis) {
      return new Set(layout.leafOrderIds)
    }
    const stepData = analysis.merge_steps[timelineStep - 1]
    return new Set(stepData ? stepData.active_node_ids : layout.leafOrderIds)
  }, [labMode, manualNodes, timelineStep, analysis, layout.leafOrderIds])

  const rawNodeMap = useMemo(() => {
    const map = new Map<string, MergeTreeNode>()
    for (const item of layout.nodes) {
      if (visibleNodeIds.has(item.node.node_id)) {
        map.set(item.node.node_id, item.node)
      }
    }
    return map
  }, [layout.nodes, visibleNodeIds])

  // Sync cross-view selection: if selectedNodeId isn't in visible map, match by selectedByteSpan
  const effectiveSelectedNodeId = useMemo(() => {
    if (selectedNodeId && rawNodeMap.has(selectedNodeId)) {
      return selectedNodeId
    }
    if (selectedByteSpan) {
      const exact = layout.nodes.find(
        (n) =>
          visibleNodeIds.has(n.node.node_id) &&
          n.node.byte_span[0] === selectedByteSpan[0] &&
          n.node.byte_span[1] === selectedByteSpan[1],
      )
      if (exact) return exact.node.node_id
    }
    return null
  }, [selectedNodeId, rawNodeMap, selectedByteSpan, layout.nodes, visibleNodeIds])

  const lineageSet = useMemo(() => {
    if (!effectiveSelectedNodeId) return null
    const ancestors = getAncestorIds(effectiveSelectedNodeId, rawNodeMap)
    const descendants = getDescendantIds(effectiveSelectedNodeId, rawNodeMap)
    return new Set([...ancestors, ...descendants])
  }, [effectiveSelectedNodeId, rawNodeMap])

  const focusPosition = useMemo((): [number, number, number] | null => {
    if (effectiveSelectedNodeId) {
      return layout.nodeById.get(effectiveSelectedNodeId)?.position ?? null
    }
    if (labMode === 'auto' && timelineStep > 0) {
      const newlyMerged = layout.nodes.find(
        (n) => n.node.merge_step === timelineStep - 1,
      )
      if (newlyMerged) return newlyMerged.position
    }
    return null
  }, [effectiveSelectedNodeId, layout.nodeById, layout.nodes, labMode, timelineStep])

  const canPairManual = (nodeId: string): number | null => {
    if (labMode !== 'manual') return null
    const idx = manualNodes.indexOf(nodeId)
    return idx === -1 ? null : idx
  }

  const isManualValidNeighbor = (nodeId: string): boolean => {
    if (labMode !== 'manual' || manualSelectedIndex === null) return false
    const idx = manualNodes.indexOf(nodeId)
    if (idx === -1 || Math.abs(idx - manualSelectedIndex) !== 1) return false
    const a = layout.nodeById.get(manualNodes[manualSelectedIndex])?.node
    const b = layout.nodeById.get(nodeId)?.node
    if (!a || !b || a.is_special || b.is_special) return false
    if (useRegex && a.chunk_index !== b.chunk_index) return false
    return true
  }

  const depthLevels = useMemo(() => {
    const levels: number[] = []
    for (let d = 0; d <= Math.max(1, layout.maxDepth); d++) {
      levels.push(d)
    }
    return levels
  }, [layout.maxDepth])

  return (
    <>
      <group>
        {/* Depth Elevation Guide Lines */}
        {depthLevels.map((d) => (
          <group key={`depth-guide-${d}`} position={[layout.bounds.centerX, d * 1.15, -d * 0.25]}>
            <mesh position={[0, -0.26, -0.15]}>
              <boxGeometry args={[layout.bounds.spanX + 1.5, 0.008, 0.01]} />
              <meshBasicMaterial color="#1e293b" transparent opacity={0.45} />
            </mesh>
            <Text
              position={[-layout.bounds.spanX / 2 - 0.9, 0, 0]}
              fontSize={0.14}
              color="#64748b"
              anchorX="right"
              anchorY="middle"
            >
              {d === 0 ? 'Depth 0 (Bytes)' : `Depth ${d}`}
            </Text>
          </group>
        ))}

        {/* Regex Chunk Walls */}
        {useRegex &&
          layout.chunkWalls.map((wall) => (
            <mesh
              key={`wall-${wall.chunkIndex}`}
              position={[wall.x, Math.max(0.6, layout.bounds.centerY), -0.25]}
            >
              <planeGeometry args={[0.03, Math.max(2.2, layout.bounds.maxY + 1.4)]} />
              <meshBasicMaterial
                color="#38bdf8"
                transparent
                opacity={0.22}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}

        {/* Visible Tree Nodes */}
        {layout.nodes.map((item) => {
          const nid = item.node.node_id
          if (!visibleNodeIds.has(nid)) return null

          const isFrontier = frontierSet.has(nid)
          const isNewlyMerged =
            labMode === 'auto' &&
            timelineStep > 0 &&
            item.node.merge_step === timelineStep - 1
          const isSelected = effectiveSelectedNodeId === nid
          const isLineage = lineageSet ? lineageSet.has(nid) : false
          const validNeighbor = isManualValidNeighbor(nid)
          const dimmed = lineageSet !== null && !isLineage && !validNeighbor

          return (
            <TreeNodeMesh
              key={nid}
              item={item}
              isFrontier={isFrontier}
              isNewlyMerged={isNewlyMerged}
              isSelected={isSelected}
              isLineage={isLineage}
              dimmed={dimmed}
              isManualValidNeighbor={validNeighbor}
              reducedMotion={reducedMotion}
              onSelect={() => {
                if (labMode === 'manual') {
                  const frontierIdx = canPairManual(nid)
                  if (frontierIdx !== null) {
                    if (manualSelectedIndex === null) {
                      setManualSelectedIndex(frontierIdx)
                    } else if (manualSelectedIndex === frontierIdx) {
                      setManualSelectedIndex(null)
                    } else if (validNeighbor) {
                      const firstId = manualNodes[manualSelectedIndex]
                      const firstNode = layout.nodeById.get(firstId)?.node
                      if (firstNode) {
                        const left =
                          manualSelectedIndex < frontierIdx ? firstNode : item.node
                        const right =
                          manualSelectedIndex < frontierIdx ? item.node : firstNode
                        void performManualMerge(left.token_id, right.token_id)
                      }
                    } else {
                      setManualSelectedIndex(frontierIdx)
                    }
                  }
                }

                setSelection({
                  byteSpan: item.node.byte_span,
                  nodeId: nid,
                  info: {
                    stage: 'subword',
                    text: item.node.display_text,
                    bytesHex: item.node.bytes_hex,
                    tokenId: item.node.token_id,
                    byteSpan: item.node.byte_span,
                    kindLabel: item.node.is_special
                      ? 'Special Token'
                      : item.node.is_leaf
                        ? 'UTF-8 Byte Leaf'
                        : `BPE Merge (Depth ${item.node.depth})`,
                    explanation: item.node.is_leaf
                      ? `Raw byte leaf covering [${item.node.byte_span[0]}..${item.node.byte_span[1]}).`
                      : `Merged at step ${(item.node.merge_step ?? 0) + 1} into token #${item.node.token_id}.`,
                  },
                })
              }}
            />
          )
        })}

        {/* Curved Binary Branches */}
        {layout.edges.map((edge) => {
          if (!visibleNodeIds.has(edge.parentId) || !visibleNodeIds.has(edge.childId)) {
            return null
          }
          const isLineageEdge =
            lineageSet !== null &&
            lineageSet.has(edge.parentId) &&
            lineageSet.has(edge.childId)
          const mid: [number, number, number] = [
            (edge.start[0] + edge.end[0]) / 2,
            (edge.start[1] + edge.end[1]) / 2 + 0.14,
            (edge.start[2] + edge.end[2]) / 2 + 0.18,
          ]
          return (
            <QuadraticBezierLine
              key={edge.id}
              start={[edge.start[0], edge.start[1] - 0.22, edge.start[2]]}
              end={[edge.end[0], edge.end[1] + 0.22, edge.end[2]]}
              mid={mid}
              color={isLineageEdge ? '#38bdf8' : '#475569'}
              lineWidth={isLineageEdge ? 2.4 : 1.15}
              transparent
              opacity={lineageSet ? (isLineageEdge ? 0.95 : 0.12) : 0.45}
            />
          )
        })}
      </group>

      {!embedded && <TreeCameraRig bounds={layout.bounds} focusPosition={focusPosition} />}
    </>
  )
}

export function MergeTreeScene3D() {
  const clearSelection = useStudioStore((s) => s.clearSelection)

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 2.2, 12], fov: 44 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => clearSelection()}
      >
        <color attach="background" args={['#06070B']} />
        <fog attach="fog" args={['#06070B', 18, 36]} />

        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 8, 8]} intensity={1.7} color="#e0f2fe" />
        <directionalLight position={[-6, -4, 4]} intensity={0.85} color="#818cf8" />
        <pointLight position={[0, 3, 6]} intensity={1.3} color="#38bdf8" distance={22} />

        <gridHelper args={[28, 28, '#1e293b', '#0f172a']} position={[0, -0.55, 0]} />

        <MergeTreeContent />
      </Canvas>
    </div>
  )
}
