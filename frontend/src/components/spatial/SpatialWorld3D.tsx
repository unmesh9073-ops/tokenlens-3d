import { Sparkles } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { useStudioStore } from '../../store/useStudioStore'
import { CanvasErrorBoundary } from '../CanvasErrorBoundary'
import { PipelineContent } from '../pipeline/PipelineScene3D'
import { MergeTreeContent } from '../tree/MergeTreeScene3D'
import { MergeBurst3D } from './MergeBurst3D'
import { ModelArena3D } from './ModelArena3D'
import { SpatialCameraController } from './SpatialCameraController'
import { SpatialHubCarousel } from './SpatialHubCarousel'
import { SpatialInspector3D } from './SpatialInspector3D'
import { VectorGalaxy3D } from './VectorGalaxy3D'

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

export function SpatialWorld3D() {
  const activeSpace = useStudioStore((s) => s.activeSpace)
  const clearSelection = useStudioStore((s) => s.clearSelection)
  const reducedMotion = usePrefersReducedMotion()

  return (
    <CanvasErrorBoundary>
      <div className="relative h-full w-full">
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 1.85, 13.6], fov: 44 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onPointerMissed={() => clearSelection()}
        >
          <color attach="background" args={['#05060A']} />
          <fog attach="fog" args={['#05060A', 18, 42]} />

          {/* Studio Key & Rim Lighting for Glass Specular Highlights */}
          <ambientLight intensity={0.65} />
          <directionalLight position={[6, 9, 8]} intensity={1.8} color="#e0f2fe" />
          <directionalLight position={[-7, -3, 5]} intensity={0.9} color="#818cf8" />
          <pointLight position={[0, 3.5, 6]} intensity={1.35} color="#38bdf8" distance={26} />

          {/* Ambient Micro-Particles */}
          <Sparkles
            count={reducedMotion ? 0 : 75}
            scale={[24, 12, 16]}
            size={1.4}
            speed={0.22}
            opacity={0.35}
            color="#94a3b8"
          />

          {/* Reflective Dark Spatial Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.4, 0]}>
            <planeGeometry args={[60, 60]} />
            <meshStandardMaterial color="#060810" roughness={0.35} metalness={0.65} />
          </mesh>

          <SpatialCameraController reducedMotion={reducedMotion} />
          <SpatialHubCarousel reducedMotion={reducedMotion} />

          {activeSpace === 'pipeline' && <PipelineContent />}
          {activeSpace === 'tree' && <MergeTreeContent embedded />}
          {activeSpace === 'vectors' && <VectorGalaxy3D reducedMotion={reducedMotion} />}
          {activeSpace === 'arena' && <ModelArena3D />}

          <SpatialInspector3D />
          <MergeBurst3D reducedMotion={reducedMotion} />
        </Canvas>
      </div>
    </CanvasErrorBoundary>
  )
}
