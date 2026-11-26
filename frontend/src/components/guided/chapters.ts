import type {
  CameraPreset,
  DiagramView,
  LabMode,
  SpatialVolume,
  TreeCameraPreset,
} from '../../store/useStudioStore'

export interface GuidedChapter {
  id: string
  number: number
  title: string
  summary: string
  taskPrompt: string
  suggestedQuestion: string
  config: {
    activeSpace: SpatialVolume
    activeDiagram: DiagramView
    labMode: LabMode
    useRegex: boolean
    inputText: string
    cameraPreset?: CameraPreset
    treeCameraPreset?: TreeCameraPreset
    timelineStep?: number
  }
}

export const GUIDED_CHAPTERS: GuidedChapter[] = [
  {
    id: 'why-tokens',
    number: 1,
    title: "Why AI Can't Read Letters",
    summary:
      'Computers store text as UTF-8 bytes (numbers 0–255), not letters. LLMs then group those bytes into subword tokens and convert each token into an integer ID before doing any math.',
    taskPrompt:
      'Click any 3D subword block or Token ID to trace its glowing lineage back to raw UTF-8 bytes.',
    suggestedQuestion: 'Walk me through these 5 stages step by step',
    config: {
      activeSpace: 'pipeline',
      activeDiagram: 'pipeline',
      labMode: 'auto',
      useRegex: true,
      inputText: 'Tokenization makes AI read!',
      cameraPreset: 'bytes',
    },
  },
  {
    id: 'how-bpe-merges',
    number: 2,
    title: 'How BPE Builds Subwords',
    summary:
      'Byte-Pair Encoding (BPE) starts at Depth 0 with raw UTF-8 bytes and repeatedly merges the most frequent adjacent pair into a brand-new token ID (256+), forming a bottom-up binary merge forest.',
    taskPrompt:
      'Play or scrub the Merge Timeline to watch pairs combine, then click any merged node to inspect its Left & Right children.',
    suggestedQuestion: 'Animate how BPE merged this and explain the winning pair',
    config: {
      activeSpace: 'tree',
      activeDiagram: 'tree',
      labMode: 'auto',
      useRegex: true,
      inputText: 'Tokenization makes AI read!',
      treeCameraPreset: 'forest',
      timelineStep: 0,
    },
  },
  {
    id: 'manual-lab',
    number: 3,
    title: 'Hands-On: Mint Your Own Token',
    summary:
      'Now you are the tokenizer algorithm! Repeatedly merging frequent adjacent byte pairs compresses text into fewer, more meaningful tokens.',
    taskPrompt: 'Perform at least 1 manual merge to mint token #256.',
    suggestedQuestion: 'Which byte pair should I merge first and why?',
    config: {
      activeSpace: 'pipeline',
      activeDiagram: 'pipeline',
      labMode: 'manual',
      useRegex: true,
      inputText: 'banana bandana',
      cameraPreset: 'subwords',
    },
  },
  {
    id: 'multilingual-tax',
    number: 4,
    title: 'The Emoji & Multilingual Token Tax',
    summary:
      'An English letter takes 1 UTF-8 byte, while a single emoji (🚀) takes 4 bytes and Hindi characters take 3 bytes each. That means emojis and non-English scripts often split into more tokens—affecting LLM speed and cost.',
    taskPrompt:
      'Open Compare LLMs to compare GPT-4o (o200k), GPT-4 (cl100k), and our Educational BPE.',
    suggestedQuestion: 'Show why emojis and Hindi cost extra tokens',
    config: {
      activeSpace: 'arena',
      activeDiagram: 'pipeline',
      labMode: 'auto',
      useRegex: true,
      inputText: 'AI loves rockets 🚀✨ · नमस्ते',
      cameraPreset: 'bytes',
    },
  },
  {
    id: 'regex-and-vectors',
    number: 5,
    title: 'Regex Fences, Special Tokens & 3D Meaning',
    summary:
      'GPT-4 uses regex pre-tokenization so punctuation never fuses onto words, while special tokens like <|endoftext|> stay intact in warm amber. Finally, Stage 5 projects Token IDs into 3D space where similar concepts cluster together.',
    taskPrompt:
      'Toggle Regex Split OFF to see punctuation merge, or click 2 orbs in Stage 5 to measure their cosine similarity.',
    suggestedQuestion:
      'Explain what changes when Regex is OFF and how 3D vectors measure similarity',
    config: {
      activeSpace: 'vectors',
      activeDiagram: 'pipeline',
      labMode: 'auto',
      useRegex: true,
      inputText: 'dog. dog! dog? <|endoftext|>',
      cameraPreset: 'overview',
    },
  },
]
