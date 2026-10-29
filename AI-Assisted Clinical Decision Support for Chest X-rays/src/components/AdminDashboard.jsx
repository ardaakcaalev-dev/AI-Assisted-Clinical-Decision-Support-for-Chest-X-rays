import React, { useState, useEffect } from 'react';
import './DoctorDashboard.css';
import { API_URL } from '../config'


const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  
  // Don't override Content-Type if it's FormData (browser sets it automatically with boundary)
  const isFormData = options.body instanceof FormData;
  
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  
  if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.reload();
  }
  return response;
};


function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    total_doctors: 0,
    total_patients: 0,
    total_appointments: 0,
    completed_appointments: 0
  });
  
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointmentsList, setAppointmentsList] = useState([]);
  const [patientsPage, setPatientsPage] = useState(1);
  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const itemsPerPage = 10;
  
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false);
  const [newDoctor, setNewDoctor] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    specialty: 'Kardiyoloji',
    phone_number: ''
  });
  const [toastMessage, setToastMessage] = useState('');

  const fetchStats = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/stats`);
      if (res.ok) setStats(await res.json());
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/doctors`);
      if (res.ok) setDoctors(await res.json());
    } catch (e) {
      console.error("Failed to fetch doctors", e);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/patients`);
      if (res.ok) setPatients(await res.json());
    } catch (e) {
      console.error("Failed to fetch patients", e);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/appointments`);
      if (res.ok) setAppointmentsList(await res.json());
    } catch (e) {
      console.error("Failed to fetch appointments", e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'doctors') fetchDoctors();
    if (activeTab === 'patients') fetchPatients();
    if (activeTab === 'appointments') fetchAppointments();
  }, [activeTab]);

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/doctors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoctor)
      });
      if (res.ok) {
        showToast('Doktor başarıyla eklendi.');
        setShowAddDoctorModal(false);
        setNewDoctor({ first_name: '', last_name: '', email: '', password: '', specialty: 'Kardiyoloji', phone_number: '' });
        fetchDoctors();
        fetchStats();
      } else {
        const data = await res.json();
        showToast(data.detail || 'Doktor eklenirken hata oluştu.');
      }
    } catch (e) {
      showToast('Sunucuya bağlanılamadı.');
    }
  };

  const handleDeleteDoctor = async (doctorId) => {
    if (!window.confirm("Bu doktoru sistemden silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/doctors/${doctorId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Doktor silindi.');
        fetchDoctors();
        fetchStats();
      } else {
        const data = await res.json();
        showToast(data.detail || 'Silme hatası.');
      }
    } catch (e) {
      showToast('Sunucu hatası.');
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="doc-section" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            <div className="doc-header" style={{ marginBottom: '32px' }}>
              <h1>Sistem Genel Bakış</h1>
              <p>Sistem Hastanesi tüm birimlerinin anlık özeti.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
              <div className="doc-glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(20, 184, 166, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>{stats.total_doctors}</h3>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Toplam Doktor</span>
                </div>
              </div>
              <div className="doc-glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>{stats.total_patients}</h3>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Kayıtlı Hasta</span>
                </div>
              </div>
              <div className="doc-glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(244, 63, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>{stats.total_appointments}</h3>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Toplam Randevu</span>
                </div>
              </div>
              <div className="doc-glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(250, 204, 21, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: 'var(--text-main)' }}>{stats.completed_appointments}</h3>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Tamamlanan Muayene</span>
                </div>
              </div>
            </div>
            
            <div className="doc-glass-card" style={{ marginTop: '32px', padding: '32px' }}>
              <h2 style={{ margin: '0 0 24px 0', fontSize: '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                Sistem Durumu
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 12px #22c55e' }}></div>
                  <div>
                    <span style={{ display: 'block', fontWeight: '600', color: 'var(--text-main)' }}>Veritabanı Bağlantısı</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tüm sunucular aktif ve stabil.</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 12px #22c55e' }}></div>
                  <div>
                    <span style={{ display: 'block', fontWeight: '600', color: 'var(--text-main)' }}>API Servisleri</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Gecikme: 24ms. Trafik normal.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'doctors':
        return (
          <div className="doc-section" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            <div className="doc-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>Doktor Yönetimi</h1>
                <p>Hastanede görev yapan tüm hekimlerin listesi ve yönetim ekranı.</p>
              </div>
              <button 
                onClick={() => setShowAddDoctorModal(true)}
                style={{ padding: '12px 24px', background: 'var(--primary)', color: '#0f172a', fontWeight: '600', borderRadius: '12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                Yeni Doktor Ekle
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {doctors.map(doc => (
                <div key={doc.id} className="doc-glass-card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-main)' }}>
                      {doc.first_name?.[0] || ''}{doc.last_name?.[0] || ''}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)' }}>Dr. {doc.first_name} {doc.last_name}</span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: '600', background: 'rgba(20, 184, 166, 0.1)', padding: '2px 8px', borderRadius: '6px', alignSelf: 'flex-start' }}>{doc.specialty}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        {doc.phone_number || '-'}
                      </span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        {doc.email}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleDeleteDoctor(doc.id)}
                      style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
              {doctors.length === 0 && (
                <div className="doc-glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Sistemde henüz kayıtlı doktor bulunmuyor.
                </div>
              )}
            </div>
          </div>
        );

      case 'patients': {
        const totalPages = Math.ceil(patients.length / itemsPerPage) || 1;
        const currentPatients = patients.slice((patientsPage - 1) * itemsPerPage, patientsPage * itemsPerPage);

        return (
          <div className="doc-section" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            <div className="doc-header" style={{ marginBottom: '32px' }}>
              <h1>Hasta Kayıtları</h1>
              <p>Sisteme kayıtlı tüm hastalar ve demografik bilgileri.</p>
            </div>

            <div className="doc-glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Hasta Adı Soyadı</th>
                      <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Kimlik No / E-Posta</th>
                      <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Telefon</th>
                      <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Kayıt Tarihi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPatients.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '16px 24px', color: 'var(--text-main)', fontWeight: '600' }}>{p.first_name} {p.last_name}</td>
                        <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'block', color: 'var(--text-main)' }}>{p.identity_number || 'Belirtilmedi'}</span>
                          <span style={{ fontSize: '0.85rem' }}>{p.email}</span>
                        </td>
                        <td style={{ padding: '16px 24px', color: 'var(--text-main)' }}>{p.phone_number || '-'}</td>
                        <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('tr-TR') : '-'}</td>
                      </tr>
                    ))}
                    {patients.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Kayıtlı hasta bulunamadı.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {patients.length > itemsPerPage && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--card-border)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Toplam {patients.length} kayıt, Sayfa {patientsPage} / {totalPages}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setPatientsPage(p => Math.max(1, p - 1))} 
                      disabled={patientsPage === 1}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', cursor: patientsPage === 1 ? 'not-allowed' : 'pointer', color: patientsPage === 1 ? 'var(--text-muted)' : 'var(--text-main)' }}
                    >Önceki</button>
                    <button 
                      onClick={() => setPatientsPage(p => Math.min(totalPages, p + 1))} 
                      disabled={patientsPage === totalPages}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', cursor: patientsPage === totalPages ? 'not-allowed' : 'pointer', color: patientsPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)' }}
                    >Sonraki</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'appointments': {
        const totalPages = Math.ceil(appointmentsList.length / itemsPerPage) || 1;
        const currentAppointments = appointmentsList.slice((appointmentsPage - 1) * itemsPerPage, appointmentsPage * itemsPerPage);

        return (
          <div className="doc-section" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
            <div className="doc-header" style={{ marginBottom: '32px' }}>
              <h1>Tüm Randevular</h1>
              <p>Hastanede oluşturulmuş tüm randevuların merkezi listesi.</p>
            </div>

            <div className="doc-glass-card" style={{ overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Tarih & Saat</th>
                      <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Hasta</th>
                      <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Hekim</th>
                      <th style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAppointments.map(appt => (
                      <tr key={appt.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '16px 24px', color: 'var(--text-main)', fontWeight: '600' }}>
                          <span style={{ display: 'block' }}>{new Date(appt.appointment_date).toLocaleDateString('tr-TR')}</span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{appt.appointment_time}</span>
                        </td>
                        <td style={{ padding: '16px 24px', color: 'var(--text-main)' }}>{appt.patient_name}</td>
                        <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>
                          <span style={{ display: 'block', color: 'var(--text-main)' }}>Dr. {appt.doctor_name}</span>
                          <span style={{ fontSize: '0.85rem' }}>{appt.doctor_specialty}</span>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            padding: '4px 10px', 
                            borderRadius: '12px', 
                            background: appt.status === 'Bekliyor' ? 'rgba(245, 158, 11, 0.1)' : appt.status === 'İptal Edildi' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(20, 184, 166, 0.1)', 
                            color: appt.status === 'Bekliyor' ? '#f59e0b' : appt.status === 'İptal Edildi' ? '#ef4444' : 'var(--primary)', 
                            fontWeight: '600' 
                          }}>
                            {appt.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {appointmentsList.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Randevu kaydı bulunamadı.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {appointmentsList.length > itemsPerPage && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid var(--card-border)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Toplam {appointmentsList.length} kayıt, Sayfa {appointmentsPage} / {totalPages}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setAppointmentsPage(p => Math.max(1, p - 1))} 
                      disabled={appointmentsPage === 1}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', cursor: appointmentsPage === 1 ? 'not-allowed' : 'pointer', color: appointmentsPage === 1 ? 'var(--text-muted)' : 'var(--text-main)' }}
                    >Önceki</button>
                    <button 
                      onClick={() => setAppointmentsPage(p => Math.min(totalPages, p + 1))} 
                      disabled={appointmentsPage === totalPages}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'transparent', cursor: appointmentsPage === totalPages ? 'not-allowed' : 'pointer', color: appointmentsPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)' }}
                    >Sonraki</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="doctor-dashboard">
      {toastMessage && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', background: 'var(--primary)', color: '#0f172a', padding: '16px 24px', borderRadius: '12px', fontWeight: '600', zIndex: 9999, boxShadow: '0 8px 16px rgba(20, 184, 166, 0.2)' }}>
          {toastMessage}
        </div>
      )}

      {/* Sidebar */}
      <aside className="doc-sidebar">
        <div className="doc-logo">
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, var(--primary), #0d9488)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>HBYS Admin</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>Sistem Yönetimi</span>
          </div>
        </div>

        <nav className="doc-nav">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`doc-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
            Genel Bakış
          </button>
          
          <button 
            onClick={() => setActiveTab('doctors')} 
            className={`doc-nav-item ${activeTab === 'doctors' ? 'active' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Doktor Yönetimi
          </button>

          <button 
            onClick={() => setActiveTab('patients')} 
            className={`doc-nav-item ${activeTab === 'patients' ? 'active' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Hasta Kayıtları
          </button>

          <button 
            onClick={() => setActiveTab('appointments')} 
            className={`doc-nav-item ${activeTab === 'appointments' ? 'active' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            Tüm Randevular
          </button>
        </nav>

        <div className="doc-sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)' }}>{user.first_name} {user.last_name}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sistem Yöneticisi</span>
          </div>
          <button 
            onClick={onLogout}
            style={{ width: '100%', padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="doc-main-content">
        <div className="doc-scroll-content">
          {renderContent()}
        </div>
      </main>

      {/* Add Doctor Modal */}
      {showAddDoctorModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="doc-glass-card" style={{ width: '100%', maxWidth: '600px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>Sisteme Yeni Doktor Ekle</h2>
              <button onClick={() => setShowAddDoctorModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            
            <form onSubmit={handleAddDoctor} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0f172a', fontWeight: '600' }}>Ad</label>
                  <input type="text" className="dark-input" style={{ color: '#fff', background: '#1e293b' }} required value={newDoctor.first_name} onChange={(e) => setNewDoctor({...newDoctor, first_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0f172a', fontWeight: '600' }}>Soyad</label>
                  <input type="text" className="dark-input" style={{ color: '#fff', background: '#1e293b' }} required value={newDoctor.last_name} onChange={(e) => setNewDoctor({...newDoctor, last_name: e.target.value})} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#0f172a', fontWeight: '600' }}>Branş</label>
                <select className="dark-input" style={{ color: '#fff', background: '#1e293b' }} value={newDoctor.specialty} onChange={(e) => setNewDoctor({...newDoctor, specialty: e.target.value})}>
                  <option value="Kardiyoloji">Kardiyoloji</option>
                  <option value="İç Hastalıkları (Dahiliye)">İç Hastalıkları (Dahiliye)</option>
                  <option value="Çocuk Sağlığı ve Hastalıkları">Çocuk Sağlığı ve Hastalıkları</option>
                  <option value="Genel Cerrahi">Genel Cerrahi</option>
                  <option value="Göz Hastalıkları">Göz Hastalıkları</option>
                  <option value="Ortopedi ve Travmatoloji">Ortopedi ve Travmatoloji</option>
                  <option value="Nöroloji">Nöroloji</option>
                  <option value="Cildiye">Cildiye</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0f172a', fontWeight: '600' }}>E-Posta (Giriş için)</label>
                  <input type="email" className="dark-input" style={{ color: '#fff', background: '#1e293b' }} required value={newDoctor.email} onChange={(e) => setNewDoctor({...newDoctor, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0f172a', fontWeight: '600' }}>Şifre</label>
                  <input type="text" className="dark-input" style={{ color: '#fff', background: '#1e293b' }} required value={newDoctor.password} onChange={(e) => setNewDoctor({...newDoctor, password: e.target.value})} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#0f172a', fontWeight: '600' }}>Telefon Numarası</label>
                <input type="text" className="dark-input" style={{ color: '#fff', background: '#1e293b' }} value={newDoctor.phone_number} onChange={(e) => setNewDoctor({...newDoctor, phone_number: e.target.value})} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowAddDoctorModal(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>İptal</button>
                <button type="submit" style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', color: '#0f172a', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Doktoru Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
