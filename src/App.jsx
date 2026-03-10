
import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import JoinRoom from './pages/JoinRoom/JoinRoom'
import ChatRoom from './pages/ChatRoom/ChatRoom'

function App() {
  return (
    <div className="appShell">
      <Routes>
        <Route path="/" element={<JoinRoom />} />
        <Route path="/chat" element={<ChatRoom />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
