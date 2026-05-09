import { Routes, Route, Navigate } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import Landing from './pages/Landing'
import Main from './pages/Main'
import MyPage from './pages/MyPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<RequireAuth><Main /></RequireAuth>} />
      <Route path="/mypage" element={<RequireAuth><MyPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
