import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import Profile from './pages/Profile'
import Customize from './pages/Customize'
import AdminCustomize from './pages/AdminCustomize'
import Login from './pages/Login'
import Register from './pages/Register'
import GoogleSetup from './pages/GoogleSetup'
import Settings from './pages/Settings'
import Archive from './pages/Archive'
import AdminArchive from './pages/AdminArchive'
import Landing from './pages/Landing'
import Users from './pages/Users'

export default function App(){
  return (
    <Routes>
      <Route path="/" element={<Landing/>} />
      <Route path="/dashboard" element={<Dashboard/>} />
      <Route path="/admin/dashboard" element={<AdminDashboard/>} />
      <Route path="/landing" element={<Landing/>} />
      <Route path="/profile" element={<Profile/>} />
      <Route path="/login" element={<Login/>} />
      <Route path="/register" element={<Register/>} />
      <Route path="/setup" element={<GoogleSetup/>} />
      <Route path="/settings" element={<Settings/>} />
      <Route path="/archive" element={<Archive/>} />
      <Route path="/admin/archive" element={<AdminArchive/>} />
      <Route path="/customize" element={<Customize/>} />
      <Route path="/admin/customize" element={<AdminCustomize/>} />
      <Route path="/users" element={<Users/>} />
      <Route path="/admin/users" element={<Users/>} />
    </Routes>
  )
}
