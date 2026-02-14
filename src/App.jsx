import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getApp, performLogout } from './utils/authManager'
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
  const location = useLocation();

  useEffect(() => {
    // Session Expiration Logic
    //const INACTIVITY_LIMIT_MS = 60 * 1000; // 1 minute for testing
    const INACTIVITY_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours (Production)
    
    let timeoutId;
    const app = getApp();
    const auth = getAuth(app);

    const checkInactivity = async () => {
      const lastActivity = Number(localStorage.getItem('sb_last_activity') || 0);
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;

      if (timeSinceLastActivity < INACTIVITY_LIMIT_MS) {
        // Activity happened recently (possibly in another tab)
        const remainingTime = INACTIVITY_LIMIT_MS - timeSinceLastActivity;
        timeoutId = setTimeout(checkInactivity, Math.max(1000, remainingTime));
      } else {
        // Really inactive
        console.log('Session expired due to inactivity.');
        await performLogout();
      }
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(checkInactivity, INACTIVITY_LIMIT_MS);
    };

    const handleActivity = () => {
      localStorage.setItem('sb_last_activity', Date.now().toString());
      resetTimer();
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Initialize last activity
        localStorage.setItem('sb_last_activity', Date.now().toString());
        resetTimer();
        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('click', handleActivity);
        window.addEventListener('scroll', handleActivity);
      } else {
        if (timeoutId) clearTimeout(timeoutId);
        window.removeEventListener('mousemove', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('click', handleActivity);
        window.removeEventListener('scroll', handleActivity);
      }
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, []);

  useEffect(() => {
    // Exclude dark mode on Landing, Login, Register
    const excludedRoutes = ['/', '/landing', '/login', '/register', '/setup'];
    const isExcluded = excludedRoutes.includes(location.pathname);

    if (isExcluded) {
       document.documentElement.classList.remove('dark');
    } else {
       // Apply saved theme if not excluded
       const savedTheme = localStorage.getItem('sb-theme') || 'light'
       if (savedTheme === 'dark') {
         document.documentElement.classList.add('dark')
       } else {
         document.documentElement.classList.remove('dark')
       }
    }
  }, [location]) // Re-run on location change

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
