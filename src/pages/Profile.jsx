import React, { useEffect, useState } from 'react'
import { getAuth } from 'firebase/auth'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import '../styles/vendor/dashboard-style.css'
import '../styles/vendor/header.css'
import '../styles/vendor/profile.css'

export default function Profile() {
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    role: '',
    phone: '',
    address: '',
    city: '',
    photoURL: ''
  })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const app = initFirebase()
        const auth = getAuth(app)
        const db = getFirestore(app)

        let mounted = true

        const fetchProfile = async (user) => {
            try {
                const docRef = doc(db, 'users', user.uid)
                const docSnap = await getDoc(docRef)
                const data = docSnap.exists() ? docSnap.data() : {}

                const firstName = data.firstName || ''
                const lastName = data.lastName || ''
                const displayName = user.displayName || `${firstName} ${lastName}`.trim() || 'User'

                if (!mounted) return

                setProfileData({
                    firstName: data.firstName || '—',
                    lastName: data.lastName || '—',
                    username: data.username || user.email?.split('@')[0] || '—',
                    email: user.email || '—',
                    role: data.role || 'User',
                    phone: data.phone || '—',
                    address: data.address || '—',
                    city: data.city || '—',
                    displayName: displayName,
                    photoURL: user.photoURL,
                    initials: ((firstName || displayName).split(' ').map(n => n[0]).join('') || (user.email || 'U')[0]).toUpperCase().slice(0, 2)
                })
            } catch (err) {
                console.error('Error fetching profile:', err)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        const currentUser = auth.currentUser
        if (currentUser) {
            // Auth already available; fetch immediately and avoid full-screen loading.
            fetchProfile(currentUser)
            return () => { mounted = false }
        }

        // If auth isn't ready yet, show loading until it resolves.
        setLoading(true)
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                fetchProfile(user)
            } else {
                window.location.href = '/login'
            }
        })

        return () => {
            mounted = false
            unsubscribe()
        }
    }, [])

    return (
        <div className="profile-page">
                <Header />
        <div className="dashboard-wrapper">
            <Sidebar />
            
            <main className="main-content">
                <div className="dashboard-content">
                    {loading ? (
                        <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'50vh', width:'100%'}}>
                            Loading...
                        </div>
                    ) : (
                        <>
                    {/* Profile Header */}
                    <div className="profile-header">
                        <h1 className="profile-title">My Profile</h1>
                    </div>

                    {/* Profile Card */}
                    <div className="profile-card">
                        <div className="profile-card__avatar-section">
                            <div className="profile-avatar" id="profile-avatar">
                                {profileData.photoURL ? (
                                    <img src={profileData.photoURL} alt="Profile Avatar" style={{display:'block'}} />
                                ) : (
                                    <span className="initials">{profileData.initials}</span>
                                )}
                            </div>
                            <div className="profile-card__info">
                                <h2 className="profile-card__name">{profileData.displayName}</h2>
                                <p className="profile-card__email">{profileData.email}</p>
                                <p className="profile-card__role">{profileData.role}</p>
                                <p className="profile-card__identifier">{profileData.username}</p>
                            </div>
                        </div>
                    </div>

                    {/* Personal Information Section */}
                    <div className="profile-section">
                        <div className="section-header">
                            <h3 className="section-title">Personal Information</h3>
                        </div>

                        {/* Personal Info Grid */}
                        <div className="profile-info-grid">
                            <div className="info-field">
                                <label className="info-label">First Name</label>
                                <p className="info-value">{profileData.firstName}</p>
                            </div>
                            <div className="info-field">
                                <label className="info-label">Last Name</label>
                                <p className="info-value">{profileData.lastName}</p>
                            </div>
                            <div className="info-field">
                                <label className="info-label">Username</label>
                                <p className="info-value">{profileData.username}</p>
                            </div>

                            <div className="info-field">
                                <label className="info-label">Email Address</label>
                                <p className="info-value">{profileData.email}</p>
                            </div>
                            <div className="info-field">
                                <label className="info-label">Phone Number</label>
                                <p className="info-value">{profileData.phone}</p>
                            </div>
                            <div className="info-field">
                                <label className="info-label">User Role</label>
                                <p className="info-value">{profileData.role}</p>
                            </div>
                        </div>
                    </div>

                    {/* Address Section */}
                    <div className="profile-section address-section">
                        <h3 className="section-title">Address</h3>

                        <div className="profile-info-grid">
                            <div className="info-field address-field">
                                <label className="info-label">Address</label>
                                <p className="info-value">{profileData.address}</p>
                            </div>
                            <div className="info-field city-field">
                                <label className="info-label">City</label>
                                <p className="info-value">{profileData.city}</p>
                            </div>
                        </div>
                    </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    </div>
  )
}
