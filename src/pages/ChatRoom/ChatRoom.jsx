import { useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import "./style.css"

const API_BASE_URL = "http://192.168.100.23:3333"

function buildInitials(name) {
  const cleaned = (name ?? "").trim()
  if (!cleaned) return "?"
  const parts = cleaned.split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase()).join("")
}

function normalizeAvatarUrl(url) {
  if (!url) return null
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  return `${API_BASE_URL}${url}`
}

export default function ChatRoom() {
  const navigate = useNavigate()
  const { state } = useLocation()

  const name = state?.name ?? ""
  const roomId = state?.roomId ?? ""
  const wsUrl = state?.wsUrl
  const userAvatarUrl = normalizeAvatarUrl(state?.userAvatarUrl)

  const [text, setText] = useState("")
  const [messages, setMessages] = useState([])
  const [participants, setParticipants] = useState([])
  const [connectionError, setConnectionError] = useState("")

  const me = useMemo(
    () => ({ name, initials: buildInitials(name), avatarUrl: userAvatarUrl }),
    [name, userAvatarUrl],
  )

  const listRef = useRef(null)
  const socketRef = useRef(null)
  const pendingMessagesRef = useRef([])
  const optimisticKeysRef = useRef(new Set())

  function sendSocketMessage(content) {
    const payload = {
      type: "message.send",
      content,
    }

    if (!socketRef.current) {
      pendingMessagesRef.current.push(payload)
      setConnectionError("Conectando ao chat. Sua mensagem sera enviada assim que a conexao abrir.")
      return
    }

    if (socketRef.current.readyState !== WebSocket.OPEN) {
      pendingMessagesRef.current.push(payload)
      return
    }

    socketRef.current.send(JSON.stringify(payload))
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [messages.length])

  useEffect(() => {
    if (!roomId) return

    let cancelled = false

    async function loadHistory() {
      try {
        const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/messages`)
        if (!response.ok) return

        const data = await response.json()
        if (cancelled) return

        const list = data?.messages ?? []
        const formatted = list.map((msg) => ({
          id: msg.id,
          author: msg.userName ?? msg.user?.name ?? "Usuario",
          content: msg.content,
          avatarUrl: normalizeAvatarUrl(msg.userAvatarUrl ?? msg.user?.avatarUrl),
        }))

        setMessages(formatted)
      } catch (err) {
        console.error("Erro ao carregar mensagens:", err)
      }
    }

    async function loadParticipants() {
      try {
        const response = await fetch(`${API_BASE_URL}/rooms/${roomId}/participants`)
        if (!response.ok) return

        const data = await response.json()
        if (cancelled) return

        const list = data?.participants ?? []
        setParticipants(list.map((participant) => ({
          id: participant.id,
          name: participant.name,
          avatarUrl: normalizeAvatarUrl(participant.avatarUrl),
        })))
      } catch (err) {
        console.error("Erro ao carregar participantes:", err)
      }
    }

    function connectSocket() {
      if (!wsUrl) return

      try {
        const socket = new WebSocket(wsUrl)
        socketRef.current = socket

        socket.addEventListener("open", () => {
          setConnectionError("")

          if (pendingMessagesRef.current.length > 0) {
            pendingMessagesRef.current.forEach((payload) => {
              socket.send(JSON.stringify(payload))
            })
            pendingMessagesRef.current = []
          }
        })

        socket.addEventListener("message", (event) => {
          try {
            const payload = JSON.parse(event.data)

            switch (payload.type) {
              case "room.joined": {
                const list = payload.participants ?? []
                setParticipants(list.map((participant) => ({
                  id: participant.id,
                  name: participant.name,
                  avatarUrl: normalizeAvatarUrl(participant.avatarUrl),
                })))
                break
              }
              case "participant.joined": {
                const participant = payload.participant
                if (!participant) break

                setParticipants((prev) => {
                  if (prev.some((item) => item.id === participant.id)) return prev

                  return [
                    ...prev,
                    {
                      id: participant.id,
                      name: participant.name,
                      avatarUrl: normalizeAvatarUrl(participant.avatarUrl),
                    },
                  ]
                })
                break
              }
              case "participant.left": {
                const participantId = payload.participantId
                if (!participantId) break

                setParticipants((prev) => prev.filter((participant) => participant.id !== participantId))
                break
              }
              case "message.new": {
                const msg = payload.message ?? payload
                const author = msg.userName ?? msg.user?.name ?? "Usuario"
                const content = msg.content ?? ""
                const optimisticKey = `${author}::${content}`

                setMessages((prev) => {
                  const withoutOptimistic = optimisticKeysRef.current.has(optimisticKey)
                    ? prev.filter((item) => !(item.author === author && item.content === content))
                    : prev

                  optimisticKeysRef.current.delete(optimisticKey)

                  return [
                    ...withoutOptimistic,
                    {
                      id: msg.id ?? crypto.randomUUID(),
                      author,
                      content,
                      avatarUrl: normalizeAvatarUrl(msg.userAvatarUrl ?? msg.user?.avatarUrl),
                    },
                  ]
                })
                break
              }
              case "error": {
                setConnectionError(payload.message || "Algo deu errado no chat.")
                break
              }
              default:
                break
            }
          } catch (err) {
            console.error("Erro ao processar mensagem:", err)
          }
        })

        socket.addEventListener("error", () => {
          setConnectionError("Erro de conexao com o chat.")
        })

        socket.addEventListener("close", () => {
          socketRef.current = null
        })
      } catch (err) {
        console.error("Erro ao abrir WebSocket:", err)
        setConnectionError("Erro de conexao com o chat.")
      }
    }

    loadHistory()
    loadParticipants()
    connectSocket()

    return () => {
      cancelled = true
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [roomId, wsUrl])

  if (!state) return <Navigate to="/" replace />

  function handleSend(e) {
    e.preventDefault()
    const content = text.trim()
    if (!content) return

    const localMessage = {
      id: crypto.randomUUID(),
      author: me.name || "Voce",
      content,
      avatarUrl: me.avatarUrl,
    }

    optimisticKeysRef.current.add(`${localMessage.author}::${localMessage.content}`)
    setMessages((prev) => [...prev, localMessage])

    try {
      sendSocketMessage(content)
    } catch (err) {
      console.error("Erro ao enviar mensagem pelo WebSocket:", err)
      setConnectionError("Nao foi possivel enviar a mensagem.")
      optimisticKeysRef.current.delete(`${localMessage.author}::${localMessage.content}`)
    }

    setText("")
  }

  return (
    <div className="page chatPage">
      <div className="card chatCard">
        <div className="cardHeader chatHeader">
          <div className="chatHeaderLeft">
            <div className="avatarBubble" aria-hidden="true">
              {me.avatarUrl
                ? <img className="avatarImage" src={me.avatarUrl} alt={me.name || "Avatar"} />
                : me.initials}
            </div>
            <div className="chatHeaderMeta">
              <div className="chatTitle">Sala: {roomId || "-"}</div>
              <div className="chatSubtitle">Online: {me.name || "Anonimo"}</div>
            </div>
          </div>

          <button className="ghostBtn" type="button" onClick={() => navigate("/")}>
            Sair
          </button>
        </div>

        <div className="cardBody chatBody">
          {connectionError && <p className="chatError">{connectionError}</p>}

          {participants.length > 0 && (
            <div className="participantsBar">
              <span className="participantsLabel">Participantes:</span>
              <div className="participantsList">
                {participants.map((participant) => (
                  <div key={participant.id} className="participantChip">
                    <div className="participantAvatar">
                      {participant.avatarUrl
                        ? <img className="participantAvatarImage" src={participant.avatarUrl} alt={participant.name} />
                        : <span className="participantAvatarInitials">{buildInitials(participant.name)}</span>}
                    </div>
                    <span className="participantName">{participant.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={listRef} className="messages">
            {messages.map((message) => {
              const isMe = message.author === (me.name || "Voce")
              return (
                <div key={message.id} className={`msgRow ${isMe ? "me" : ""}`}>
                  {!isMe && (
                    <div className="msgAvatar">
                      {message.avatarUrl
                        ? <img className="msgAvatarImage" src={message.avatarUrl} alt={message.author} />
                        : <span className="msgAvatarInitials">{buildInitials(message.author)}</span>}
                    </div>
                  )}
                  <div className="msgBubble">
                    <div className="msgAuthor">{message.author}</div>
                    <div className="msgContent">{message.content}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <form className="composer" onSubmit={handleSend}>
            <input
              className="input"
              placeholder="Digite uma mensagem..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="sendBtn" type="submit">Enviar</button>
          </form>
        </div>
      </div>
    </div>
  )
}
