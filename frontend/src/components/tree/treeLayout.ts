import type { MergeTree, MergeTreeNode } from '../../types/tokenizer'

export const TREE_MAX_BYTES = 64

export interface PositionedTreeNode {
  node: MergeTreeNode
  position: [number, number, number]
  width: number
}

export interface TreeEdge {
  id: string
  parentId: string
  childId: string
  start: [number, number, number]
  end: [number, number, number]
  side: 'left' | 'right'
}

export interface ChunkWall {
  chunkIndex: number
  x: number
}

export interface TreeBounds {
  minX: number
  maxX: number
  maxY: number
  centerX: number
  centerY: number
  spanX: number
}

export interface ForestLayout {
  nodes: PositionedTreeNode[]
  nodeById: Map<string, PositionedTreeNode>
  edges: TreeEdge[]
  chunkWalls: ChunkWall[]
  maxDepth: number
  bounds: TreeBounds
  isTruncated: boolean
  totalBytes: number
  leafOrderIds: string[]
}

/**
 * Return all descendant node IDs (including `nodeId` itself).
 */
export function getDescendantIds(
  nodeId: string,
  nodeMap: Map<string, MergeTreeNode>,
): Set<string> {
  const result = new Set<string>()
  const stack = [nodeId]
  while (stack.length > 0) {
    const currentId = stack.pop()
    if (!currentId || result.has(currentId)) continue
    result.add(currentId)
    const node = nodeMap.get(currentId)
    if (!node) continue
    if (node.left_child_id) stack.push(node.left_child_id)
    if (node.right_child_id) stack.push(node.right_child_id)
  }
  return result
}

/**
 * Return all ancestor node IDs (including `nodeId` itself).
 */
export function getAncestorIds(
  nodeId: string,
  nodeMap: Map<string, MergeTreeNode>,
): Set<string> {
  const parentOf = new Map<string, string>()
  for (const node of nodeMap.values()) {
    if (node.left_child_id) parentOf.set(node.left_child_id, node.node_id)
    if (node.right_child_id) parentOf.set(node.right_child_id, node.node_id)
  }

  const result = new Set<string>()
  let cursor: string | undefined = nodeId
  while (cursor && !result.has(cursor)) {
    result.add(cursor)
    cursor = parentOf.get(cursor)
  }
  return result
}

/**
 * Compute deterministic bottom-up 3D binary forest coordinates.
 */
