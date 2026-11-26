import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStudioStore, type CameraPreset } from '../../store/useStudioStore'

const PRESET_VIEWS: Record<
  CameraPreset,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  overview: { position: [0.2, 2.2, 16.5], target: [0.2, -0.1, 0] },
  text: { position: [-8.4, 0.7, 6.2], target: [-8.4, 0, 0] },
  bytes: { position: [-4.2, 0.7, 6.4], target: [-4.2, 0, 0] },
  subwords: { position: [0.0, 0.7, 6.4], target: [0, 0, 0] },
  ids: { position: [4.2, 0.7, 6.2], target: [4.2, 0, 0] },
  vectors: { position: [8.8, 1.4, 6.4], target: [8.8, 0, 0] },
}

export function CameraRig() {
  const cameraPreset = useStudioStore((s) => s.cameraPreset)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const { camera } = useThree()

  const isAnimatingRef = useRef(false)
  const goalPosRef = useRef(new THREE.Vector3(...PRESET_VIEWS.overview.position))
  const goalTargetRef = useRef(new THREE.Vector3(...PRESET_VIEWS.overview.target))

  useEffect(() => {
    const view = PRESET_VIEWS[cameraPreset]
    goalPosRef.current.set(...view.position)
    goalTargetRef.current.set(...view.target)
    isAnimatingRef.current = true
  }, [cameraPreset])

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
      minDistance={3.0}
      maxDistance={28}
      maxPolarAngle={Math.PI * 0.78}
      minPolarAngle={Math.PI * 0.14}
      onStart={() => {
        // Immediately cancel preset animation when user drags/scrolls
        isAnimatingRef.current = false
      }}
    />
  )
}
