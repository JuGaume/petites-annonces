import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { HubConnection } from '@microsoft/signalr'
import { useAuth } from '../auth/AuthContext'
import { apiJson, ApiError, type ConversationResponse, type MessageResponse } from '../lib/apiClient'
import { connectToConversation } from '../lib/conversationsHub'

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
  const otherPartyName = conversation
    ? conversation.buyerUserId === user?.id
      ? conversation.sellerDisplayName
      : conversation.buyerDisplayName
    : null

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-8 md:max-w-2xl">
      <Link to="/conversations" className="mb-2 text-sm text-[var(--color-text-muted)]">
        ← Messages
      </Link>

      <div className="mb-4">
        <h1 className="text-xl font-semibold">{otherPartyName ?? 'Conversation'}</h1>
        {conversation && <p className="text-sm text-[var(--color-text-muted)]">{conversation.listingTitle}</p>}
      </div>

      {loadError && <p className="mb-2 text-sm text-red-600">{loadError}</p>}

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {messages.map((message) => {
          const isMine = message.authorUserId === user?.id
          return (
            <div
              key={message.id}
              className={`max-w-[75%] rounded px-3 py-2 text-sm ${
                isMine
                  ? 'self-end bg-[var(--color-accent)] text-white'
                  : 'self-start bg-[var(--color-surface)] text-[var(--color-text)]'
              }`}
            >
              {message.content}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {sendError && <p className="mt-2 text-sm text-red-600">{sendError}</p>}

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          placeholder="Écrire un message..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="rounded bg-[var(--color-accent)] px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          Envoyer
        </button>
      </form>
    </main>
  )
}
