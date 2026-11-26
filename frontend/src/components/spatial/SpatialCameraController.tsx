import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useStudioStore, type SpatialSpace } from '../../store/useStudioStore'

const SPACE_CAMERAS: Record<
  SpatialSpace,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  hub: { pos: [0, 1.85, 13.6], target: [0, 0.35, -0.8] },
  pipeline: { pos: [0.2, 1.8, 15.8], target: [0, 0.2, 0] },
  tree: { pos: [0, 2.2, 12.2], target: [0, 0.6, 0] },
  vectors: { pos: [0, 1.5, 11.2], target: [0, 0.2, 0] },
  arena: { pos: [0, 2.1, 11.8], target: [0, 0.7, 0] },
}

export function SpatialCameraController({ reducedMotion }: { reducedMotion: boolean }) {
  const activeSpace = useStudioStore((s) => s.activeSpace)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const { camera } = useThree()

  const targetPos = useRef(new THREE.Vector3(...SPACE_CAMERAS.hub.pos))
  const targetLook = useRef(new THREE.Vector3(...SPACE_CAMERAS.hub.target))
  const isTransitioning = useRef(false)
  const pointerOffset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const preset = SPACE_CAMERAS[activeSpace]
    targetPos.current.set(...preset.pos)
    targetLook.current.set(...preset.target)
    isTransitioning.current = true
  }, [activeSpace])

  useEffect(() => {
    if (reducedMotion) {
      pointerOffset.current.x = 0
      pointerOffset.current.y = 0
      return
    }
    const onPointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      pointerOffset.current.x = nx * 0.45
      pointerOffset.current.y = -ny * 0.22
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [reducedMotion])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return

    const alpha = 1 - Math.exp(-6.5 * delta)

    if (isTransitioning.current) {
      camera.position.lerp(targetPos.current, alpha)
      controls.target.lerp(targetLook.current, alpha)
      controls.update()

      if (
        camera.position.distanceTo(targetPos.current) < 0.03 &&
        controls.target.distanceTo(targetLook.current) < 0.03
      ) {
        isTransitioning.current = false
      }
    } else if (activeSpace === 'hub' && !reducedMotion) {
      const desiredX = SPACE_CAMERAS.hub.pos[0] + pointerOffset.current.x
      const desiredY = SPACE_CAMERAS.hub.pos[1] + pointerOffset.current.y
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, desiredX, alpha * 0.5)
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, desiredY, alpha * 0.5)
      controls.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      minDistance={4.5}
      maxDistance={26}
      maxPolarAngle={Math.PI * 0.56}
      minPolarAngle={Math.PI * 0.16}
      onStart={() => {
        // 100% interruptible: user drag/scroll immediately cancels auto-flight
        isTransitioning.current = false
      }}
    />
  )
}
