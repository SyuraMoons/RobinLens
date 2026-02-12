import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Volume2, VolumeX, Mic } from 'lucide-react'
import {
  askSupportAgent,
  type SupportMessage,
  type SupportAgentResponse,
} from '../lib/supportAssistant'
import { useSectionContext } from '../lib/sectionContext'

type Role = 'user' | 'assistant'

interface ChatMessage {
  id: number
  role: Role
  content: string
  suggestedActions?: string[]
  followUpQuestions?: string[]
}

export function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [muted, setMuted] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: 'assistant',
      content:
        'Hi, I’m your **RobinLens AI Assistant**.\n\nAsk me anything about how this app works or how to interpret the data.',
    },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const endRef = useRef<HTMLDivElement | null>(null)
  const idRef = useRef(2)
  const { text: sectionText } = useSectionContext()

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, isOpen])

  const toggleOpen = () => setIsOpen((prev) => !prev)

  const sendMessage = async (text?: string) => {
    if (loading) return

    const content = (text ?? input).trim()
    if (!content) return

    const userMsg: ChatMessage = {
      id: idRef.current++,
      role: 'user',
      content,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const history: SupportMessage[] = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const reply: SupportAgentResponse = await askSupportAgent(history, sectionText ?? null)

      const assistantMsg: ChatMessage = {
        id: idRef.current++,
        role: 'assistant',
        content: reply.textResponse,
        suggestedActions: reply.suggestedActions,
        followUpQuestions: reply.followUpQuestions,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage()
  }

  return (
    <>
      {/* Floating FAB */}
      <button
        type="button"
        onClick={toggleOpen}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-purple-700 via-fuchsia-600 to-indigo-600 text-white shadow-xl shadow-purple-900/50 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-purple-400"
      >
        <MessageCircle className="h-7 w-7" />
      </button>

      {/* Chat window */}
      <div
        className={`fixed bottom-24 right-5 z-40 w-[min(400px,calc(100vw-2.5rem))] transform transition-all duration-200 ${
          isOpen
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-3 opacity-0'
        }`}
      >
        <div className="flex h-[60vh] flex-col overflow-hidden rounded-3xl border border-purple-500/40 bg-gradient-to-b from-[#0f0518]/95 via-[#1a0b2e]/95 to-[#2e1065]/95 text-gray-100 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/80">
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">AI Assistant</span>
                <span className="text-[11px] text-purple-200/80">
                  Beta · answers from app context
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-200 hover:bg-white/10"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={toggleOpen}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-200 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                suggestedActions={m.suggestedActions}
                followUpQuestions={m.followUpQuestions}
                onFollowUpClick={(q) => sendMessage(q)}
              />
            ))}

            {loading && (
              <div className="flex items-start gap-2">
                <div className="mt-1 h-7 w-7 rounded-full bg-purple-500/80" />
                <div className="flex items-center gap-1 text-xs text-gray-300">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-300 [animation-delay:0.3s]" />
                  <span className="ml-1">Thinking…</span>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-300">{error}</p>}

            <div ref={endRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-white/10 bg-[#0b0413]/90 px-3 py-2"
          >
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 bg-transparent text-xs text-gray-100 placeholder:text-gray-400 focus:outline-none"
              />
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-gray-200 hover:bg-white/20"
              >
                <Mic className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

interface MessageBubbleProps {
  role: Role
  content: string
  suggestedActions?: string[]
  followUpQuestions?: string[]
  onFollowUpClick: (q: string) => void
}

function MessageBubble({
  role,
  content,
  suggestedActions,
  followUpQuestions,
  onFollowUpClick,
}: MessageBubbleProps) {
  const isUser = role === 'user'
  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-purple-600 text-white'
            : 'rounded-bl-sm border border-purple-500/50 bg-white/5 text-gray-100'
        }`}
      >
        <MarkdownText text={content} />

        {!isUser && suggestedActions && suggestedActions.length > 0 && (
          <div className="mt-2 border-t border-white/10 pt-1.5">
            <p className="mb-1 text-[10px] font-semibold text-purple-100">
              Recommended actions
            </p>
            <ul className="space-y-0.5 text-[10px] text-purple-50/90">
              {suggestedActions.map((a, idx) => (
                <li key={idx}>• {a}</li>
              ))}
            </ul>
          </div>
        )}

        {!isUser && followUpQuestions && followUpQuestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {followUpQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onFollowUpClick(q)}
                className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] text-purple-50 hover:bg-purple-500/30"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: React.ReactElement[] = []
  let currentList: string[] = []

  const flushList = () => {
    if (!currentList.length) return
    blocks.push(
      <ol key={`ol-${blocks.length}`} className="ml-4 list-decimal space-y-0.5">
        {currentList.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ol>,
    )
    currentList = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const listMatch = line.match(/^(\d+)\.\s+(.*)$/)
    if (listMatch) {
      currentList.push(listMatch[2])
      continue
    }
    if (!line) {
      flushList()
      blocks.push(<div key={`sp-${blocks.length}`} className="h-1" />)
      continue
    }
    flushList()
    blocks.push(
      <p key={`p-${blocks.length}`} className="mb-1">
        {renderInline(line)}
      </p>,
    )
  }
  flushList()
  return <>{blocks}</>
}

function renderInline(text: string) {
  const parts: React.ReactNode[] = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <strong key={parts.length} className="font-semibold text-white">
        {match[1]}
      </strong>,
    )
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

