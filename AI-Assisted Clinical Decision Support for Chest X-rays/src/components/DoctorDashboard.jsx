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


const calculateAge = (birthDateStr) => {
  if (!birthDateStr) return 0;
  const birthDate = new Date(birthDateStr);
  const today = new Date('2026-05-22');
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const DoctorDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [isShaking, setIsShaking] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || 'Uzm. Dr. Ayşe Yılmaz',
    email: 'doktor@hastane.com',
    phone: '+90 (555) 123 45 67',
    birthDate: '1985-06-15',
    gender: 'kadin',
    city: 'İstanbul',
    address: ''
  });
  const [tempProfileData, setTempProfileData] = useState({ ...profileData });

  const [toastMessage, setToastMessage] = useState(null);
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch true doctor data on mount
  useEffect(() => {
    if (user && user.id) {
      const fetchDoctorData = async () => {
        try {
          let doctorData = null;
          const response = await fetchWithAuth(`${API_URL}/api/doctors/${user.id}`);
          if (response.ok) {
            doctorData = await response.json();
            const loadedData = {
              fullName: `${doctorData.first_name} ${doctorData.last_name}`,
              email: doctorData.email || '',
              phone: doctorData.phone_number || '',
              birthDate: doctorData.date_of_birth ? String(doctorData.date_of_birth) : '1985-06-15',
              gender: doctorData.gender || 'kadin',
              city: doctorData.city || 'İstanbul',
              address: doctorData.address || ''
            };
            setProfileData(loadedData);
            setTempProfileData(loadedData);
          }
          const apptRes = await fetchWithAuth(`${API_URL}/api/appointments/doctor/${user.id}`);
          if (apptRes.ok) {
            setAppointments(await apptRes.json());
          }
          if (doctorData && doctorData.slot_duration_minutes) {
            setSlotDuration(doctorData.slot_duration_minutes);
          }
          const schedRes = await fetchWithAuth(`${API_URL}/api/doctors/${user.id}/schedule`);
          if (schedRes.ok) {
            const sData = await schedRes.json();
            if (sData.length > 0) {
              setSchedules(sData.map(d => ({ ...d, start_time: d.start_time.substring(0,5), end_time: d.end_time.substring(0,5) })));
            } else {
              const defScheds = [];
              for(let i=0; i<5; i++) {
                defScheds.push({ day_of_week: i, start_time: '09:00', end_time: '17:00' });
              }
              setSchedules(defScheds);
            }
          }
          const toffRes = await fetchWithAuth(`${API_URL}/api/doctors/${user.id}/timeoff`);
          if (toffRes.ok) {
            setTimeoffs(await toffRes.json());
          }
        } catch (error) {
          console.error("Failed to fetch doctor profile:", error);
        }
      };
      fetchDoctorData();
    }
  }, [user]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientTab, setPatientTab] = useState('summary');
  const [patientRecords, setPatientRecords] = useState([]);
  const [patientLabs, setPatientLabs] = useState([]);
  const [patientRadiology, setPatientRadiology] = useState([]);

  // Patients Mock Data
  const [patientSearch, setPatientSearch] = useState('');


  // Appointments Data
  const [appointments, setAppointments] = useState([]);

  const patients = React.useMemo(() => {
    const uniqueMap = new Map();
    appointments.forEach(appt => {
      const pId = appt.patient_id;
      if (!pId) return;
      if (!uniqueMap.has(pId)) {
        uniqueMap.set(pId, {
          id: pId,
          fullName: appt.patient_name || 'Bilinmeyen Hasta',
          age: appt.patient_date_of_birth ? calculateAge(appt.patient_date_of_birth) : '-', 
          lastVisit: appt.appointment_date,
          diagnosis: appt.reason || 'Belirtilmedi',
          status: appt.status,
          bloodType: '-',
          height: '-',
          weight: '-',
          allergies: [],
          chronicDiseases: []
        });
      } else {
        const existing = uniqueMap.get(pId);
        if (new Date(appt.appointment_date) > new Date(existing.lastVisit)) {
          existing.lastVisit = appt.appointment_date;
          existing.status = appt.status;
          existing.diagnosis = appt.reason || existing.diagnosis;
          uniqueMap.set(pId, existing);
        }
      }
    });
    return Array.from(uniqueMap.values());
  }, [appointments]);

  const filteredPatients = patients.filter(p => p.fullName.toLowerCase().includes(patientSearch.toLowerCase()));
  const [slotDuration, setSlotDuration] = useState(20);
  const [schedules, setSchedules] = useState([]);
  const [timeoffs, setTimeoffs] = useState([]);
  const [newTimeoff, setNewTimeoff] = useState({ date: '', start_time: '', end_time: '', reason: '' });

  // Examination States
  const [showExamModal, setShowExamModal] = useState(false);
  const [examAppointment, setExamAppointment] = useState(null);
  const [examActiveTab, setExamActiveTab] = useState('clinical');
  const [examData, setExamData] = useState({
    complaint: '',
    diagnosis: '',
    notes: '',
    medicines: ''
  });
  const [patientHistory, setPatientHistory] = useState([]);
  const [radiologyFile, setRadiologyFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [expandedDisease, setExpandedDisease] = useState(null);
  const [gradCamImages, setGradCamImages] = useState({});
  const [selectedDiseases, setSelectedDiseases] = useState(new Set());
  const [isGradCamLoading, setIsGradCamLoading] = useState(false);

  const [doctorPacsStudy, setDoctorPacsStudy] = useState(null);
  const [doctorPacsZoom, setDoctorPacsZoom] = useState(1);
  const [doctorPacsPan, setDoctorPacsPan] = useState({ x: 0, y: 0 });
  const [isDoctorPacsDragging, setIsDoctorPacsDragging] = useState(false);
  const [doctorPacsDragStart, setDoctorPacsDragStart] = useState({ x: 0, y: 0 });
  const [doctorPacsExpandedDisease, setDoctorPacsExpandedDisease] = useState(null);
  const [doctorPacsGradCamImages, setDoctorPacsGradCamImages] = useState({});
  const [isDoctorPacsGradCamLoading, setIsDoctorPacsGradCamLoading] = useState(false);

  const [radiologyData, setRadiologyData] = useState({ title: '', modality: 'XR', body_part: '', report: '' });
  const [labData, setLabData] = useState({
    title: '',
    department: 'Biyokimya Laboratuvarı',
    results: []
  });

  const LAB_TEMPLATES = {
    "Tam Kan Sayımı (Hemogram)": {
      department: "Hemotoloji",
      results: [
        { name: 'WBC (Lökosit)', value: '', unit: '10^3/uL', range: '4.0 - 10.0', status: 'normal' },
        { name: 'RBC (Eritrosit)', value: '', unit: '10^6/uL', range: '4.5 - 5.5', status: 'normal' },
        { name: 'HGB (Hemoglobin)', value: '', unit: 'g/dL', range: '12.0 - 16.0', status: 'normal' },
        { name: 'HCT (Hematokrit)', value: '', unit: '%', range: '36.0 - 46.0', status: 'normal' },
        { name: 'PLT (Trombosit)', value: '', unit: '10^3/uL', range: '150 - 400', status: 'normal' }
      ]
    },
    "Rutin Biyokimya Paneli": {
      department: "Biyokimya Laboratuvarı",
      results: [
        { name: 'Açlık Kan Şekeri (Glukoz)', value: '', unit: 'mg/dL', range: '70 - 100', status: 'normal' },
        { name: 'Total Kolesterol', value: '', unit: 'mg/dL', range: '100 - 200', status: 'normal' },
        { name: 'Kreatinin', value: '', unit: 'mg/dL', range: '0.70 - 1.20', status: 'normal' },
        { name: 'Sodyum (Na)', value: '', unit: 'mEq/L', range: '136 - 145', status: 'normal' },
        { name: 'Potasyum (K)', value: '', unit: 'mEq/L', range: '3.5 - 5.1', status: 'normal' }
      ]
    },
    "Tiroid Fonksiyon Testleri": {
      department: "Hormon Laboratuvarı",
      results: [
        { name: 'TSH', value: '', unit: 'uIU/mL', range: '0.27 - 4.20', status: 'normal' },
        { name: 'Serbest T3 (sT3)', value: '', unit: 'pg/mL', range: '2.0 - 4.4', status: 'normal' },
        { name: 'Serbest T4 (sT4)', value: '', unit: 'ng/dL', range: '0.93 - 1.70', status: 'normal' }
      ]
    }
  };

  const analyzeXRay = async () => {
    if (!radiologyFile) {
      setToastMessage('Lütfen önce analiz edilecek bir dosya seçin.');
      return;
    }
    setIsAnalyzing(true);
    setAiResults(null);
    try {
      const formData = new FormData();
      formData.append('file', radiologyFile);
      const res = await fetchWithAuth(`${API_URL}/api/ai/analyze-xray`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setAiResults(data.predictions);
      } else {
        const errorData = await res.json();
        setToastMessage(errorData.detail || 'Yapay Zeka analizi sırasında bir hata oluştu.');
      }
    } catch (e) {
      setToastMessage('Yapay Zeka servisine ulaşılamıyor.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchGradCam = async (diseaseName) => {
    if (expandedDisease === diseaseName) {
      setExpandedDisease(null);
      return;
    }
    setExpandedDisease(diseaseName);
    if (gradCamImages[diseaseName]) return;
    
    setIsGradCamLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', radiologyFile);
      formData.append('disease', diseaseName);
      const res = await fetchWithAuth(`${API_URL}/api/ai/gradcam`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setGradCamImages(prev => ({...prev, [diseaseName]: {
            gradcam: data.gradcam_base64,
            attention: data.attention_base64
          }}));
        }
      } else {
        setToastMessage('Isı haritası oluşturulamadı.');
      }
    } catch (e) {
      setToastMessage('Sunucu bağlantı hatası.');
    } finally {
      setIsGradCamLoading(false);
    }
  };

  const fetchDoctorPacsGradCam = async (diseaseName, fileUrl) => {
    if (doctorPacsExpandedDisease === diseaseName) {
      setDoctorPacsExpandedDisease(null);
      return;
    }
    setDoctorPacsExpandedDisease(diseaseName);
    if (doctorPacsGradCamImages[diseaseName]) return;
    
    setIsDoctorPacsGradCamLoading(true);
    try {
      const formData = new FormData();
      formData.append('file_url', fileUrl);
      formData.append('disease', diseaseName);
      // Backend expects 'file' field to be present even if empty
      formData.append('file', new Blob([]), 'empty.jpg');
      const res = await fetchWithAuth(`${API_URL}/api/ai/gradcam`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDoctorPacsGradCamImages(prev => ({...prev, [diseaseName]: {
            gradcam: data.gradcam_base64,
            attention: data.attention_base64
          }}));
        }
      } else {
        setToastMessage('Isı haritası oluşturulamadı.');
      }
    } catch (e) {
      setToastMessage('Sunucu bağlantı hatası.');
    } finally {
      setIsDoctorPacsGradCamLoading(false);
    }
  };

  const turkishCities = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin', 
    'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 
    'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 
    'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 
    'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 
    'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 
    'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 
    'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
  ];



  // Extract initials for the avatar
  const getInitials = (name) => {
    if (!name) return 'DR';
    const cleaned = name.replace(/Uzm\. Dr\.|\(|\)/g, '').trim();
    if (!cleaned) return 'DR';
    return cleaned.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleAvailabilitySave = async (e) => {
    e.preventDefault();
    try {
      await fetchWithAuth(`${API_URL}/api/doctors/${user.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tempProfileData, slot_duration_minutes: slotDuration })
      });
      const res = await fetchWithAuth(`${API_URL}/api/doctors/${user.id}/schedule`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules })
      });
      if (res.ok) {
        showToast('Çalışma saatleri başarıyla güncellendi!');
      } else {
        showToast('Bir hata oluştu.');
      }
    } catch (e) {
      showToast('Bir hata oluştu.');
    }
  };

  const handleAddTimeOff = async (e) => {
    e.preventDefault();
    if (!newTimeoff.date) return showToast('Lütfen bir tarih seçin.');
    try {
      const payload = { date: newTimeoff.date, reason: newTimeoff.reason || null };
      if (newTimeoff.start_time && newTimeoff.end_time) {
        payload.start_time = newTimeoff.start_time;
        payload.end_time = newTimeoff.end_time;
      }
      const res = await fetchWithAuth(`${API_URL}/api/doctors/${user.id}/timeoff`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const added = await res.json();
        setTimeoffs([...timeoffs, added]);
        setNewTimeoff({ date: '', start_time: '', end_time: '', reason: '' });
        showToast('İzin günü başarıyla eklendi!');
      }
    } catch (e) {
      showToast('Bir hata oluştu.');
    }
  };

  const handleDeleteTimeOff = async (id) => {
    if (!confirm('Bu izni silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/doctors/${user.id}/timeoff/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTimeoffs(timeoffs.filter(t => t.id !== id));
        showToast('İzin silindi.');
      }
    } catch (e) {
      showToast('Bir hata oluştu.');
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!tempProfileData.fullName) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
      return;
    }

    const rawPhone = String(tempProfileData.phone || '').replace(/\D/g, '');
    if (rawPhone.length !== 11) {
      showToast('Lütfen telefon numarasını eksiksiz girin (Örn: 0 555 555 55 55)');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
      return;
    }

    const nameParts = tempProfileData.fullName.trim().split(' ');
    const lastName = nameParts.length > 1 ? nameParts.pop() : 'SoyisimYok';
    const firstName = nameParts.join(' ');

    const payload = {
        first_name: firstName,
        last_name: lastName,
        phone_number: tempProfileData.phone,
        date_of_birth: tempProfileData.birthDate,
        gender: tempProfileData.gender,
        city: tempProfileData.city,
        address: tempProfileData.address
    };

    if (currentPassword || newPassword || confirmNewPassword) {
      if (!currentPassword || !newPassword || !confirmNewPassword || newPassword !== confirmNewPassword) {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 400);
        return;
      }
      payload.current_password = currentPassword;
      payload.password = newPassword;
    }

    try {
        const response = await fetchWithAuth(`${API_URL}/api/doctors/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            setProfileData({ ...tempProfileData });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
            showToast('Profil bilgileriniz başarıyla güncellendi!');
        } else {
            const data = await response.json();
            showToast(data.detail || 'Güncelleme başarısız oldu.');
        }
    } catch (error) {
        showToast('Sunucuya bağlanılamadı. Lütfen bağlantınızı kontrol edin.');
    }
  };
  const handlePatientDetailClick = async (patient) => {
    try {
        const response = await fetchWithAuth(`${API_URL}/api/patients/${patient.id}`);
        if (response.ok) {
            const data = await response.json();
            setSelectedPatient({
                ...patient,
                fullName: `${data.first_name} ${data.last_name}`,
                age: data.date_of_birth ? calculateAge(data.date_of_birth) : '-',
                bloodType: data.blood_type || '-',
                height: data.height_cm ? data.height_cm + ' cm' : '-',
                weight: data.weight_kg ? data.weight_kg + ' kg' : '-',
                allergies: [], 
                chronicDiseases: []
            });
        } else {
            setSelectedPatient(patient);
        }

        const recordsRes = await fetchWithAuth(`${API_URL}/api/medical-records/patient/${patient.id}`);
        if (recordsRes.ok) {
            const records = await recordsRes.json();
            setPatientRecords(records);
        } else {
            setPatientRecords([]);
        }

        const labsRes = await fetchWithAuth(`${API_URL}/api/lab-studies/patient/${patient.id}`);
        if (labsRes.ok) {
            const labs = await labsRes.json();
            setPatientLabs(labs);
        } else {
            setPatientLabs([]);
        }

        const radRes = await fetchWithAuth(`${API_URL}/api/radiology/patient/${patient.id}`);
        if (radRes.ok) {
            const rads = await radRes.json();
            setPatientRadiology(rads);
        } else {
            setPatientRadiology([]);
        }

    } catch (e) {
        setSelectedPatient(patient);
        setPatientRecords([]);
        setPatientLabs([]);
        setPatientRadiology([]);
    }
  };


  const renderPatientDetail = () => {
    return (
      <div className="doc-section" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        {/* Back button & Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <button 
            onClick={() => setSelectedPatient(null)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '10px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background='rgba(255,255,255,0.1)'} 
            onMouseOut={(e) => e.currentTarget.style.background='var(--card-bg)'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)' }}>Klinik Dosya</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Hasta detayları ve tıbbi kayıtlar</p>
          </div>
        </div>

        {/* Patient Info Card (Glassmorphism) */}
        <div className="doc-glass-card" style={{ padding: '32px', marginBottom: '32px', display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(20, 184, 166, 0.1)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: '2rem', fontWeight: 'bold', boxShadow: '0 0 20px rgba(20, 184, 166, 0.2)', flexShrink: 0 }}>
            {getInitials(selectedPatient.fullName)}
          </div>
          
          <div style={{ flex: 1, minWidth: '300px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: 'var(--text-main)' }}>{selectedPatient.fullName}</h2>
            <div style={{ display: 'flex', gap: '24px', color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                {selectedPatient.age} Yaşında
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
                {selectedPatient.height} / {selectedPatient.weight}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h3l3-9 5 18 3-9h6"/></svg>
                Kan: <strong style={{ color: 'var(--text-main)' }}>{selectedPatient.bloodType}</strong>
              </span>
            </div>


          </div>
        </div>

        {/* Detail Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px', overflowX: 'auto' }}>
          {[
            { id: 'summary', label: 'Özet & Geçmiş', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></> },
            { id: 'prescriptions', label: 'Reçeteler', icon: <><path d="M10.5 20.5 7 17l3.5-3.5"/><path d="M17 14H7"/><path d="M17 10h-2.5a2.5 2.5 0 0 1 0-5H17"/><path d="M14.5 10c1.38 0 2.5 1.12 2.5 2.5S15.88 15 14.5 15"/><path d="M7 10h3"/></> },
            { id: 'labs', label: 'Tahliller & Sonuçlar', icon: <><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><circle cx="12" cy="16" r="1"/></> },
            { id: 'radiology', label: 'Radyolojik Görüntüler', icon: <><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></> },
            { id: 'notes', label: 'Klinik Notlar', icon: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setPatientTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '12px',
                background: patientTab === tab.id ? 'var(--primary)' : 'transparent',
                color: patientTab === tab.id ? '#fff' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: patientTab === tab.id ? '600' : '500',
                transition: 'all 0.2s', whiteSpace: 'nowrap'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {tab.icon}
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="doc-glass-card" style={{ padding: '32px', minHeight: '300px' }}>
          {patientTab === 'summary' && (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '24px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                Güncel Durum
              </h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>Hastanın son muayenesi <strong>{selectedPatient.lastVisit}</strong> tarihinde gerçekleşmiştir. Mevcut ön tanısı: <strong>{selectedPatient.diagnosis}</strong>. Durumu <strong>{selectedPatient.status}</strong> olarak izlenmektedir.</p>
              
              <div style={{ marginTop: '32px', padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--card-border)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Geçmiş muayene kayıtları ve detaylı anamnez bilgileri buraya yüklenecektir.</p>
              </div>
            </div>
          )}
          {patientTab === 'prescriptions' && (
            <div>
              {patientRecords.filter(r => r.medicines).length > 0 ? (
                <div style={{ display: 'grid', gap: '24px' }}>
                  {patientRecords.filter(r => r.medicines).map((rec, i) => {
                    const medList = rec.medicines.split(/[\n,]+/).filter(m => m.trim() !== '');
                    const dateStr = rec.created_at ? new Date(rec.created_at).toLocaleDateString('tr-TR') : 'Tarih Yok';
                    const presNo = rec.prescription_no || `RX-${Math.floor(100000 + Math.random() * 900000)}`;
                    return (
                      <div key={i} style={{ padding: '24px', background: 'linear-gradient(to right, rgba(16, 185, 129, 0.03), transparent)', borderRadius: '16px', border: '1px solid var(--card-border)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', opacity: 0.3 }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2z"/><path d="M7 7h2v2H7z"/><path d="M15 7h2v2h-2z"/><path d="M7 15h2v2H7z"/><path d="M11 11h2v2h-2z"/><path d="M7 11h2v2H7z"/><path d="M11 15h2v2h-2z"/><path d="M15 11h2v2h-2z"/><path d="M15 15h2v2h-2z"/></svg>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 7.5 8 8"/></svg>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '4px 10px', borderRadius: '12px', letterSpacing: '0.5px' }}>E-REÇETE</span>
                              <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '600' }}>{dateStr}</span>
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '6px', letterSpacing: '0.5px', margin: '4px 0 0 0' }}>#{presNo}</h3>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {medList.map((med, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                                <span style={{ color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: '500' }}>{med.trim()}</span>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                                ATC-{(100 + idx) + Math.floor(Math.random() * 50)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', margin: '0 auto' }}><path d="M10.5 20.5 7 17l3.5-3.5"/><path d="M17 14H7"/><path d="M17 10h-2.5a2.5 2.5 0 0 1 0-5H17"/><path d="M14.5 10c1.38 0 2.5 1.12 2.5 2.5S15.88 15 14.5 15"/><path d="M7 10h3"/></svg>
                  <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-main)' }}>Henüz reçete kaydı bulunmuyor</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Bu hastaya ait geçmiş bir reçete bulunamadı.</p>
                </div>
              )}
            </div>
          )}
          {patientTab === 'labs' && (
            <div>
              {patientLabs.length > 0 ? (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {patientLabs.map((lab) => (
                    <div key={lab.id} style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0, color: 'var(--text-main)' }}>{lab.title}</h4>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{lab.test_date}</span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>{lab.department}</p>
                      <span style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: '12px', background: lab.status === 'Tamamlandı' ? 'rgba(20, 184, 166, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: lab.status === 'Tamamlandı' ? 'var(--primary)' : '#f59e0b' }}>{lab.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', margin: '0 auto' }}><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><circle cx="12" cy="16" r="1"/></svg>
                  <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-main)' }}>Tahlil sonucu bulunmuyor</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Laboratuvar veya görüntüleme sonuçları buraya eklenecektir.</p>
                </div>
              )}
            </div>
          )}
          {patientTab === 'radiology' && (
            <div>
              {patientRadiology.length > 0 ? (
                <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                  {patientRadiology.map((rad) => (
                    <div key={rad.id} style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid var(--card-border)', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                      <div style={{ position: 'absolute', top: 0, right: 0, padding: '6px 16px', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 'bold', borderBottomLeftRadius: '12px', letterSpacing: '1px' }}>
                        {rad.modality}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                        </div>
                        <div>
                          <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: '600' }}>{rad.title}</h4>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{rad.body_part}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                          {rad.date}
                        </span>
                        <button onClick={() => setDoctorPacsStudy(rad)} style={{ width: '100%', padding: '10px', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', border: '1px solid rgba(20, 184, 166, 0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onMouseOver={(e) => {e.currentTarget.style.background='var(--primary)'; e.currentTarget.style.color='#fff'}} onMouseOut={(e) => {e.currentTarget.style.background='rgba(20, 184, 166, 0.1)'; e.currentTarget.style.color='var(--primary)'}}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                          Görüntüle
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', margin: '0 auto' }}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-main)' }}>Görüntüleme kaydı bulunmuyor</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Bu hastaya ait geçmiş bir radyoloji (Röntgen, MR, CT) kaydı bulunamadı.</p>
                </div>
              )}
            </div>
          )}
          {patientTab === 'notes' && (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '24px', color: 'var(--text-main)' }}>Klinik Notlar</h3>
              
              {patientRecords.filter(r => r.notes).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                  {patientRecords.filter(r => r.notes).map((rec, i) => (
                    <div key={i} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--primary)', borderRadius: '0 8px 8px 0' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{rec.created_at ? new Date(rec.created_at).toLocaleDateString('tr-TR') : ''}</p>
                      <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{rec.notes}</p>
                    </div>
                  ))}
                </div>
              )}

              <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-main)', fontSize: '1rem' }}>Yeni Not Ekle</h4>
              <textarea 
                placeholder="Hastaya dair gizli klinik notlarınızı buraya yazabilirsiniz..."
                style={{ width: '100%', height: '120px', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '0.95rem', resize: 'vertical', marginBottom: '16px' }}
              ></textarea>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button style={{ padding: '10px 24px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Notu Kaydet</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'appointments':
        return (
          <div className="doc-section" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
            <div className="doc-header" style={{ marginBottom: '32px' }}>
              <h1>Randevularım</h1>
              <p>Bugünkü ve yaklaşan hasta randevularınızı buradan yönetebilirsiniz.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {appointments.length === 0 ? (
                <div className="doc-glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Henüz randevunuz bulunmuyor.
                </div>
              ) : appointments.map(appt => (
                <div key={appt.id} className="doc-glass-card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    
                    {/* Time Badge */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '12px 16px', minWidth: '80px' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)' }}>{appt.appointment_time}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{appt.appointment_date}</span>
                    </div>

                    {/* Patient Info */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-main)' }}>{appt.patient_name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          Şikayet: {appt.reason || 'Belirtilmedi'}
                        </span>
                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: appt.status === 'Bekliyor' ? 'rgba(245, 158, 11, 0.1)' : appt.status === 'İptal Edildi' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(20, 184, 166, 0.1)', color: appt.status === 'Bekliyor' ? '#f59e0b' : appt.status === 'İptal Edildi' ? '#ef4444' : 'var(--primary)', fontWeight: '600' }}>
                          {appt.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {appt.status === 'Bekliyor' && (
                      <button 
                        style={{ padding: '8px 16px', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', border: '1px solid rgba(20, 184, 166, 0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', transition: 'all 0.2s' }}
                        onClick={async () => {
                          const res = await fetchWithAuth(`${API_URL}/api/appointments/${appt.id}`, {
                            method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status: 'Onaylandı'})
                          });
                          if(res.ok) {
                            showToast('Randevu onaylandı!');
                            const apptRes = await fetchWithAuth(`${API_URL}/api/appointments/doctor/${user.id}`);
                            if(apptRes.ok) setAppointments(await apptRes.json());
                          }
                        }}
                      >
                        Onayla
                      </button>
                    )}
                    {(appt.status === 'Onaylandı' || appt.status === 'Devam Ediyor') && (
                      <button 
                        style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', transition: 'all 0.2s' }}
                        onClick={async () => {
                          setExamAppointment(appt);
                          setExamActiveTab('clinical');
                          setRadiologyFile(null);
                          setRadiologyData({ title: '', modality: 'XR', body_part: '', report: '' });
                          setLabData({ title: '', department: 'Biyokimya Laboratuvarı', results: [] });
                          setShowExamModal(true);
                          
                          // Fetch existing medical record for this appointment if any
                          try {
                            const recRes = await fetchWithAuth(`${API_URL}/api/medical-records/appointment/${appt.id}`);
                            if (recRes.ok) {
                              const recData = await recRes.json();
                              setExamData({
                                complaint: recData.complaint || '',
                                diagnosis: recData.diagnosis || '',
                                notes: recData.notes || '',
                                medicines: recData.medicines || ''
                              });
                            } else {
                              setExamData({ complaint: appt.reason || '', diagnosis: '', notes: '', medicines: '' });
                            }
                          } catch(e) {
                            setExamData({ complaint: appt.reason || '', diagnosis: '', notes: '', medicines: '' });
                          }

                          try {
                            const res = await fetchWithAuth(`${API_URL}/api/medical-records/patient/${appt.patient_id}`);
                            if(res.ok) setPatientHistory(await res.json());
                            else setPatientHistory([]);
                          } catch(e) { setPatientHistory([]); }
                        }}
                      >
                        {appt.status === 'Devam Ediyor' ? 'Muayeneye Devam Et' : 'Muayene Başlat'}
                      </button>
                    )}
                    {appt.status !== 'İptal Edildi' && appt.status !== 'Tamamlandı' && (
                      <button 
                        style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--card-border)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500', transition: 'all 0.2s' }} 
                        onMouseOver={(e) => e.currentTarget.style.background='rgba(239, 68, 68, 0.1)'} 
                        onMouseOut={(e) => e.currentTarget.style.background='transparent'}
                        onClick={async () => {
                          if(confirm('Randevuyu iptal etmek istediğinize emin misiniz?')) {
                            const res = await fetchWithAuth(`${API_URL}/api/appointments/${appt.id}`, {
                              method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status: 'İptal Edildi'})
                            });
                            if(res.ok) {
                              showToast('Randevu iptal edildi.');
                              const apptRes = await fetchWithAuth(`${API_URL}/api/appointments/doctor/${user.id}`);
                              if(apptRes.ok) setAppointments(await apptRes.json());
                            }
                          }
                        }}
                      >
                        İptal Et
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'patients':
        if (selectedPatient) return renderPatientDetail();

        return (
          <div className="doc-section" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
            <div className="doc-header" style={{ marginBottom: '32px' }}>
              <h1>Hastalarım</h1>
              <p>İlgilendiğiniz hastaların genel durumunu ve son ziyaretlerini takip edin.</p>
            </div>

            {/* Search Bar */}
            <div style={{ marginBottom: '24px', position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <input 
                type="text" 
                placeholder="Hasta adı ile ara..." 
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                style={{ width: '100%', padding: '16px 16px 16px 48px', borderRadius: '12px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '1rem', backdropFilter: 'blur(20px)', boxShadow: 'var(--shadow-sm)' }}
              />
            </div>
            
            {/* Patients Table */}
            <div className="doc-glass-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Hasta Adı</th>
                      <th>Yaş</th>
                      <th>Son Ziyaret</th>
                      <th>Tanı / Durum</th>
                      <th style={{ textAlign: 'right' }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.length > 0 ? filteredPatients.map(patient => (
                      <tr key={patient.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.875rem' }}>
                              {getInitials(patient.fullName)}
                            </div>
                            <span style={{ fontWeight: '500', color: 'var(--text-main)' }}>{patient.fullName}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{patient.age}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{patient.lastVisit}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{patient.diagnosis}</span>
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: patient.status === 'Aktif' ? 'rgba(20, 184, 166, 0.1)' : 'rgba(255, 255, 255, 0.05)', color: patient.status === 'Aktif' ? 'var(--primary)' : 'var(--text-muted)', width: 'fit-content' }}>
                              {patient.status}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => handlePatientDetailClick(patient)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-main)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background='rgba(255,255,255,0.05)'} onMouseOut={(e) => e.currentTarget.style.background='transparent'}>
                            Detay
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Arama kriterlerine uygun hasta bulunamadı.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="doc-section" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <div className="doc-header" style={{ marginBottom: '40px' }}>
              <h1>Profil Ayarlarım</h1>
              <p>Kişisel bilgilerinizi güncelleyip kaydedin. Değişiklikler anında yansıyacaktır.</p>
            </div>
            
            <div className="doc-glass-card" style={{ padding: '36px' }}>
              <form onSubmit={handleProfileSave} className={isShaking ? 'shake-animation' : ''}>
                
                {/* SECTION 1: Kişisel Bilgiler */}
                <div style={{ marginBottom: '32px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.125rem', color: 'var(--text-main)', marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid var(--card-border)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    Kişisel Bilgiler
                  </h4>



                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>Ad Soyad</label>
                      <div style={{ position: 'relative' }}>
                        <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        <input type="text" style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '0.95rem' }} value={tempProfileData.fullName} onChange={(e) => setTempProfileData({ ...tempProfileData, fullName: e.target.value })} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>
                        Doğum Tarihi
                        <span style={{ marginLeft: '8px', padding: '2px 8px', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>{calculateAge(tempProfileData.birthDate)} Yaşında</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                        </svg>
                        <input type="date" style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '0.95rem', colorScheme: 'dark', cursor: 'pointer' }} value={tempProfileData.birthDate} onChange={(e) => setTempProfileData({ ...tempProfileData, birthDate: e.target.value })} onClick={(e) => e.target.showPicker && e.target.showPicker()} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>Cinsiyet</label>
                      <div style={{ position: 'relative' }}>
                        <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z"/>
                        </svg>
                        <select style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '0.95rem', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }} value={tempProfileData.gender} onChange={(e) => setTempProfileData({ ...tempProfileData, gender: e.target.value })}>
                          <option value="kadin" style={{ background: '#18181b', color: '#fff' }}>Kadın</option>
                          <option value="erkek" style={{ background: '#18181b', color: '#fff' }}>Erkek</option>
                          <option value="belirtmek_istemiyor" style={{ background: '#18181b', color: '#fff' }}>Belirtmek İstemiyorum</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>Yaşadığı İl</label>
                      <div style={{ position: 'relative' }}>
                        <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        <select style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '0.95rem', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }} value={tempProfileData.city} onChange={(e) => setTempProfileData({ ...tempProfileData, city: e.target.value })}>
                          {turkishCities.map((city) => (
                            <option key={city} value={city} style={{ background: '#18181b', color: '#fff' }}>{city}</option>
                          ))}
                          <option value="Diğer" style={{ background: '#18181b', color: '#fff' }}>Diğer</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: İletişim Bilgileri */}
                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.125rem', color: 'var(--text-main)', marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid var(--card-border)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    İletişim & Sistem Kayıt Bilgileri
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>Telefon Numarası</label>
                      <div style={{ position: 'relative' }}>
                        <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/>
                        </svg>
                        <input type="tel" style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '0.95rem' }} value={tempProfileData.phone} onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length > 11) val = val.substring(0, 11);
                            let formatted = '';
                            if (val.length > 0) formatted += val.substring(0, 1);
                            if (val.length > 1) formatted += ' ' + val.substring(1, 4);
                            if (val.length > 4) formatted += ' ' + val.substring(4, 7);
                            if (val.length > 7) formatted += ' ' + val.substring(7, 9);
                            if (val.length > 9) formatted += ' ' + val.substring(9, 11);
                            setTempProfileData({ ...tempProfileData, phone: formatted });
                          }} placeholder="0 5XX XXX XX XX" />
                      </div>
                    </div>

                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>
                        E-Posta Adresi 
                        <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', marginLeft: '6px' }}>(Değiştirilemez)</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <input type="email" style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: '0.95rem', cursor: 'not-allowed', opacity: 0.7 }} value={tempProfileData.email} disabled />
                      </div>
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>
                        Uzmanlık Alanı / Poliklinik
                        <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', marginLeft: '6px' }}>(Değiştirilemez)</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                        </svg>
                        <input type="text" style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--card-border)', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: '600', cursor: 'not-allowed', opacity: 0.9 }} value={user?.specialty || ''} disabled />
                      </div>
                    </div>

                  </div>

                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>Adres (İsteğe Bağlı)</label>
                    <div style={{ position: 'relative' }}>
                      <svg style={{ position: 'absolute', left: '14px', top: '16px', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                      <textarea rows="3" style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '0.95rem', resize: 'vertical' }} value={tempProfileData.address} onChange={(e) => setTempProfileData({ ...tempProfileData, address: e.target.value })} placeholder="Açık adresinizi buraya girebilirsiniz..." maxLength={200}></textarea>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Şifre Değiştirme */}
                <div style={{ marginTop: '32px' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.125rem', color: 'var(--text-main)', marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid var(--card-border)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Güvenlik & Şifre Güncelleme
                  </h4>

                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>Mevcut Şifre</label>
                    <div style={{ position: 'relative' }}>
                      <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <input type="password" placeholder="Mevcut şifrenizi girin" style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '0.95rem' }} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>Yeni Şifre</label>
                      <div style={{ position: 'relative' }}>
                        <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <input type="password" placeholder="Yeni şifrenizi belirleyin" style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '0.95rem' }} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>Yeni Şifre (Tekrar)</label>
                      <div style={{ position: 'relative' }}>
                        <svg style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <input type="password" placeholder="Şifrenizi tekrar girin" style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '0.95rem' }} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 28px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: '600', boxShadow: '0 4px 14px rgba(20, 184, 166, 0.3)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                    </svg>
                    Değişiklikleri Kaydet
                  </button>
                </div>

              </form>
            </div>
          </div>
        );

      case 'availability':
        const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
        return (
          <div className="doc-section" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
            <div className="doc-header" style={{ marginBottom: '32px' }}>
              <h1>Çalışma Saatleri & İzinler</h1>
              <p>Profesyonel takviminizi yönetin. Mesai blokları, randevu süresi ve izin günlerinizi ayarlayın.</p>
            </div>
            
            <div className="doc-glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
              <h3 style={{ margin: '0 0 24px 0', color: 'var(--text-main)', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>Genel Ayarlar</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1, color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>Randevu Süresi (Dakika)</strong>
                  Hastalarınızın alacağı her randevunun kaç dakika süreceğini belirleyin.
                </div>
                <select 
                  style={{ width: '150px', padding: '12px', borderRadius: '8px', background: 'var(--card-bg)', border: '1px solid var(--primary)', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 'bold' }}
                  value={slotDuration}
                  onChange={(e) => setSlotDuration(Number(e.target.value))}
                >
                  <option value={10}>10 Dakika</option>
                  <option value={15}>15 Dakika</option>
                  <option value={20}>20 Dakika</option>
                  <option value={30}>30 Dakika</option>
                  <option value={45}>45 Dakika</option>
                  <option value={60}>60 Dakika</option>
                </select>
              </div>
            </div>

            <div className="doc-glass-card" style={{ padding: '32px', marginBottom: '32px' }}>
              <h3 style={{ margin: '0 0 24px 0', color: 'var(--text-main)', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>Haftalık Mesai Planı</h3>
              
              <form onSubmit={handleAvailabilitySave}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {days.map((dayName, dayIndex) => {
                    const daySchedules = schedules.filter(s => s.day_of_week === dayIndex);
                    return (
                      <div key={dayIndex} style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '1.1rem' }}>{dayName}</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {dayIndex === 0 && daySchedules.length > 0 && (
                              <button type="button" onClick={() => {
                                const newScheds = schedules.filter(s => s.day_of_week === 0 || s.day_of_week > 4);
                                for(let i=1; i<=4; i++) {
                                  daySchedules.forEach(ds => newScheds.push({ ...ds, day_of_week: i }));
                                }
                                setSchedules(newScheds);
                              }} style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--primary)', border: '1px solid rgba(20, 184, 166, 0.2)', borderRadius: '6px', cursor: 'pointer' }}>
                                Tüm İş Günlerine Kopyala
                              </button>
                            )}
                            <button type="button" onClick={() => {
                              setSchedules([...schedules, { day_of_week: dayIndex, start_time: '09:00', end_time: '12:00' }]);
                            }} style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px dashed var(--text-muted)', borderRadius: '6px', cursor: 'pointer' }}>
                              + Vardiya Ekle
                            </button>
                          </div>
                        </div>

                        {daySchedules.length === 0 ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Bu gün kapalı.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {daySchedules.map((sched, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input type="time" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', color: '#000', colorScheme: 'light' }} value={sched.start_time} onChange={e => {
                                  const newS = [...schedules];
                                  const sIdx = newS.findIndex(s => s === sched);
                                  newS[sIdx].start_time = e.target.value;
                                  setSchedules(newS);
                                }} />
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                                <input type="time" style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc', background: '#fff', color: '#000', colorScheme: 'light' }} value={sched.end_time} onChange={e => {
                                  const newS = [...schedules];
                                  const sIdx = newS.findIndex(s => s === sched);
                                  newS[sIdx].end_time = e.target.value;
                                  setSchedules(newS);
                                }} />
                                <button type="button" onClick={() => setSchedules(schedules.filter(s => s !== sched))} style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', marginLeft: '12px' }}>Sil</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" style={{ padding: '14px 28px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: '600' }}>Ayarları ve Saatleri Kaydet</button>
                </div>
              </form>
            </div>

            {/* Time Off Section */}
            <div className="doc-glass-card" style={{ padding: '32px' }}>
              <h3 style={{ margin: '0 0 24px 0', color: 'var(--text-main)', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>İzinler ve İstisnalar</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Kongre, tatil veya özel mazeretler için belirli tarihleri takvimden tamamen veya kısmen kapatabilirsiniz.</p>
              
              <form onSubmit={handleAddTimeOff} style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '32px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px dashed var(--card-border)' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tarih</label>
                  <input type="date" required style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)', colorScheme: 'dark' }} value={newTimeoff.date} onChange={e => setNewTimeoff({...newTimeoff, date: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Başlangıç (Tüm Günse Boş Bırakın)</label>
                  <input type="time" style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#fff', border: '1px solid #ccc', color: '#000', colorScheme: 'light' }} value={newTimeoff.start_time} onChange={e => setNewTimeoff({...newTimeoff, start_time: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Bitiş Saati</label>
                  <input type="time" style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#fff', border: '1px solid #ccc', color: '#000', colorScheme: 'light' }} value={newTimeoff.end_time} onChange={e => setNewTimeoff({...newTimeoff, end_time: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Açıklama</label>
                  <input type="text" placeholder="Kongre, Tatil..." style={{ width: '100%', padding: '10px', borderRadius: '6px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)' }} value={newTimeoff.reason} onChange={e => setNewTimeoff({...newTimeoff, reason: e.target.value})} />
                </div>
                <button type="submit" style={{ padding: '10px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', height: '42px' }}>İzin Ekle</button>
              </form>

              {timeoffs.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Henüz eklenmiş bir izin günü bulunmuyor.</div>
              ) : (
                <table className="doc-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '12px' }}>Tarih</th>
                      <th style={{ padding: '12px' }}>Saatler</th>
                      <th style={{ padding: '12px' }}>Açıklama</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeoffs.map(toff => (
                      <tr key={toff.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', color: 'var(--text-main)' }}>{toff.date}</td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                          {!toff.start_time ? <span style={{ color: '#ef4444', fontWeight: '600' }}>Tüm Gün Kapalı</span> : `${toff.start_time.substring(0,5)} - ${toff.end_time.substring(0,5)}`}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{toff.reason || '-'}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button onClick={() => handleDeleteTimeOff(toff.id)} style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Sil</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="doctor-dashboard">
      {/* Sidebar Navigation */}
      <aside className="doc-sidebar">
        
        {/* Brand Logo */}
        <div className="doc-brand">
          <div className="doc-brand-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
              <path d="M8 15v1a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-4"/>
              <circle cx="20" cy="10" r="2"/>
            </svg>
          </div>
          <h2>Hekimim</h2>
        </div>

        {/* Navigation Menu */}
        <nav className="doc-nav">
          <button 
            className={`doc-nav-item ${activeTab === 'appointments' ? 'active' : ''}`}
            onClick={() => setActiveTab('appointments')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Randevular
          </button>
          
          <button 
            className={`doc-nav-item ${activeTab === 'patients' ? 'active' : ''}`}
            onClick={() => setActiveTab('patients')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Hastalarım
          </button>
          
          <button 
            className={`doc-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Profil Ayarları
          </button>
          
          <button 
            className={`doc-nav-item ${activeTab === 'availability' ? 'active' : ''}`}
            onClick={() => setActiveTab('availability')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Çalışma Saatlerim
          </button>
        </nav>

        {/* User Profile */}
        <div className="doc-user-profile">
          <div className="doc-avatar">
            {getInitials(user?.fullName)}
          </div>
          <div className="doc-user-info">
            <span className="doc-user-name" title={user?.fullName || 'Uzm. Dr.'}>
              {user?.fullName || 'Uzm. Dr.'}
            </span>
            <span className="doc-user-role">{user?.specialty ? `${user.specialty} Uzmanı` : 'Uzman Doktor'}</span>
          </div>
          <button className="doc-logout-btn" onClick={onLogout} title="Çıkış Yap">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="doc-main-content">
        {renderContent()}
      </main>

      {/* Examination Modal */}
      {showExamModal && examAppointment && (
        <div className="dicom-viewer-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(8px)' }}>
          <div className="doc-glass-card" style={{ width: '100%', maxWidth: '1200px', height: '85vh', background: '#0f172a', border: '1px solid #1e293b', display: 'flex', position: 'relative', overflow: 'hidden', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)' }}>
            <button 
              type="button" 
              onClick={() => { setShowExamModal(false); setExamAppointment(null); }}
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', color: '#f8fafc', cursor: 'pointer', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, transition: 'all 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            {/* Left Panel: Patient History */}
            <div style={{ width: '35%', background: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '32px 24px 24px', borderBottom: '1px solid #334155' }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0, color: '#f8fafc' }}>{examAppointment.patient_name}</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>Geçmiş Ziyaretleri</p>
                  <button 
                    type="button"
                    onClick={() => { 
                      setShowExamModal(false); 
                      const pId = examAppointment.patient_id;
                      const pName = examAppointment.patient_name;
                      setExamAppointment(null); 
                      setActiveTab('patients');
                      setPatientTab('summary');
                      handlePatientDetailClick({ id: pId, fullName: pName });
                    }}
                    style={{ background: 'rgba(45, 212, 191, 0.1)', color: '#2dd4bf', border: '1px solid rgba(45, 212, 191, 0.2)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', fontWeight: '500' }}
                    onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(45, 212, 191, 0.2)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(45, 212, 191, 0.1)'; }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Profile Dön
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {patientHistory.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', marginTop: '40px' }}>Geçmiş muayene kaydı bulunamadı.</p>
                ) : (
                  patientHistory.map(record => (
                    <div key={record.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ fontWeight: '600', color: '#2dd4bf' }}>{record.date}</span>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', background: '#1e293b', padding: '2px 8px', borderRadius: '4px' }}>{record.doctor_specialty}</span>
                      </div>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#f8fafc', lineHeight: '1.4' }}><strong>Tanı:</strong> {record.diagnosis || 'Belirtilmedi'}</p>
                      {record.medicines && <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}><strong>Reçete:</strong> {record.medicines}</p>}
                      
                      {record.radiology_studies && record.radiology_studies.length > 0 && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #334155' }}>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Radyoloji Görüntüleri</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {record.radiology_studies.map(rad => (
                              <div key={rad.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                  {rad.title} ({rad.body_part})
                                </span>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setDoctorPacsStudy(rad); }} style={{ background: 'transparent', border: '1px solid #2dd4bf', color: '#2dd4bf', padding: '6px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 'bold' }} onMouseOver={(e) => {e.currentTarget.style.background='#2dd4bf'; e.currentTarget.style.color='#000'}} onMouseOut={(e) => {e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#2dd4bf'}}>
                                  PACS Görüntüle
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {record.lab_studies && record.lab_studies.length > 0 && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #334155' }}>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Laboratuvar Testleri</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {record.lab_studies.map(lab => (
                              <div key={lab.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/></svg>
                                  {lab.title}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                                  {lab.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Panel: Active Examination */}
            <div style={{ width: '65%', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: '24px', padding: '0 32px', borderBottom: '1px solid #334155' }}>
                <button 
                  onClick={() => setExamActiveTab('clinical')}
                  style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: examActiveTab === 'clinical' ? '600' : '500', color: examActiveTab === 'clinical' ? '#2dd4bf' : '#64748b', cursor: 'pointer', borderBottom: examActiveTab === 'clinical' ? '2px solid #2dd4bf' : '2px solid transparent', paddingBottom: '16px', transition: 'all 0.2s' }}
                >
                  Klinik Form
                </button>
                <button 
                  onClick={() => setExamActiveTab('radiology')}
                  style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: examActiveTab === 'radiology' ? '600' : '500', color: examActiveTab === 'radiology' ? '#2dd4bf' : '#64748b', cursor: 'pointer', borderBottom: examActiveTab === 'radiology' ? '2px solid #2dd4bf' : '2px solid transparent', paddingBottom: '16px', transition: 'all 0.2s' }}
                >
                  Radyoloji Yükle
                </button>
                <button 
                  onClick={() => setExamActiveTab('laboratory')}
                  style={{ background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: examActiveTab === 'laboratory' ? '600' : '500', color: examActiveTab === 'laboratory' ? '#2dd4bf' : '#64748b', cursor: 'pointer', borderBottom: examActiveTab === 'laboratory' ? '2px solid #2dd4bf' : '2px solid transparent', paddingBottom: '16px', transition: 'all 0.2s' }}
                >
                  Laboratuvar
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                {examActiveTab === 'clinical' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#94a3b8' }}>Şikayet</label>
                      <textarea className="dark-input" rows="3" placeholder="Hastanın şikayetleri..." value={examData.complaint} onChange={(e) => setExamData({...examData, complaint: e.target.value})}></textarea>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#94a3b8' }}>Tanı (ICD-10)</label>
                      <textarea className="dark-input" rows="3" placeholder="Konulan ön tanı veya kesin tanı..." value={examData.diagnosis} onChange={(e) => setExamData({...examData, diagnosis: e.target.value})}></textarea>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label" style={{ color: '#94a3b8' }}>Klinik Notlar (Öykü, Fizik Muayene vb.)</label>
                      <textarea className="dark-input" rows="4" placeholder="Muayene bulguları ve notlarınız..." value={examData.notes} onChange={(e) => setExamData({...examData, notes: e.target.value})}></textarea>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label" style={{ color: '#94a3b8' }}>E-Reçete (İlaçlar)</label>
                      <textarea className="dark-input" rows="2" placeholder="Örn: Klamer 500mg (Günde 2 Defa), Parol..." value={examData.medicines} onChange={(e) => setExamData({...examData, medicines: e.target.value})}></textarea>
                    </div>
                  </div>
                ) : examActiveTab === 'radiology' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#94a3b8' }}>Görüntü Dosyası</label>
                      <input type="file" className="dark-input" accept="image/*" onChange={(e) => {
                        setRadiologyFile(e.target.files[0]);
                        setAiResults(null);
                        setExpandedDisease(null);
                        setGradCamImages({});
                        setSelectedDiseases(new Set());
                      }} />
                      {radiologyFile && (
                        <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#fff', fontWeight: '500' }}>✨ Yapay Zeka Asistanı</span>
                            <button 
                              type="button"
                              onClick={analyzeXRay}
                              disabled={isAnalyzing}
                              style={{ 
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
                                color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', 
                                cursor: isAnalyzing ? 'not-allowed' : 'pointer', fontWeight: '600',
                                opacity: isAnalyzing ? 0.7 : 1, transition: 'all 0.2s'
                              }}
                            >
                              {isAnalyzing ? 'Analiz Ediliyor...' : 'Yapay Zeka ile Analiz Et'}
                            </button>
                          </div>
                          
                          {aiResults && (
                            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#94a3b8' }}>Olası Hastalık Analizleri (AI Fusion)</h4>
                              {aiResults.map((res, idx) => (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: expandedDisease === res.disease ? 'rgba(255,255,255,0.05)' : 'transparent', padding: expandedDisease === res.disease ? '8px' : '0', borderRadius: '8px', transition: 'all 0.3s' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                    <span style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <input 
                                        type="checkbox" 
                                        checked={selectedDiseases.has(res.disease)}
                                        onChange={(e) => {
                                          const newSet = new Set(selectedDiseases);
                                          if (e.target.checked) newSet.add(res.disease);
                                          else newSet.delete(res.disease);
                                          setSelectedDiseases(newSet);
                                        }}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#2dd4bf' }}
                                      />
                                      {res.disease}
                                      {res.is_detected && (
                                        <span style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
                                          ⚠️ Eşik Aşıldı
                                        </span>
                                      )}
                                      <button type="button" onClick={() => fetchGradCam(res.disease)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#94a3b8', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#fff'} onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}>
                                        🔍 Analize Bak
                                      </button>
                                    </span>
                                    <span style={{ color: res.percentage > 50 ? '#ef4444' : res.percentage > 20 ? '#f59e0b' : '#2dd4bf', fontWeight: '600' }}>%{res.percentage}</span>
                                  </div>
                                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
                                    <div style={{ height: '100%', width: `${res.percentage}%`, background: res.percentage > 50 ? '#ef4444' : res.percentage > 20 ? '#f59e0b' : '#2dd4bf', borderRadius: '3px' }}></div>
                                  </div>
                                  {expandedDisease === res.disease && (
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px', textAlign: 'center' }}>Orijinal Görüntü</div>
                                        <img src={URL.createObjectURL(radiologyFile)} alt="Original" style={{ width: '100%', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.7rem', color: '#2dd4bf', marginBottom: '4px', textAlign: 'center' }}>Isı Haritası</div>
                                        {gradCamImages[res.disease] ? (
                                          <img src={gradCamImages[res.disease].gradcam} alt="Grad-CAM" style={{ width: '100%', borderRadius: '4px', border: '1px solid #2dd4bf' }} />
                                        ) : isGradCamLoading ? (
                                          <div style={{ width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.75rem', color: '#94a3b8' }}>Hesaplanıyor...</div>
                                        ) : null}
                                      </div>

                                    </div>
                                  )}
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedDiseases.size === 0) {
                                    setToastMessage("Lütfen rapora aktarmak için en az bir sonuç seçin.");
                                    return;
                                  }
                                    const selectedResults = aiResults.filter(r => selectedDiseases.has(r.disease));
                                    const aiText = "--- Model Kararı ---\n" + selectedResults.map(r => `${r.disease}: %${r.percentage}`).join('\n') + "\n--------------------------\n\n";
                                    setRadiologyData(prev => ({...prev, report: aiText + prev.report}));
                                  setToastMessage("Seçilen yapay zeka sonuçları rapora aktarıldı.");
                                }}
                                style={{ marginTop: '12px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s' }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                              >
                                📝 Seçilenleri Rapora Aktar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#94a3b8' }}>Görüntü Başlığı (Örn: Akciğer Grafisi)</label>
                        <input type="text" className="dark-input" value={radiologyData.title} onChange={(e) => setRadiologyData({...radiologyData, title: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#94a3b8' }}>Modalite</label>
                        <select className="dark-input" value={radiologyData.modality} onChange={(e) => setRadiologyData({...radiologyData, modality: e.target.value})}>
                          <option value="XR">Röntgen (XR)</option>
                          <option value="CT">Tomografi (CT)</option>
                          <option value="MR">Manyetik Rezonans (MR)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label" style={{ color: '#94a3b8' }}>Vücut Bölgesi (Örn: Toraks, Sol Diz)</label>
                        <input type="text" className="dark-input" value={radiologyData.body_part} onChange={(e) => setRadiologyData({...radiologyData, body_part: e.target.value})} />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label className="form-label" style={{ color: '#94a3b8', margin: 0 }}>Radyoloji Raporu / Hekim Yorumu</label>
                          {aiResults && aiResults.length > 0 && (
                            <button
                              type="button"
                              onClick={async () => {
                                const selected = aiResults.filter(r => selectedDiseases.has(r.disease));
                                if(selected.length === 0) {
                                  setToastMessage("Lütfen LLM'e göndermek için en az bir hastalık seçin.");
                                  return;
                                }
                                setToastMessage("LLM raporu oluşturuluyor, lütfen bekleyin...");
                                try {
                                  const res = await fetchWithAuth(`${API_URL}/api/ai/generate-report`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      patient_info: `${examAppointment?.patient?.age || 40} yaşında ${examAppointment?.patient?.gender || 'Bilinmeyen'} hasta`,
                                      study_info: `${radiologyData?.modality || ''} - ${radiologyData?.body_part || ''}`,
                                      clinical_history: examData.complaint || "Belirtilmemiş",
                                      ai_results: selected
                                    })
                                  });
                                  const data = await res.json();
                                  if(data.success) {
                                    setRadiologyData(prev => ({...prev, report: (prev.report ? prev.report + '\n\n' : '') + data.report}));
                                    setToastMessage("LLM Raporu başarıyla oluşturuldu.");
                                  } else {
                                    setToastMessage("Rapor oluşturulamadı.");
                                  }
                                } catch (e) {
                                  setToastMessage("LLM API Hatası.");
                                }
                              }}
                              style={{ background: 'linear-gradient(135deg, #8b5cf6, #d946ef)', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                              onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                              onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                            >
                              ✨ LLM ile Taslak Üret
                            </button>
                          )}
                        </div>
                        <textarea className="dark-input" rows="7" placeholder="Görüntüye dair raporunuz..." value={radiologyData.report} onChange={(e) => setRadiologyData({...radiologyData, report: e.target.value})}></textarea>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn-save" 
                        style={{ background: '#2dd4bf', color: '#0f172a', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', border: 'none', transition: 'all 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        onClick={async () => {
                          if (!radiologyFile) {
                            setToastMessage('Lütfen bir görüntü dosyası seçin.');
                            return;
                          }
                          if (!radiologyData.title.trim() || !radiologyData.body_part.trim()) {
                            setToastMessage('Lütfen görüntü başlığı ve vücut bölgesini eksiksiz girin.');
                            return;
                          }
                          const formData = new FormData();
                          formData.append('file', radiologyFile);
                          formData.append('patient_id', examAppointment.patient_id);
                          formData.append('doctor_id', user.id);
                          formData.append('appointment_id', examAppointment.id);
                          formData.append('title', radiologyData.title);
                          formData.append('modality', radiologyData.modality);
                          formData.append('body_part', radiologyData.body_part);
                          formData.append('report', radiologyData.report);
                          if (aiResults) {
                            formData.append('ai_results', JSON.stringify(aiResults));
                          }

                          try {
                            const res = await fetchWithAuth(`${API_URL}/api/radiology/upload`, {
                              method: 'POST',
                              body: formData
                            });
                            if (res.ok) {
                              setToastMessage('Radyoloji görüntüsü başarıyla yüklendi.');
                              setRadiologyFile(null);
                              setAiResults(null);
                              setExpandedDisease(null);
                              setGradCamImages({});
                              setSelectedDiseases(new Set());
                              setRadiologyData({ title: '', modality: 'XR', body_part: '', report: '' });
                            } else {
                              const data = await res.json();
                              setToastMessage(data.detail || 'Yükleme hatası.');
                            }
                          } catch(e) {
                            setToastMessage('Sunucu hatası.');
                          }
                        }}
                      >
                        Görüntüyü Yükle
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Template Loader */}
                    <div style={{ background: 'rgba(45, 212, 191, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(45, 212, 191, 0.2)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <label style={{ color: '#2dd4bf', fontWeight: '600', flexShrink: 0 }}>Hızlı Şablon Yükle:</label>
                      <select 
                        className="dark-input" 
                        style={{ borderColor: 'rgba(45, 212, 191, 0.3)' }}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setLabData({ title: '', department: 'Biyokimya Laboratuvarı', results: [] });
                          } else if (LAB_TEMPLATES[val]) {
                            setLabData({ 
                              title: val, 
                              department: LAB_TEMPLATES[val].department, 
                              // Create a deep copy so we don't mutate the template
                              results: JSON.parse(JSON.stringify(LAB_TEMPLATES[val].results)) 
                            });
                          }
                        }}
                      >
                        <option value="">-- Boş Form (Manuel Giriş) --</option>
                        {Object.keys(LAB_TEMPLATES).map(tpl => (
                          <option key={tpl} value={tpl}>{tpl}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#94a3b8' }}>Tahlil Başlığı (Örn: Tam Kan Sayımı)</label>
                        <input type="text" className="dark-input" value={labData.title} onChange={(e) => setLabData({...labData, title: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ color: '#94a3b8' }}>İlgili Bölüm</label>
                        <select className="dark-input" value={labData.department} onChange={(e) => setLabData({...labData, department: e.target.value})}>
                          <option value="Biyokimya Laboratuvarı">Biyokimya Laboratuvarı</option>
                          <option value="Hemotoloji">Hemotoloji</option>
                          <option value="Mikrobiyoloji">Mikrobiyoloji</option>
                          <option value="Hormon Laboratuvarı">Hormon Laboratuvarı</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ background: '#1e293b', borderRadius: '8px', padding: '16px', border: '1px solid #334155' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ color: '#f8fafc', margin: 0 }}>Parametreler</h4>
                        <button 
                          style={{ padding: '6px 12px', background: 'rgba(45, 212, 191, 0.1)', color: '#2dd4bf', border: '1px solid #2dd4bf', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem' }}
                          onClick={() => {
                            setLabData({
                              ...labData,
                              results: [...labData.results, { name: '', value: '', unit: '', range: '', status: 'normal' }]
                            });
                          }}
                        >
                          + Parametre Ekle
                        </button>
                      </div>

                      {labData.results.map((param, index) => (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1fr auto', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
                          <input type="text" className="dark-input" placeholder="Test Adı" maxLength={50} value={param.name} onChange={(e) => {
                            const newResults = [...labData.results];
                            newResults[index].name = e.target.value;
                            setLabData({...labData, results: newResults});
                          }} />
                          <input type="text" className="dark-input" placeholder="Değer" maxLength={15} value={param.value} onChange={(e) => {
                            const newResults = [...labData.results];
                            newResults[index].value = e.target.value;
                            setLabData({...labData, results: newResults});
                          }} />
                          <input type="text" className="dark-input" placeholder="Birim" maxLength={20} value={param.unit} onChange={(e) => {
                            const newResults = [...labData.results];
                            newResults[index].unit = e.target.value;
                            setLabData({...labData, results: newResults});
                          }} />
                          <input type="text" className="dark-input" placeholder="Referans Aralığı" maxLength={30} value={param.range} onChange={(e) => {
                            const newResults = [...labData.results];
                            newResults[index].range = e.target.value;
                            setLabData({...labData, results: newResults});
                          }} />
                          <select className="dark-input" value={param.status} onChange={(e) => {
                            const newResults = [...labData.results];
                            newResults[index].status = e.target.value;
                            setLabData({...labData, results: newResults});
                          }}>
                            <option value="normal">Normal</option>
                            <option value="low">Düşük</option>
                            <option value="high">Yüksek</option>
                          </select>
                          <button 
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', padding: '8px' }}
                            onClick={() => {
                              const newResults = [...labData.results];
                              newResults.splice(index, 1);
                              setLabData({...labData, results: newResults});
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {labData.results.length === 0 && (
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', margin: '24px 0' }}>Henüz parametre eklenmedi.</p>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn-save" 
                        style={{ background: '#2dd4bf', color: '#0f172a', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', border: 'none', transition: 'all 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        onClick={async () => {
                          if (!labData.title.trim()) {
                            setToastMessage('Lütfen tahlil başlığını girin.');
                            return;
                          }
                          if (labData.results.length === 0) {
                            setToastMessage('Kaydetmek için en az 1 parametre eklemelisiniz.');
                            return;
                          }
                          const hasEmptyParam = labData.results.some(p => !p.name.trim() || !p.value.trim());
                          if (hasEmptyParam) {
                            setToastMessage('Lütfen tüm parametrelerin "Test Adı" ve "Değer" alanlarını doldurun.');
                            return;
                          }
                          const hasExaggeratedValue = labData.results.some(p => p.value.length > 15);
                          if (hasExaggeratedValue) {
                            setToastMessage('Girdiğiniz değer çok uzun veya mantıksız. Lütfen kontrol edin.');
                            return;
                          }
                          try {
                            const res = await fetchWithAuth(`${API_URL}/api/lab-studies/`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                appointment_id: examAppointment.id,
                                title: labData.title,
                                department: labData.department,
                                results: labData.results
                              })
                            });
                            if (res.ok) {
                              setToastMessage('Tahlil sonuçları başarıyla kaydedildi.');
                              setLabData({ title: '', department: 'Biyokimya Laboratuvarı', results: [] });
                            } else {
                              const data = await res.json();
                              setToastMessage(data.detail || 'Kaydetme hatası.');
                            }
                          } catch(e) {
                            setToastMessage('Sunucu hatası.');
                          }
                        }}
                      >
                        Sonuçları Kaydet
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div style={{ padding: '24px 32px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'flex-end', gap: '16px', background: '#0f172a' }}>
                <button 
                  className="btn-save" 
                  style={{ background: '#1e293b', color: '#f8fafc', padding: '14px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', border: '1px solid #334155', transition: 'all 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#334155'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#1e293b'}
                  onClick={async () => {
                    try {
                      const res = await fetchWithAuth(`${API_URL}/api/medical-records/?is_completed=false`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          appointment_id: examAppointment.id,
                          complaint: examData.complaint,
                          diagnosis: examData.diagnosis,
                          notes: examData.notes,
                          medicines: examData.medicines
                        })
                      });
                      if (res.ok) {
                        setToastMessage('Muayene taslak olarak kaydedildi.');
                        const apptRes = await fetchWithAuth(`${API_URL}/api/appointments/doctor/${user.id}`);
                        if(apptRes.ok) setAppointments(await apptRes.json());
                      } else {
                        const data = await res.json();
                        setToastMessage(data.detail || 'Bir hata oluştu.');
                      }
                    } catch(e) {
                      setToastMessage('Sunucuya bağlanılamadı.');
                    }
                  }}
                >
                  Muayeneyi Kaydet
                </button>
                <button 
                  className="btn-save" 
                  style={{ background: '#2563eb', color: '#ffffff', padding: '14px 32px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', border: 'none', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  onClick={async () => {
                    if (!examData.complaint.trim() && !examData.diagnosis.trim()) {
                      setToastMessage('Muayeneyi tamamlamak için en azından Şikayet veya Tanı girmelisiniz.');
                      setIsShaking(true); setTimeout(() => setIsShaking(false), 400);
                      return;
                    }
                    try {
                      const res = await fetchWithAuth(`${API_URL}/api/medical-records/?is_completed=true`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          appointment_id: examAppointment.id,
                          complaint: examData.complaint,
                          diagnosis: examData.diagnosis,
                          notes: examData.notes,
                          medicines: examData.medicines
                        })
                      });
                      if (res.ok) {
                        setToastMessage('Muayene başarıyla kaydedildi ve randevu tamamlandı.');
                        setShowExamModal(false);
                        setExamAppointment(null);
                        const apptRes = await fetchWithAuth(`${API_URL}/api/appointments/doctor/${user.id}`);
                        if(apptRes.ok) setAppointments(await apptRes.json());
                      } else {
                        const data = await res.json();
                        setIsShaking(true); setTimeout(() => setIsShaking(false), 400);
                        setToastMessage(data.detail || 'Bir hata oluştu.');
                      }
                    } catch(e) {
                      setIsShaking(true); setTimeout(() => setIsShaking(false), 400);
                      setToastMessage('Sunucuya bağlanılamadı.');
                    }
                  }}
                >
                  Kaydet ve Tamamla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DOCTOR PACS VIEWER MODAL ==================== */}
      {doctorPacsStudy && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
          {/* PACS Header */}
          <div style={{ padding: '16px 24px', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#2dd4bf', fontWeight: 'bold', fontSize: '1.2rem', letterSpacing: '1px' }}>PACS</span>
                <span style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{doctorPacsStudy.modality}</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'flex', gap: '16px' }}>
                <span><strong>Hasta:</strong> {doctorPacsStudy.patient_name}</span>
                <span><strong>Tarih:</strong> {doctorPacsStudy.date}</span>
                <span><strong>Bölge:</strong> {doctorPacsStudy.body_part}</span>
              </div>
            </div>
            <button 
              onClick={() => {
                setDoctorPacsStudy(null);
                setDoctorPacsExpandedDisease(null);
                setDoctorPacsGradCamImages({});
                setDoctorPacsZoom(1);
                setDoctorPacsPan({ x: 0, y: 0 });
              }} 
              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: '600' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              KAPAT
            </button>
          </div>

          {/* PACS Main Body */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            
            {/* SIDEBAR: Medical Report & AI Analysis */}
            <div style={{ width: '450px', background: '#111', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
              {/* Doctor Report */}
              <div style={{ padding: '24px', borderBottom: '1px solid #333' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  Radyoloji Raporu
                </h3>
                <div style={{ background: '#000', padding: '16px', borderRadius: '8px', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.6', border: '1px solid #333', whiteSpace: 'pre-wrap' }}>
                  {doctorPacsStudy.report || 'Bu tetkik için henüz bir rapor veya yorum yazılmamış.'}
                </div>
              </div>

              {/* AI Black Box Analysis */}
              {doctorPacsStudy.ai_analyses && doctorPacsStudy.ai_analyses.length > 0 && (
                <div style={{ padding: '24px' }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#2dd4bf', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ✨ Orijinal Yapay Zeka Analizi
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '16px' }}>Bu veriler hastadan gizli olarak "Kara Kutu" arşivinden getirilmiştir.</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {doctorPacsStudy.ai_analyses[0].results.map((res, idx) => (
                      <div key={idx} style={{ background: doctorPacsExpandedDisease === res.disease ? '#222' : 'transparent', padding: doctorPacsExpandedDisease === res.disease ? '12px' : '0', borderRadius: '8px', transition: 'all 0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                          <span style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {res.disease}
                            {res.is_detected && (
                              <span style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
                                ⚠️ Eşik Aşıldı
                              </span>
                            )}
                            <button 
                              type="button" 
                              onClick={() => fetchDoctorPacsGradCam(res.disease, doctorPacsStudy.file_url)} 
                              style={{ background: 'transparent', border: '1px solid #444', color: '#94a3b8', fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }} 
                              onMouseOver={(e) => e.currentTarget.style.color = '#fff'} 
                              onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                            >
                              🔍 Isı Haritası Çiz
                            </button>
                          </span>
                          <span style={{ color: res.percentage > 50 ? '#ef4444' : res.percentage > 20 ? '#f59e0b' : '#2dd4bf', fontWeight: '600' }}>%{res.percentage}</span>
                        </div>
                        <div style={{ height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden', marginTop: '8px', marginBottom: '4px' }}>
                          <div style={{ height: '100%', width: `${res.percentage}%`, background: res.percentage > 50 ? '#ef4444' : res.percentage > 20 ? '#f59e0b' : '#2dd4bf', borderRadius: '3px' }}></div>
                        </div>

                        {doctorPacsExpandedDisease === res.disease && (
                          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.7rem', color: '#2dd4bf', marginBottom: '8px', textAlign: 'center', fontWeight: 'bold' }}>Isı Haritası</div>
                              {doctorPacsGradCamImages[res.disease] ? (
                                <img src={doctorPacsGradCamImages[res.disease].gradcam} alt="Grad-CAM" style={{ width: '100%', borderRadius: '8px', border: '2px solid #2dd4bf' }} />
                              ) : isDoctorPacsGradCamLoading ? (
                                <div style={{ width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', borderRadius: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>Üretiliyor...</div>
                              ) : null}
                            </div>

                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* MAIN IMAGE VIEWER */}
            <div style={{ flex: 1, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: '24px' }}>
              {/* Zoom Controls */}
              <div style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px', backdropFilter: 'blur(10px)', zIndex: 10 }}>
                <button onClick={() => setDoctorPacsZoom(prev => Math.min(prev + 0.2, 5))} style={{ width: '40px', height: '40px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }} onMouseOver={(e) => {e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#fff'}} onMouseOut={(e) => {e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#94a3b8'}}>+</button>
                <div style={{ color: '#fff', fontSize: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>{Math.round(doctorPacsZoom * 100)}%</div>
                <button onClick={() => setDoctorPacsZoom(prev => Math.max(prev - 0.2, 0.5))} style={{ width: '40px', height: '40px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }} onMouseOver={(e) => {e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#fff'}} onMouseOut={(e) => {e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#94a3b8'}}>-</button>
              </div>

              {/* The Radiology Image */}
              <div 
                style={{ 
                  position: 'relative', 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  transform: `translate(${doctorPacsPan.x}px, ${doctorPacsPan.y}px) scale(${doctorPacsZoom})`, 
                  transition: isDoctorPacsDragging ? 'none' : 'transform 0.1s', 
                  cursor: isDoctorPacsDragging ? 'grabbing' : 'grab' 
                }}
                onWheel={(e) => {
                  if (e.deltaY < 0) {
                    setDoctorPacsZoom(prev => Math.min(prev + 0.1, 5));
                  } else {
                    setDoctorPacsZoom(prev => Math.max(prev - 0.1, 0.5));
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDoctorPacsDragging(true);
                  setDoctorPacsDragStart({ x: e.clientX - doctorPacsPan.x, y: e.clientY - doctorPacsPan.y });
                }}
                onMouseMove={(e) => {
                  if (isDoctorPacsDragging) {
                    setDoctorPacsPan({
                      x: e.clientX - doctorPacsDragStart.x,
                      y: e.clientY - doctorPacsDragStart.y
                    });
                  }
                }}
                onMouseUp={() => setIsDoctorPacsDragging(false)}
                onMouseLeave={() => setIsDoctorPacsDragging(false)}
              >
                <img 
                  src={doctorPacsStudy.file_url} 
                  alt="Radiology Study" 
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', pointerEvents: 'none' }} 
                />
              </div>

              {/* Meta Info */}
              <div style={{ position: 'absolute', bottom: '24px', left: '24px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px', pointerEvents: 'none' }}>
                <div>Patient: {doctorPacsStudy.patient_name}</div>
                <div>Study Date: {doctorPacsStudy.date}</div>
                <div>Modality: {doctorPacsStudy.modality}</div>
              </div>
              <div style={{ position: 'absolute', bottom: '24px', right: '24px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', pointerEvents: 'none' }}>
                <div>HEKIMIM PACS</div>
                <div>Lossless Compression</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', background: 'var(--card-bg)', border: '1px solid var(--primary)', color: 'var(--text-main)', padding: '16px 24px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span style={{ fontWeight: '500' }}>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};

export default DoctorDashboard;
