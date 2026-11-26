import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStudioStore } from '../../store/useStudioStore'
import type { TreeBounds } from './treeLayout'

interface TreeCameraRigProps {
  bounds: TreeBounds
  focusPosition: [number, number, number] | null
}

export function TreeCameraRig({ bounds, focusPosition }: TreeCameraRigProps) {
  const treeCameraPreset = useStudioStore((s) => s.treeCameraPreset)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const { camera } = useThree()

  const isAnimatingRef = useRef(false)
  const goalPosRef = useRef(new THREE.Vector3(0, 2.2, 12))
  const goalTargetRef = useRef(new THREE.Vector3(0, 1.0, 0))

  useEffect(() => {
    const dist = Math.max(8.5, bounds.spanX * 0.85)
    if (treeCameraPreset === 'forest') {
      goalPosRef.current.set(bounds.centerX, bounds.centerY + 1.4, dist)
      goalTargetRef.current.set(bounds.centerX, bounds.centerY, -0.3)
    } else if (treeCameraPreset === 'leaves') {
      goalPosRef.current.set(bounds.centerX, 0.85, Math.max(7.2, bounds.spanX * 0.68))
      goalTargetRef.current.set(bounds.centerX, 0.05, 0)
    } else if (treeCameraPreset === 'roots') {
      goalPosRef.current.set(
        bounds.centerX,
        bounds.maxY + 2.2,
        Math.max(7.5, bounds.spanX * 0.72),
      )
      goalTargetRef.current.set(bounds.centerX, Math.max(0.8, bounds.maxY * 0.82), -0.5)
    } else if (treeCameraPreset === 'focus') {
      const target = focusPosition ?? [bounds.centerX, bounds.centerY, 0]
      goalPosRef.current.set(target[0], target[1] + 0.85, target[2] + 5.2)
      goalTargetRef.current.set(target[0], target[1], target[2])
    }
    isAnimatingRef.current = true
  }, [treeCameraPreset, bounds, focusPosition])

  useFrame((_, delta) => {
    if (!isAnimatingRef.current || !controlsRef.current) return

    const alpha = 1 - Math.exp(-7 * delta)
    camera.position.lerp(goalPosRef.current, alpha)
    controlsRef.current.target.lerp(goalTargetRef.current, alpha)
    controlsRef.current.update()

    if (
      camera.position.distanceTo(goalPosRef.current) < 0.03 &&
      controlsRef.current.target.distanceTo(goalTargetRef.current) < 0.03
    ) {
      isAnimatingRef.current = false
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={2.8}
      maxDistance={28}
      maxPolarAngle={Math.PI * 0.8}
      minPolarAngle={Math.PI * 0.12}
      onStart={() => {
        isAnimatingRef.current = false
      }}
    />
  )
}
