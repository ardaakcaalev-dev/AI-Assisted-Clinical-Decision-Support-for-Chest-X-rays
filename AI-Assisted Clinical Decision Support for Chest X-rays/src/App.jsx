import { useState } from 'react'
import PatientDashboard from './components/PatientDashboard'
import DoctorDashboard from './components/DoctorDashboard'
import AdminDashboard from './components/AdminDashboard'
import './App.css'
import { API_URL } from './config'

function App() {
  const [view, setView] = useState('login') // 'login' or 'signup'
  const [role, setRole] = useState('patient') // 'patient' or 'doctor'
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)

  // Login States
  const [usernameOrTc, setUsernameOrTc] = useState('')
  const [password, setPassword] = useState('')
  
  // Signup-only States
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [specialty, setSpecialty] = useState('Kardiyoloji')
  const [institutionCode, setInstitutionCode] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // UI States
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [isShaking, setIsShaking] = useState(false)

  // Clear inputs when changing view or role to avoid stale state
  const resetFormState = (newView, newRole) => {
    setView(newView)
    setRole(newRole)
    setUsernameOrTc('')
    setPassword('')
    setFullName('')
    setEmail('')
    setInstitutionCode('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()

    if (!usernameOrTc || !password) {
      triggerShakeAndToast('Lütfen email ve şifrenizi girin!');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: usernameOrTc, password: password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.role !== role) {
          triggerShakeAndToast(`Hatalı giriş ekranı! Lütfen ${data.role === 'doctor' ? 'Hekim' : data.role === 'patient' ? 'Hasta' : 'Yönetici'} girişi sekmesini kullanın.`);
          return;
        }
        setUser({ 
           ...data.user, 
           fullName: `${data.user.first_name} ${data.user.last_name}`,
           role: data.role 
        });
        localStorage.setItem('token', data.access_token);
        setIsLoggedIn(true);
        showToast('Giriş Başarılı! Panelinize yönlendiriliyorsunuz.');
      } else {
        triggerShakeAndToast(data.detail || 'Geçersiz email veya şifre!');
      }
    } catch (error) {
      triggerShakeAndToast('Sunucuya bağlanılamadı. Backend açık mı?');
    }
  }

  const handleSignupSubmit = async (e) => {
    e.preventDefault()

    // Base fields check
    if (!fullName || !email || !password || !confirmPassword) {
      triggerShakeAndToast('Lütfen tüm alanları doldurun!')
      return
    }

    if (password !== confirmPassword) {
      triggerShakeAndToast('Şifreler uyuşmuyor!')
      return
    }

    // Split Full Name into First and Last
    const nameParts = fullName.trim().split(' ');
    const lastName = nameParts.length > 1 ? nameParts.pop() : 'SoyisimYok';
    const firstName = nameParts.join(' ');

    if (role === 'patient') {
      try {
        const response = await fetch(`${API_URL}/api/auth/register/patient`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email: email,
            password: password,
            national_id: usernameOrTc || "00000000000",
            date_of_birth: "1990-01-01",
            phone_number: "05550000000"
          })
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
           showToast('Kayıt Başarılı! Giriş yapabilirsiniz...');
           setTimeout(() => resetFormState('login', role), 2000);
        } else {
           triggerShakeAndToast(data.detail || 'Kayıt başarısız oldu.');
        }
      } catch (error) {
         triggerShakeAndToast('Sunucuya bağlanılamadı.');
      }
    } else {
       triggerShakeAndToast('Hekim kaydı şu an için aktif değil!');
    }
  }

  const triggerShakeAndToast = (message) => {
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 400)
    showToast(message)
  }

  const showToast = (message) => {
    setToastMessage(message)
    setTimeout(() => {
      setToastMessage('')
    }, 4000)
  }

  const specialtiesList = [
    'Kardiyoloji',
    'Göz Hastalıkları',
    'İç Hastalıkları (Dahiliye)',
    'Çocuk Sağlığı ve Hastalıkları',
    'Nöroloji',
    'Genel Cerrahi',
    'Ortopedi ve Travmatoloji',
    'Dermatoloji (Cildiye)',
    'Psikiyatri'
  ]

  const isWarningMessage = (msg) => {
    return (
      msg.includes('Lütfen') || 
      msg.includes('uyuşmuyor') || 
      msg.includes('olmalıdır') || 
      msg.includes('yakında')
    )
  }

  // If user is successfully logged in as patient, render Dashboard directly!
  if (isLoggedIn && user?.role === 'patient') {
    return (
      <PatientDashboard 
        user={user} 
        onLogout={() => {
          localStorage.removeItem('token')
          setIsLoggedIn(false)
          setUser(null)
          resetFormState('login', 'patient')
        }} 
      />
    )
  }

  // If user is successfully logged in as doctor, render Doctor Dashboard!
  if (isLoggedIn && user?.role === 'doctor') {
    return (
      <DoctorDashboard 
        user={user} 
        onLogout={() => {
          localStorage.removeItem('token')
          setIsLoggedIn(false)
          setUser(null)
          resetFormState('login', 'doctor')
        }} 
      />
    )
  }

  // If user is successfully logged in as admin, render Admin Dashboard!
  if (isLoggedIn && user?.role === 'admin') {
    return (
      <AdminDashboard 
        user={user} 
        onLogout={() => {
          localStorage.removeItem('token')
          setIsLoggedIn(false)
          setUser(null)
          resetFormState('login', 'admin')
        }} 
      />
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', padding: '24px' }}>
      <div className="auth-wrapper">
      <div className={`auth-card ${role === 'doctor' ? 'doctor-selected' : ''} ${isShaking ? 'shake-animation' : ''}`}>
        
        {/* Brand Header */}
        <div className="brand-header">
          <div className="logo-container">
            {role === 'patient' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                <path d="M3.22 12H9.5l1.5-3 2 6 1.5-3h4.78"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
                <path d="M8 15v1a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-4"/>
                <circle cx="20" cy="10" r="2"/>
              </svg>
            )}
          </div>
          <h1 className="brand-name">Hekimim</h1>
          <p className="brand-subtitle">
            {view === 'login' ? (
              role === 'patient' 
                ? 'Sağlığınız için her an yanınızdayız' 
                : 'Hekim portalına güvenli giriş paneli'
            ) : (
              role === 'patient'
                ? 'Hemen kaydolun, online randevu alın'
                : 'Hekim kadromuza katılmak için bilgilerinizi girin'
            )}
          </p>
        </div>

        {/* Dual Role Selector Tab */}
        <div className={`role-selector ${role === 'doctor' ? 'doctor-selected' : ''}`} style={{ display: role === 'admin' ? 'none' : 'flex' }}>
          <div className="role-slider"></div>
          
          <button 
            type="button" 
            className={`role-btn ${role === 'patient' ? 'active' : ''}`}
            onClick={() => resetFormState(view, 'patient')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Hasta {view === 'login' ? 'Girişi' : 'Kaydı'}
          </button>
          
          <button 
            type="button" 
            className={`role-btn ${role === 'doctor' ? 'active' : ''}`}
            onClick={() => resetFormState('login', 'doctor')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
              <path d="M8 15v1a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-4"/>
            </svg>
            Hekim Girişi
          </button>
        </div>

        {/* View Switch rendering */}
        {view === 'login' ? (
          // ==================== LOGIN FORM ====================
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">
                {role === 'patient' ? 'Hasta E-Posta Adresi' : role === 'admin' ? 'Yönetici E-Posta' : 'Hekim E-Posta'}
              </label>
              <div className="input-container">
                <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  type="email"
                  id="username"
                  className="form-input"
                  maxLength={50}
                  placeholder={role === 'patient' ? 'ahmet@example.com' : role === 'admin' ? 'admin@hekim.com' : 'hekim@hekim.com'}
                  value={usernameOrTc}
                  onChange={(e) => setUsernameOrTc(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Şifre</label>
              <div className="input-container">
                <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="form-input"
                  placeholder="Şifrenizi girin"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                      <line x1="2" x2="22" y1="2" y2="22"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Beni Hatırla
              </label>
              <a href="#" className="forgot-password" onClick={(e) => { e.preventDefault(); showToast('Şifre sıfırlama sistemi yakında aktif olacaktır.'); }}>
                Şifremi Unuttum
              </a>
            </div>

            <button type="submit" className="btn-submit">
              <span>{role === 'patient' ? 'Hasta Girişi Yap' : role === 'admin' ? 'Yönetici Girişi Yap' : 'Hekim Girişi Yap'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </button>

            {role === 'patient' && (
              <div className="auth-footer">
                <p>
                  {view === 'login' 
                    ? "Hesabınız yok mu?" 
                    : "Zaten üye misiniz?"}
                  <button 
                    type="button" 
                    className="switch-view-btn"
                    onClick={() => {
                      setView(view === 'login' ? 'signup' : 'login')
                      setUsernameOrTc('')
                      setPassword('')
                    }}
                  >
                    {view === 'login' ? "Hemen Kayıt Olun" : "Giriş Yapın"}
                  </button>
                </p>
              </div>
            )}
            
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button 
                type="button" 
                onClick={() => role === 'admin' ? resetFormState('login', 'patient') : resetFormState('login', 'admin')}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
              >
                {role === 'admin' ? 'Hasta/Hekim Girişine Dön' : 'Sistem Yöneticisi Girişi'}
              </button>
            </div>
          </form>
        ) : (
          // ==================== SIGNUP FORM ====================
          <form onSubmit={handleSignupSubmit}>
            
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">Ad Soyad</label>
              <div className="input-container">
                <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  type="text"
                  id="fullName"
                  className="form-input"
                  placeholder="Adınızı ve soyadınızı girin"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Conditional Input based on Role (T.C. ID vs Specialty & Registry Code) */}
            {role === 'patient' ? (
              <div className="form-group">
                <label className="form-label" htmlFor="signupTc">T.C. Kimlik Numarası</label>
                <div className="input-container">
                  <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M7 10h10" /><path d="M7 14h10" /><path d="M7 18h6" />
                  </svg>
                  <input
                    type="text"
                    id="signupTc"
                    className="form-input"
                    maxLength={11}
                    placeholder="11 haneli T.C. kimlik numarası"
                    value={usernameOrTc}
                    onChange={(e) => setUsernameOrTc(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
            ) : (
              <div className="form-row">
                {/* Specialty Dropdown for Doctors */}
                <div className="form-group">
                  <label className="form-label" htmlFor="specialty">Uzmanlık Alanı</label>
                  <div className="input-container">
                    <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="m10 15 5-3-5-3v6Z"/>
                    </svg>
                    <select
                      id="specialty"
                      className="form-input"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                    >
                      {specialtiesList.map((spec) => (
                        <option key={spec} value={spec}>{spec}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Institution/Registry Code for Doctors */}
                <div className="form-group">
                  <label className="form-label" htmlFor="instCode">Kurum Sicil No</label>
                  <div className="input-container">
                    <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="16" height="16" x="4" y="4" rx="2" />
                      <path d="M9 22V12h6v10" />
                    </svg>
                    <input
                      type="text"
                      id="instCode"
                      className="form-input"
                      placeholder="Sicil/Kurum Kodu"
                      value={institutionCode}
                      onChange={(e) => setInstitutionCode(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Email Address */}
            <div className="form-group">
              <label className="form-label" htmlFor="signupEmail">E-Posta Adresi</label>
              <div className="input-container">
                <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  type="email"
                  id="signupEmail"
                  className="form-input"
                  placeholder="e-posta@adresiniz.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Passwords Input Row */}
            <div className="form-row">
              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="signupPassword">Şifre</label>
                <div className="input-container">
                  <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="signupPassword"
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">Şifre Tekrar</label>
                <div className="input-container">
                  <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    className="form-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button type="submit" className="btn-submit" style={{ marginTop: '8px' }}>
              <span>{role === 'patient' ? 'Hasta Hesabı Oluştur' : 'Hekim Hesabı Oluştur'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </button>

            {/* Footer switcher */}
            <div className="auth-footer">
              <span>Zaten bir hesabınız var mı?</span>
              <a href="#" onClick={(e) => { e.preventDefault(); resetFormState('login', role); }}>
                Giriş Yapın
              </a>
            </div>

          </form>
        )}

      </div>

      {/* Modern Toast Notification */}
      {toastMessage && (
        <div 
          className="toast" 
          style={{ 
            backgroundColor: isWarningMessage(toastMessage) ? '#f59e0b' : '#10b981' 
          }}
        >
          {isWarningMessage(toastMessage) ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" x2="12" y1="9" y2="13"/>
              <line x1="12" x2="12.01" y1="17" y2="17"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          )}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
    </div>
  )
}

export default App
