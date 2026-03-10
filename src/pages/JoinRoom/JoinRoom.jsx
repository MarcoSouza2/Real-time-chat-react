import { useState } from "react"
import { useNavigate } from "react-router-dom"
import "./style.css"

const API_BASE_URL = "http://192.168.100.23:3333"

function resolveAvatarUrl(relativeUrl) {
  if (!relativeUrl) return null
  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) {
    return relativeUrl
  }
  return `${API_BASE_URL}${relativeUrl}`
}

export default function JoinRoom() {

  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [roomId, setRoomId] = useState("")
  const [avatar, setAvatar] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    if (!name || !roomId) return

    try {
      setIsSubmitting(true)

      let avatarUrl = null

      // 1) Upload do avatar (POST /uploads/avatar)
      if (avatar) {
        const form = new FormData()
        form.append("file", avatar)

        const uploadResponse = await fetch(`${API_BASE_URL}/uploads/avatar`, {
          method: "POST",
          body: form,
        })

        if (!uploadResponse.ok) {
          throw new Error("Falha ao enviar avatar")
        }

        const uploadData = await uploadResponse.json()
        avatarUrl = resolveAvatarUrl(uploadData?.avatarUrl ?? null)
      }

      // 2) Criar sessão (POST /sessions)
      const sessionResponse = await fetch(`${API_BASE_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          roomId,
          avatarUrl, // ou null se não fez upload
        }),
      })

      if (!sessionResponse.ok) {
        throw new Error("Não foi possível entrar na sala")
      }

      const session = await sessionResponse.json()

      // Respeita o contrato do material
      const data = {
        name: session?.user?.name ?? name,
        roomId: session?.roomId ?? roomId,
        userId: session?.userId,
        userAvatarUrl: resolveAvatarUrl(session?.user?.avatarUrl ?? avatarUrl),
        wsUrl: session?.wsUrl,
      }

      navigate("/chat", { state: data })
    } catch (err) {
      console.error(err)
      setError("Erro ao conectar. Tente novamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page joinPage">
      <div className="card joinCard">
        <div className="cardHeader">
          <h1 className="joinTitle">Entrar na sala</h1>
          <p className="joinSubtitle">Informe seu nome, avatar e a sala.</p>
        </div>

        <div className="cardBody">
          <form className="joinForm" onSubmit={handleSubmit}>

            <label className="field">
              <span className="label">Nome</span>
              <input
                className="input"
                placeholder="Ex: Maria"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span className="label">Avatar</span>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
              />
            </label>

            <label className="field">
              <span className="label">Sala</span>
              <input
                className="input"
                placeholder="Ex: sala-frontend"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
              />
            </label>

            {error && <p className="joinError">{error}</p>}

            <button className="primaryBtn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Conectando..." : "Conectar"}
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}