export function computeForestLayout(
  mergeTree: MergeTree | null,
  useRegex: boolean,
): ForestLayout {
  const emptyBounds: TreeBounds = {
    minX: -2,
    maxX: 2,
    maxY: 2,
    centerX: 0,
    centerY: 0.8,
    spanX: 4,
  }

  if (!mergeTree || mergeTree.nodes.length === 0) {
    return {
      nodes: [],
      nodeById: new Map(),
      edges: [],
      chunkWalls: [],
      maxDepth: 0,
      bounds: emptyBounds,
      isTruncated: false,
      totalBytes: 0,
      leafOrderIds: [],
    }
  }

  const allLeaves = mergeTree.nodes
    .filter((n) => n.is_leaf)
    .sort((a, b) => a.byte_span[0] - b.byte_span[0])

  const totalBytes =
    allLeaves.length > 0
      ? allLeaves[allLeaves.length - 1].byte_span[1]
      : 0

  const isTruncated = allLeaves.length > TREE_MAX_BYTES
  const visibleLeaves = allLeaves.slice(0, TREE_MAX_BYTES)
  const maxByteEnd =
    visibleLeaves.length > 0
      ? visibleLeaves[visibleLeaves.length - 1].byte_span[1]
      : 0

  const visibleRawNodes = mergeTree.nodes.filter(
    (n) => n.byte_span[1] <= maxByteEnd,
  )

  const leafSpacing = 0.92
  const chunkExtraGap = useRegex ? 0.42 : 0
  const verticalSpacing = 1.15
  const depthZStagger = 0.25

  // Assign leaf X coordinates
  const rawLeafXs: number[] = []
  const rawWallXs: Array<{ chunkIndex: number; x: number }> = []
  let cursorX = 0

  for (let i = 0; i < visibleLeaves.length; i++) {
    if (i > 0) {
      const prev = visibleLeaves[i - 1]
      const curr = visibleLeaves[i]
      if (useRegex && prev.chunk_index !== curr.chunk_index) {
        const wallX = cursorX + (leafSpacing + chunkExtraGap) * 0.5 - leafSpacing * 0.5
        rawWallXs.push({ chunkIndex: curr.chunk_index, x: wallX })
        cursorX += chunkExtraGap
      }
      cursorX += leafSpacing
    }
    rawLeafXs.push(cursorX)
  }

  const minRawX = rawLeafXs.length > 0 ? rawLeafXs[0] : 0
  const maxRawX = rawLeafXs.length > 0 ? rawLeafXs[rawLeafXs.length - 1] : 0
  const midOffset = (minRawX + maxRawX) / 2

  const positionMap = new Map<string, [number, number, number]>()
  const positionedNodes: PositionedTreeNode[] = []
  const nodeById = new Map<string, PositionedTreeNode>()

  for (let i = 0; i < visibleLeaves.length; i++) {
    const leaf = visibleLeaves[i]
    const x = rawLeafXs[i] - midOffset
    const pos: [number, number, number] = [x, 0, 0]
    positionMap.set(leaf.node_id, pos)
    const item: PositionedTreeNode = {
      node: leaf,
      position: pos,
      width: leaf.is_special ? 1.25 : 0.78,
    }
    positionedNodes.push(item)
    nodeById.set(leaf.node_id, item)
  }

  const chunkWalls: ChunkWall[] = rawWallXs.map((w) => ({
    chunkIndex: w.chunkIndex,
    x: w.x - midOffset,
  }))

  // Process non-leaf nodes in ascending depth order so children are always positioned first
  const internalNodes = visibleRawNodes
    .filter((n) => !n.is_leaf)
    .sort((a, b) => a.depth - b.depth || (a.merge_step ?? 0) - (b.merge_step ?? 0))

  let maxDepth = 0
  const edges: TreeEdge[] = []

  for (const node of internalNodes) {
    const leftPos = node.left_child_id ? positionMap.get(node.left_child_id) : undefined
    const rightPos = node.right_child_id ? positionMap.get(node.right_child_id) : undefined
    if (!leftPos || !rightPos) continue

    const x = (leftPos[0] + rightPos[0]) / 2
    const y = node.depth * verticalSpacing
    const z = -node.depth * depthZStagger
    const pos: [number, number, number] = [x, y, z]

    positionMap.set(node.node_id, pos)
    maxDepth = Math.max(maxDepth, node.depth)

    const spanWidth = Math.abs(rightPos[0] - leftPos[0])
    const width = Math.min(2.4, Math.max(0.95, spanWidth * 0.55 + 0.55))

    const item: PositionedTreeNode = {
      node,
      position: pos,
      width,
    }
    positionedNodes.push(item)
    nodeById.set(node.node_id, item)

    edges.push({
      id: `${node.node_id}-L`,
      parentId: node.node_id,
      childId: node.left_child_id!,
      start: pos,
      end: leftPos,
      side: 'left',
    })
    edges.push({
      id: `${node.node_id}-R`,
      parentId: node.node_id,
      childId: node.right_child_id!,
      start: pos,
      end: rightPos,
      side: 'right',
    })
  }

  const xs = positionedNodes.map((n) => n.position[0])
  const minX = xs.length > 0 ? Math.min(...xs) : -2
  const maxX = xs.length > 0 ? Math.max(...xs) : 2
  const maxY = maxDepth * verticalSpacing
  const bounds: TreeBounds = {
    minX,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: maxY / 2,
    spanX: Math.max(4, maxX - minX + 2),
  }

  return {
    nodes: positionedNodes,
    nodeById,
    edges,
    chunkWalls,
    maxDepth,
    bounds,
    isTruncated,
    totalBytes,
    leafOrderIds: visibleLeaves.map((l) => l.node_id),
  }
}
