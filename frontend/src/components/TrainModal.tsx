import { AnimatePresence, motion } from 'framer-motion'
import { Cpu, Loader2, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { useStudioStore } from '../store/useStudioStore'

const SAMPLE_CORPUS = `Tokenization makes AI read!
BPE merges frequent pairs like "ing", "tion", "ed", and "token".
banana bandana banana cabana!
def tokenize(text: str):
    return [ord(c) for c in text]`

export function TrainModal() {
  const isOpen = useStudioStore((s) => s.isTrainModalOpen)
  const setOpen = useStudioStore((s) => s.setTrainModalOpen)
  const isTraining = useStudioStore((s) => s.isTraining)
  const trainCustomTokenizer = useStudioStore((s) => s.trainCustomTokenizer)
  const lastTrainResult = useStudioStore((s) => s.lastTrainResult)
  const activeTokenizerId = useStudioStore((s) => s.activeTokenizerId)
  const customTokenizers = useStudioStore((s) => s.customTokenizers)
  const setActiveTokenizerId = useStudioStore((s) => s.setActiveTokenizerId)
  const fetchAnalysisAndEmbeddings = useStudioStore((s) => s.fetchAnalysisAndEmbeddings)

  const [name, setName] = useState('My Custom BPE')
  const [corpus, setCorpus] = useState(SAMPLE_CORPUS)
  const [numMerges, setNumMerges] = useState(40)
  const [useRegex, setUseRegex] = useState(true)

  const handleTrain = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!corpus.trim()) return
    await trainCustomTokenizer(corpus, numMerges, useRegex, name)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="train-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.section
            key="train-modal"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Train Custom BPE Tokenizer"
            className="glass-panel-heavy flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.1] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30">
                  <Cpu className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-white">
                    Train Custom BPE Tokenizer
                  </h2>
                  <p className="text-[12px] text-white/55">
                    Paste your own corpus and watch BPE learn merge rules from scratch
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close trainer modal"
                className="pressable flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={(e) => void handleTrain(e)} className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* Switch Active Tokenizer */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-medium text-white/55">Active:</span>
                {customTokenizers.map((tok) => {
                  const active = tok.id === activeTokenizerId
                  return (
                    <button
                      key={tok.id}
                      type="button"
                      onClick={() => {
                        setActiveTokenizerId(tok.id)
                        void fetchAnalysisAndEmbeddings()
                      }}
                      className={`pressable rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                        active
                          ? 'bg-emerald-400/20 text-emerald-200 ring-emerald-400/40'
                          : 'bg-white/[0.05] text-white/70 ring-white/[0.1] hover:bg-white/[0.1]'
                      }`}
                    >
                      {tok.name} ({tok.vocabSize})
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-white/65">
                    Tokenizer Name
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.12] bg-white/[0.05] px-3 py-2 text-[13px] text-white focus:border-sky-400/50 focus:outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-white/65">
                    <span>Number of Merges</span>
                    <span className="font-mono-tech text-sky-300">{numMerges}</span>
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={150}
                    step={5}
                    value={numMerges}
                    onChange={(e) => setNumMerges(Number(e.target.value))}
                    className="mt-2 w-full accent-sky-400"
                  />
                </label>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-white/65">
                    Training Corpus
                  </span>
                  <button
                    type="button"
                    onClick={() => setCorpus(SAMPLE_CORPUS)}
                    className="text-[11px] text-sky-300 hover:underline"
                  >
                    Load Sample
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={corpus}
                  onChange={(e) => setCorpus(e.target.value)}
                  className="font-mono-tech w-full rounded-2xl border border-white/[0.12] bg-white/[0.05] p-3 text-[12px] text-white placeholder:text-white/35 focus:border-sky-400/50 focus:outline-none"
                  placeholder="Paste any text, code, or multilingual sentences..."
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-white/80">
                  <input
                    type="checkbox"
                    checked={useRegex}
                    onChange={(e) => setUseRegex(e.target.checked)}
                    className="h-4 w-4 rounded accent-sky-400"
                  />
                  Use GPT-4 regex pre-tokenization
                </label>

                <button
                  type="submit"
                  disabled={isTraining || !corpus.trim()}
                  className="pressable flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-4 py-2 text-[12px] font-semibold text-emerald-200 ring-1 ring-emerald-400/40 hover:bg-emerald-400/30 disabled:opacity-50"
                >
                  {isTraining ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Train & Activate
                </button>
              </div>

              {lastTrainResult && (
                <div className="rounded-2xl border border-white/[0.1] bg-white/[0.04] p-3.5">
                  <div className="mb-2 flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-emerald-300">
                      Learned {lastTrainResult.merges_learned} merge rules ({lastTrainResult.name})
                    </span>
                    <span className="font-mono-tech text-white/60">
                      vocab {lastTrainResult.vocab_size}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {lastTrainResult.merge_history.slice(0, 12).map((m) => (
                      <span
                        key={m.step}
                        className="font-mono-tech rounded-lg bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/85 ring-1 ring-white/[0.08]"
                      >
                        #{m.new_id} &ldquo;{m.merged_text}&rdquo; (×{m.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
