import { RoundedBox, Text } from '@react-three/drei'
import { useEffect } from 'react'
import { useStudioStore } from '../../store/useStudioStore'

const MODEL_COLORS = ['#38bdf8', '#34d399', '#a78bfa', '#fbbf24']

export function ModelArenaPreview3D() {
  const comparison = useStudioStore((s) => s.comparison)
  const inputText = useStudioStore((s) => s.inputText)
  const runComparison = useStudioStore((s) => s.runComparison)

  useEffect(() => {
    void runComparison()
  }, [inputText, runComparison])

  const models = comparison?.models ?? []
  const maxTokens = Math.max(1, ...models.map((m) => m.token_count))

  return (
    <group position={[0, -0.4, 0]}>
      {models.map((model, idx) => {
        const x = (idx - (models.length - 1) / 2) * 2.55
        const color = MODEL_COLORS[idx % MODEL_COLORS.length]
        const totalHeight = Math.max(0.8, (model.token_count / maxTokens) * 3.4)
        const sliceCount = Math.min(model.token_count, 12)
        const sliceHeight = totalHeight / Math.max(1, sliceCount)

        return (
          <group key={model.model_id} position={[x, 0, 0]}>
            {Array.from({ length: sliceCount }).map((_, sIdx) => (
              <RoundedBox
                key={sIdx}
                args={[1.25, Math.max(0.12, sliceHeight - 0.05), 0.72]}
                radius={0.06}
                smoothness={4}
                position={[0, sIdx * sliceHeight + sliceHeight / 2, 0]}
              >
                <meshPhysicalMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.35 + (sIdx / Math.max(1, sliceCount)) * 0.25}
                  roughness={0.14}
                  metalness={0.12}
                  transparent
                  opacity={0.78}
                />
              </RoundedBox>
            ))}

            <Text
              position={[0, totalHeight + 0.42, 0]}
              fontSize={0.22}
              color="#f8fafc"
              anchorX="center"
              anchorY="middle"
            >
              {`${model.token_count} tokens`}
            </Text>
            <Text
              position={[0, -0.35, 0.2]}
              fontSize={0.2}
              color={color}
              anchorX="center"
              anchorY="middle"
            >
              {model.display_name}
            </Text>
            <Text
              position={[0, -0.62, 0.2]}
              fontSize={0.14}
              color="#94a3b8"
              anchorX="center"
              anchorY="middle"
            >
              {`${model.fertility.toFixed(2)}× fertility`}
            </Text>
          </group>
        )
      })}
    </group>
  )
}
