import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useStudioStore } from '../../store/useStudioStore'

const PARTICLE_COUNT = 24
const DURATION_SEC = 0.55

export function MergeBurst3D({ reducedMotion }: { reducedMotion: boolean }) {
  const mergeBurstEvent = useStudioStore((s) => s.mergeBurstEvent)
  const pointsRef = useRef<THREE.Points>(null)
  const startTimeRef = useRef<number | null>(null)
  const activeIdRef = useRef<number | null>(null)

  const velocities = useMemo(() => {
    const dirs: THREE.Vector3[] = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = (i / PARTICLE_COUNT) * Math.PI * 2
      const phi = Math.acos(2 * ((i * 0.6180339887) % 1) - 1)
      const speed = 1.6 + (i % 4) * 0.45
      dirs.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.cos(phi) * speed * 0.8 + 0.5,
          Math.sin(phi) * Math.sin(theta) * speed,
        ),
      )
    }
    return dirs
  }, [])

  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), [])

  useEffect(() => {
    if (!mergeBurstEvent || reducedMotion) return
    activeIdRef.current = mergeBurstEvent.id
    startTimeRef.current = null
    if (pointsRef.current) {
      pointsRef.current.position.set(...mergeBurstEvent.position)
      pointsRef.current.visible = true
    }
  }, [mergeBurstEvent, reducedMotion])

  useFrame((state) => {
    if (!pointsRef.current || !mergeBurstEvent || reducedMotion) return
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime
    }
    const elapsed = state.clock.elapsedTime - startTimeRef.current
    if (elapsed > DURATION_SEC) {
      pointsRef.current.visible = false
      return
    }

    const t = elapsed / DURATION_SEC
    const geom = pointsRef.current.geometry
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const v = velocities[i]
      posAttr.setXYZ(i, v.x * elapsed, v.y * elapsed - 1.4 * elapsed * elapsed, v.z * elapsed)
    }
    posAttr.needsUpdate = true

    const mat = pointsRef.current.material as THREE.PointsMaterial
    mat.opacity = Math.max(0, 1 - t)
  })

  if (reducedMotion || !mergeBurstEvent) return null

  return (
    <points ref={pointsRef} visible={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.11}
        color={mergeBurstEvent.color}
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
