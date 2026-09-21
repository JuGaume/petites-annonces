import { CaretLeft, PaperPlaneTilt } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { HubConnection } from '@microsoft/signalr'
import { useAuth } from '../auth/AuthContext'
import { apiJson, ApiError, type ConversationResponse, type MessageResponse } from '../lib/apiClient'
import { connectToConversation } from '../lib/conversationsHub'

// Mêmes teintes pastel que les avatars de groupe/conversations.
const AVATAR_TINTS = [
  { bg: '#FDE7D3', text: '#C2410C' },
  { bg: '#DBEAFE', text: '#2563EB' },
  { bg: '#FCE7F3', text: '#BE185C' },
  { bg: '#DCFCE7', text: '#15803D' },
  { bg: '#EDE9FE', text: '#6D28D9' },
  { bg: '#CFFAFE', text: '#0E7490' },
]

function avatarTint(id: string) {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return AVATAR_TINTS[sum % AVATAR_TINTS.length]
}

export function ConversationThreadPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const { user } = useAuth()

  const [conversations, setConversations] = useState<ConversationResponse[] | null>(null)
  const [messages, setMessages] = useState<MessageResponse[]>([])
  const [draft, setDraft] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const seenMessageIds = useRef(new Set<number>())

  function appendMessage(message: MessageResponse) {
    if (seenMessageIds.current.has(message.id)) {
      return
    }
    seenMessageIds.current.add(message.id)
    setMessages((current) => [...current, message])
  }

  // La liste des conversations donne le nom de l'autre partie et le titre de l'annonce
  // sans endpoint de détail dédié.
  useEffect(() => {
    apiJson<ConversationResponse[]>('/conversations').then(setConversations).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!conversationId) {
      return
    }

    seenMessageIds.current = new Set()
    setMessages([])
    setLoadError(null)

    apiJson<MessageResponse[]>(`/conversations/${conversationId}/messages`)
      .then((history) => {
        history.forEach((message) => seenMessageIds.current.add(message.id))
        setMessages(history)
      })
      .catch(() => setLoadError('Impossible de charger cette conversation.'))

    let connection: HubConnection | undefined
    connectToConversation(Number(conversationId), appendMessage)
      .then((c) => {
        connection = c
      })
      .catch(() => setLoadError('Connexion temps réel indisponible — les messages resteront visibles après rechargement.'))

    return () => {
      connection?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim() || !conversationId) {
      return
    }

    setSendError(null)
    setIsSending(true)
    try {
      const message = await apiJson<MessageResponse>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: draft.trim() }),
      })
      appendMessage(message)
      setDraft('')
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Impossible d'envoyer le message.")
    } finally {
      setIsSending(false)
    }
  }

  const conversation = conversations?.find((c) => c.id === Number(conversationId))
  const otherPartyId = conversation
    ? conversation.buyerUserId === user?.id
      ? conversation.sellerUserId
      : conversation.buyerUserId
    : null
  const otherPartyName = conversation
    ? conversation.buyerUserId === user?.id
      ? conversation.sellerDisplayName
      : conversation.buyerDisplayName
    : null
  const tint = otherPartyId ? avatarTint(otherPartyId) : AVATAR_TINTS[0]

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="flex flex-none items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5">
        <Link to="/conversations" aria-label="Messages" className="flex-none">
          <CaretLeft size={20} weight="bold" />
        </Link>
        <div
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold"
          style={{ background: tint.bg, color: tint.text }}
        >
          {otherPartyName?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold">{otherPartyName ?? 'Conversation'}</h1>
          {conversation && <p className="truncate text-xs text-[var(--color-text-muted)]">{conversation.listingTitle}</p>}
        </div>
      </div>

      {loadError && <p className="px-4 pt-2 text-sm text-red-600">{loadError}</p>}

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
        {messages.map((message) => {
          const isMine = message.authorUserId === user?.id
          return (
            <div
              key={message.id}
              className={
                isMine
                  ? 'max-w-[78%] self-end rounded-[14px_14px_4px_14px] bg-[var(--color-gold)] px-3.5 py-2.5 text-sm leading-snug text-[var(--color-accent)]'
                  : 'max-w-[78%] self-start rounded-[14px_14px_14px_4px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm leading-snug'
              }
            >
              {message.content}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {sendError && <p className="px-4 pb-2 text-sm text-red-600">{sendError}</p>}

      <form onSubmit={handleSubmit} className="flex flex-none items-center gap-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 pb-6">
        <input
          type="text"
          placeholder="Écrire un message..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-sm placeholder:text-[#9ca3af]"
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          aria-label="Envoyer"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--color-gold)] disabled:opacity-60"
        >
          <PaperPlaneTilt size={16} weight="bold" color="var(--color-accent)" />
        </button>
      </form>
    </main>
  )
}
