import React, { useState, useEffect } from 'react'
import html2pdf from 'html2pdf.js'
import './PatientDashboard.css'
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


function PatientDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview') // 'overview', 'visits', 'radiology', 'labs', 'prescriptions', or 'profile'
  const [toastMessage, setToastMessage] = useState('')
  const [isToastWarning, setIsToastWarning] = useState(false)
  const [isShaking, setIsShaking] = useState(false)

  // Search filter state for full-page visits
  const [visitSearch, setVisitSearch] = useState('')

  // Interactive DICOM Viewer States
  const [selectedRadiology, setSelectedRadiology] = useState(null)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [zoom, setZoom] = useState(1)
  const [gridActive, setGridActive] = useState(true)
  const [inverted, setInverted] = useState(false)

  // Laboratory Results Viewer States
  const [selectedLab, setSelectedLab] = useState(null)
  const [selectedPrescription, setSelectedPrescription] = useState(null)

  // Profile Form States (initially loaded with beautiful mock defaults)
  const [profileData, setProfileData] = useState({
    fullName: user?.fullName && !user.fullName.includes('T.C:') ? user.fullName : 'Ahmet Yılmaz',
    birthDate: '1998-05-15',
    bloodType: 'A Rh(+)',
    height: '178',
    weight: '72',
    phone: '0532 123 4567',
    email: 'ahmet.yilmaz@kurumadi.com',
    city: 'İstanbul'
  })

  // Appointment states
  const [appointments, setAppointments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [showAppointmentModal, setShowAppointmentModal] = useState(false)
  const [selectedSpecialty, setSelectedSpecialty] = useState('')
  const [newAppointment, setNewAppointment] = useState({
    doctor_id: '',
    appointment_date: '',
    appointment_time: '',
    reason: ''
  })
  const [availableSlots, setAvailableSlots] = useState([])

  useEffect(() => {
    if(newAppointment.doctor_id && newAppointment.appointment_date) {
      const fetchSlots = async () => {
        try {
          const res = await fetchWithAuth(`${API_URL}/api/appointments/available-slots?doctor_id=${newAppointment.doctor_id}&appointment_date=${newAppointment.appointment_date}`);
          if(res.ok) {
            setAvailableSlots(await res.json());
          }
        } catch(e) { console.error(e); }
      };
      fetchSlots();
    } else {
      setAvailableSlots([]);
    }
  }, [newAppointment.doctor_id, newAppointment.appointment_date]);

  // Fetch true patient data, doctors, and appointments on mount
  useEffect(() => {
    if (user && user.id) {
      const fetchData = async () => {
        try {
          // Fetch Patient Profile
          const profileRes = await fetchWithAuth(`${API_URL}/api/patients/${user.id}`);
          if (profileRes.ok) {
            const data = await profileRes.json();
            const loadedData = {
              fullName: `${data.first_name} ${data.last_name}`,
              birthDate: data.date_of_birth ? String(data.date_of_birth) : '1990-01-01',
              bloodType: data.blood_type || 'Bilinmiyor',
              height: data.height_cm || '',
              weight: data.weight_kg || '',
              phone: data.phone_number || '',
              email: data.email || '',
              city: data.city || 'İstanbul'
            };
            setProfileData(loadedData);
            // Assuming tempProfileData is initialized elsewhere, we'll keep this if it exists
            if (typeof setTempProfileData !== 'undefined') setTempProfileData(loadedData);
          }

          // Fetch Doctors
          const docRes = await fetchWithAuth(`${API_URL}/api/doctors/`);
          if (docRes.ok) {
            const docData = await docRes.json();
            setDoctors(docData);
          }

          // Fetch Patient Appointments
          const apptRes = await fetchWithAuth(`${API_URL}/api/appointments/patient/${user.id}`);
          if (apptRes.ok) {
            const apptData = await apptRes.json();
            setAppointments(apptData);
          }

          // Fetch Medical Records
          const recRes = await fetchWithAuth(`${API_URL}/api/medical-records/patient/${user.id}`);
          if (recRes.ok) {
            const recData = await recRes.json();
            
            // Map medical records to pastVisits format
            const mappedVisits = recData.map(r => ({
              id: r.id,
              hospital: 'Sistem Hastanesi', // Default hospital
              department: r.doctor_specialty || 'Poliklinik',
              doctor: r.doctor_name,
              date: r.date,
              status: 'Tamamlandı',
              diagnosis: r.diagnosis || 'Tanı girilmedi',
              prescription: r.prescription_no ? `Reçete (#${r.prescription_no})` : 'Reçete Yok',
              hasLabResult: false,
              hasRadiology: false
            }));
            setPastVisits(mappedVisits);

            // Extract prescriptions
            const mappedPrescriptions = recData
              .filter(r => r.prescription_no)
              .map(r => ({
                id: r.id,
                prescriptionNo: r.prescription_no,
                hospital: 'Sistem Hastanesi',
                doctor: r.doctor_name,
                date: r.date,
                medicines: r.medicines
              }));
            setPrescriptions(mappedPrescriptions);
          }

          // Fetch Radiology
          const radRes = await fetchWithAuth(`${API_URL}/api/radiology/patient/${user.id}`);
          if (radRes.ok) {
            const radData = await radRes.json();
            setRadiologyStudies(radData.map(r => ({
              id: r.id,
              title: r.title,
              hospital: 'Sistem Hastanesi',
              doctor: r.doctor_name,
              date: r.date,
              modality: r.modality,
              bodyPart: r.body_part,
              status: 'Raporlandı',
              imagePreview: r.file_url,
              report: r.report
            })));
          }

          // Fetch Lab Studies
          const labRes = await fetchWithAuth(`${API_URL}/api/lab-studies/patient/${user.id}`);
          if (labRes.ok) {
            setLabStudies(await labRes.json());
          }
        } catch (error) {
          console.error("Failed to fetch data:", error);
        }
      };
      fetchData();
    }
  }, [user]);

  // Past Visits State (Fetched from API)
  const [pastVisits, setPastVisits] = useState([])

  // Dedicated Radiology Studies List (Mock)
  const [radiologyStudies, setRadiologyStudies] = useState([])

  // Dedicated Lab Studies List (Fetched from API)
  const [labStudies, setLabStudies] = useState([])

  // Dedicated Prescriptions List (Fetched from API)
  const [prescriptions, setPrescriptions] = useState([])

  // Password States
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  // Temporary state for the form during edits
  const [tempProfileData, setTempProfileData] = useState({ ...profileData })

  // Real-time Age Calculation
  const calculateAge = (birthDateStr) => {
    if (!birthDateStr) return 0
    const birthDate = new Date(birthDateStr)
    const today = new Date('2026-05-22') // Current local time system date
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  // Real-time BMI Calculation
  const calculateBMI = (h, w) => {
    const heightInMeters = parseFloat(h) / 100
    const weightInKg = parseFloat(w)
    if (!heightInMeters || !weightInKg || isNaN(heightInMeters) || isNaN(weightInKg)) {
      return { score: '—', status: 'Bilinmiyor' }
    }
    const score = (weightInKg / (heightInMeters * heightInMeters)).toFixed(1)
    let status = 'Normal'
    if (score < 18.5) status = 'Zayıf'
    else if (score >= 25 && score < 30) status = 'Fazla Kilolu'
    else if (score >= 30) status = 'Obez'
    return { score, status }
  }

  const triggerMockAction = (actionName) => {
    setToastMessage(`"${actionName}" özelliği geliştirme aşamasındadır.`);
  }

  const generatePDF = async (lab) => {
    // PDF render element
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="padding: 40px; font-family: 'Inter', sans-serif; color: #1e293b;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px;">
          <div>
            <h1 style="margin: 0; color: #0f172a; font-size: 24px;">Medical AI Hastanesi</h1>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Tıbbi Laboratuvar Sonuç Raporu</p>
          </div>
          <div style="text-align: right; font-size: 14px; color: #475569;">
            <p style="margin: 0;"><strong>Tarih:</strong> ${lab.date}</p>
            <p style="margin: 4px 0 0 0;"><strong>Rapor No:</strong> LAB-${lab.id}9182</p>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; font-size: 14px;">
          <div>
            <p style="margin: 0 0 8px 0;"><strong>Hasta Adı:</strong> ${profileData.fullName}</p>
            <p style="margin: 0 0 8px 0;"><strong>Doğum Tarihi:</strong> ${profileData.birthDate}</p>
            <p style="margin: 0;"><strong>Kan Grubu:</strong> ${profileData.bloodType}</p>
          </div>
          <div>
            <p style="margin: 0 0 8px 0;"><strong>İsteyen Hekim:</strong> ${lab.doctor_name}</p>
            <p style="margin: 0 0 8px 0;"><strong>Bölüm:</strong> ${lab.department}</p>
            <p style="margin: 0;"><strong>Tetkik:</strong> ${lab.title}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="text-align: left; padding: 12px 8px; color: #334155;">Test Adı</th>
              <th style="text-align: left; padding: 12px 8px; color: #334155;">Sonuç</th>
              <th style="text-align: left; padding: 12px 8px; color: #334155;">Birim</th>
              <th style="text-align: left; padding: 12px 8px; color: #334155;">Referans Aralığı</th>
              <th style="text-align: left; padding: 12px 8px; color: #334155;">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${lab.results.map(res => {
              let statusText = 'Normal';
              let statusColor = '#10b981'; // green
              if (res.status === 'high') { statusText = 'Yüksek'; statusColor = '#ef4444'; }
              else if (res.status === 'low') { statusText = 'Düşük'; statusColor = '#3b82f6'; }
              
              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px 8px; font-weight: 600; color: #0f172a;">${res.name}</td>
                  <td style="padding: 12px 8px; font-weight: 700; color: ${statusColor};">${res.value}</td>
                  <td style="padding: 12px 8px; color: #64748b;">${res.unit}</td>
                  <td style="padding: 12px 8px; color: #94a3b8;">${res.range}</td>
                  <td style="padding: 12px 8px; font-weight: 600; color: ${statusColor};">${statusText}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
          <p style="margin: 0;">Bu rapor elektronik ortamda üretilmiştir ve e-imza ile imzalanmıştır.</p>
          <p style="margin: 4px 0 0 0;">Medical AI Hastanesi - Laboratuvar Bilgi Sistemi</p>
        </div>
      </div>
    `;

    setToastMessage("PDF raporunuz hazırlanıyor, lütfen bekleyin...");
    
    const opt = {
      margin:       0,
      filename:     `Laboratuvar_Raporu_${lab.title.replace(/ /g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(element).set(opt).save().then(() => {
      setToastMessage("Rapor başarıyla indirildi.");
    }).catch((err) => {
      console.error(err);
      setToastMessage("PDF oluşturulurken bir hata oluştu.");
    });
  };

  const showToast = (message, isWarning = false) => {
    setToastMessage(message)
    setIsToastWarning(isWarning)
    setTimeout(() => {
      setToastMessage('')
    }, 4000)
  }

  // Save changes handler
  const handleProfileSave = async (e) => {
    e.preventDefault()

    // Validate inputs are filled
    if (!tempProfileData.fullName || !tempProfileData.birthDate || !tempProfileData.height || !tempProfileData.weight || !tempProfileData.phone) {
      triggerFormError('Lütfen tüm temel profil bilgilerini doldurun!')
      return
    }

    // Validate height/weight are numeric and within bounds
    if (isNaN(tempProfileData.height) || tempProfileData.height < 50 || tempProfileData.height > 299) {
      triggerFormError('Lütfen geçerli bir boy (50-299 cm) girin!')
      return
    }
    if (isNaN(tempProfileData.weight) || tempProfileData.weight < 1 || tempProfileData.weight > 500) {
      triggerFormError('Lütfen geçerli bir kilo (1-500 kg) girin!')
      return
    }

    // Validate phone number has exactly 11 digits
    const rawPhone = String(tempProfileData.phone).replace(/\D/g, '');
    if (rawPhone.length !== 11) {
      triggerFormError('Lütfen telefon numarasını eksiksiz girin (Örn: 0 555 555 55 55)')
      return
    }

    const nameParts = tempProfileData.fullName.trim().split(' ');
    const lastName = nameParts.length > 1 ? nameParts.pop() : 'SoyisimYok';
    const firstName = nameParts.join(' ');

    const payload = {
        first_name: firstName,
        last_name: lastName,
        date_of_birth: tempProfileData.birthDate,
        height_cm: parseFloat(tempProfileData.height),
        weight_kg: parseFloat(tempProfileData.weight),
        phone_number: tempProfileData.phone,
        blood_type: tempProfileData.bloodType,
        city: tempProfileData.city
    };

    if (currentPassword || newPassword || confirmNewPassword) {
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        triggerFormError('Şifre değiştirmek için tüm şifre alanlarını doldurmalısınız!');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        triggerFormError('Yeni şifreler uyuşmuyor!');
        return;
      }
      payload.current_password = currentPassword;
      payload.password = newPassword;
    }

    try {
        const response = await fetchWithAuth(`${API_URL}/api/patients/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            setProfileData({ ...tempProfileData })
            
            setCurrentPassword('')
            setNewPassword('')
            setConfirmNewPassword('')

            showToast('Profil bilgileriniz başarıyla güncellendi!')
            setActiveTab('overview')
        } else {
            const data = await response.json();
            triggerFormError(data.detail || 'Güncelleme başarısız oldu.');
        }
    } catch (error) {
        triggerFormError('Sunucuya bağlanılamadı.');
    }
  }

  const triggerFormError = (message) => {
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 400)
    showToast(message, true)
  }

  // Open DICOM PACS viewer simulator modal
  const openPACSViewer = (study) => {
    setSelectedRadiology(study)
    setBrightness(100)
    setContrast(100)
    setZoom(1)
    setGridActive(true)
    setInverted(false)
  }

  // Open radiology study dynamically from a visit
  const openRadiologyFromVisit = (visit) => {
    const study = radiologyStudies.find(s => s.title.includes(visit.radiologyType.split(' (')[0]))
    if (study) {
      openPACSViewer(study)
    } else {
      // Fallback
      openPACSViewer({
        id: 99,
        title: visit.radiologyType,
        hospital: visit.hospital,
        doctor: visit.doctor,
        date: visit.date,
        modality: 'XR',
        bodyPart: 'Tüm Vücut',
        status: 'Raporlandı',
        imagePreview: 'xray_chest',
        report: 'Radyolojik tahlil görüntüsü sistem tarafından otomatik PACS formatına dönüştürüldü.'
      })
    }
  }

  // Compute initials for header avatar
  const displayName = profileData.fullName
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  const currentBmi = calculateBMI(profileData.height, profileData.weight)
  const currentAge = calculateAge(profileData.birthDate)

  const turkishCities = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin', 
    'Aydın', 'Balıkesir', 'Bartın', 'Batman', 'Bayburt', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 
    'Bursa', 'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Düzce', 'Edirne', 'Elazığ', 'Erzincan', 
    'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkâri', 'Hatay', 'Iğdır', 'Isparta', 'İstanbul', 
    'İzmir', 'Kahramanmaraş', 'Karabük', 'Karaman', 'Kars', 'Kastamonu', 'Kayseri', 'Kırıkkale', 'Kırklareli', 'Kırşehir', 
    'Kilis', 'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Muş', 
    'Nevşehir', 'Niğde', 'Ordu', 'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 
    'Şanlıurfa', 'Şırnak', 'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Uşak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
  ]

  const bloodTypesList = ['A Rh(+)', 'A Rh(-)', 'B Rh(+)', 'B Rh(-)', 'AB Rh(+)', 'AB Rh(-)', '0 Rh(+)', '0 Rh(-)']

  // Generate Recent Activities dynamically
  const recentActivities = [
    ...appointments.map(a => ({
      id: `appt-${a.id}`,
      desc: `${a.status === 'Planlandı' ? 'Planlandı' : a.status} durumunda randevunuz var.`,
      time: new Date(a.appointment_date + 'T' + a.appointment_time),
      detail: `${new Date(a.appointment_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} • ${a.appointment_time}`
    })),
    ...radiologyStudies.map(r => ({
      id: `rad-${r.id}`,
      desc: `${r.title} görüntüleme sonucunuz eklendi.`,
      time: new Date(r.date),
      detail: `${new Date(r.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} • ${r.hospital}`
    })),
    ...labStudies.map(l => ({
      id: `lab-${l.id}`,
      desc: `${l.title} laboratuvar sonucunuz eklendi.`,
      time: new Date(l.date),
      detail: `${new Date(l.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} • ${l.hospital}`
    })),
    ...pastVisits.map(v => ({
      id: `vis-${v.id}`,
      desc: `${v.department} muayeneniz tamamlandı.`,
      time: new Date(v.date),
      detail: `${new Date(v.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} • ${v.doctor}`
    }))
  ].sort((a, b) => b.time - a.time).slice(0, 4);

  // Filter visits based on search input (extended to match radiology modality too)
  const filteredVisits = pastVisits.filter(
    (visit) =>
      visit.hospital.toLowerCase().includes(visitSearch.toLowerCase()) ||
      visit.department.toLowerCase().includes(visitSearch.toLowerCase()) ||
      visit.doctor.toLowerCase().includes(visitSearch.toLowerCase()) ||
      visit.diagnosis.toLowerCase().includes(visitSearch.toLowerCase()) ||
      (visit.radiologyType && visit.radiologyType.toLowerCase().includes(visitSearch.toLowerCase())) ||
      (visit.hasRadiology && 'radyolojik görüntülerim'.includes(visitSearch.toLowerCase())) ||
      (visit.hasRadiology && 'görüntü'.includes(visitSearch.toLowerCase()))
  )

  return (
    <div className="dashboard-layout">
      {/* Top sticky navigation bar */}
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <div className="nav-logo">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              <path d="M3.22 12H9.5l1.5-3 2 6 1.5-3h4.78"/>
            </svg>
          </div>
          <span className="nav-title">Hekimim</span>
        </div>

        {/* 6-Tab Dynamic Nav Links */}
        <div className="nav-links">
          <button 
            type="button" 
            className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
            </svg>
            Panelim
          </button>

          <button 
            type="button" 
            className={`nav-link ${activeTab === 'visits' ? 'active' : ''}`}
            onClick={() => {
              setVisitSearch('')
              setActiveTab('visits')
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 22V12h6v10M9 22V12h6v10M3 22V12h6v10"/>
              <path d="M14 2H4a2 2 0 0 0-2 2v8h14V4a2 2 0 0 0-2-2Z"/>
            </svg>
            Ziyaretlerim
          </button>

          <button 
            type="button" 
            className={`nav-link ${activeTab === 'appointments' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('appointments')
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Randevularım
          </button>

          <button 
            type="button" 
            className={`nav-link ${activeTab === 'radiology' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('radiology')
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M3 12h3m12 0h3M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1"/>
            </svg>
            Görüntülerim
          </button>

          <button 
            type="button" 
            className={`nav-link ${activeTab === 'labs' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('labs')
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2v7.31a2.5 2.5 0 0 1-.73 1.77l-4.54 4.55a4 4 0 0 0-.73 4.47C4.66 21.36 6 22 7.5 22h9c1.5 0 2.84-.64 3.5-1.9a4 4 0 0 0-.73-4.47l-4.54-4.55a2.5 2.5 0 0 1-.73-1.77V2Z"/>
              <path d="M8.5 2h7"/>
              <path d="M14 16h-4"/>
            </svg>
            Tahlillerim
          </button>

          <button 
            type="button" 
            className={`nav-link ${activeTab === 'prescriptions' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('prescriptions')
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
              <path d="m8.5 7.5 8 8"/>
            </svg>
            Reçetelerim
          </button>
          
          <button 
            type="button" 
            className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => {
              setTempProfileData({ ...profileData })
              setActiveTab('profile')
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            Ayarlarım
          </button>
        </div>

        <div className="nav-user">
          <div className="user-profile" onClick={() => { setTempProfileData({ ...profileData }); setActiveTab('profile'); }}>
            <div className="profile-avatar">{initials}</div>
            <div className="user-info">
              <span className="user-welcome">Hasta Profili</span>
              <span className="user-name">{profileData.fullName}</span>
            </div>
          </div>
          
          <button type="button" className="btn-logout" onClick={onLogout}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" x2="9" y1="12" y2="12"/>
            </svg>
            Çıkış Yap
          </button>
        </div>
      </nav>

      {/* Main dashboard container */}
      <main className="dashboard-main">
        
        {activeTab === 'overview' && (
          // ==================== VIEW 1: GENEL BAKIŞ (OVERVIEW) ====================
          <>
            <div className="welcome-banner">
              <h2 className="welcome-title">Tekrar Hoş Geldiniz, {profileData.fullName} 👋</h2>
              <p className="welcome-subtitle">Sağlık durumunuzu takip edin, randevularınızı yönetin ve menü sekmelerinden işlemlerinizi yapın.</p>
            </div>

            {/* Dashboard Grid */}
            <div className="dashboard-grid">
              
              {/* LEFT SIDE: Actions and Appointments */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                
                {/* Quick Actions section */}
                <section className="dashboard-section">
                  <h3 className="section-title">Hızlı İşlemler</h3>
                  <div className="actions-grid">
                    
                    {/* Book appointment */}
                    <div className="card action-card" onClick={() => setShowAppointmentModal(true)}>
                      <div className="action-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M10 16h4"/><path d="M12 14v4"/>
                        </svg>
                      </div>
                      <span className="action-name">Randevu Al</span>
                      <span className="action-desc">İstediğiniz poliklinik ve hekimden randevu seçin.</span>
                    </div>

                    {/* Visit History tab trigger */}
                    <div className="card action-card" onClick={() => { setVisitSearch(''); setActiveTab('visits'); }}>
                      <div className="action-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M19 22V12h6v10M9 22V12h6v10M3 22V12h6v10"/>
                          <path d="M14 2H4a2 2 0 0 0-2 2v8h14V4a2 2 0 0 0-2-2Z"/>
                        </svg>
                      </div>
                      <span className="action-name">Ziyaret Geçmişim</span>
                      <span className="action-desc">Geçmiş hekim muayenelerinizi ve tanıları inceleyin.</span>
                    </div>

                    {/* Radiology tab trigger */}
                    <div className="card action-card" onClick={() => { setActiveTab('radiology'); }}>
                      <div className="action-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="3"/>
                          <path d="M3 12h3m12 0h3M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1"/>
                        </svg>
                      </div>
                      <span className="action-name">Görüntüleme Sonuçlarım</span>
                      <span className="action-desc">Radyoloji, MR ve Röntgen görüntülerinizi PACS ile inceleyin.</span>
                    </div>

                    {/* Laboratory results trigger */}
                    <div className="card action-card" onClick={() => { setActiveTab('labs'); }}>
                      <div className="action-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M10 2v7.31a2.5 2.5 0 0 1-.73 1.77l-4.54 4.55a4 4 0 0 0-.73 4.47C4.66 21.36 6 22 7.5 22h9c1.5 0 2.84-.64 3.5-1.9a4 4 0 0 0-.73-4.47l-4.54-4.55a2.5 2.5 0 0 1-.73-1.77V2Z"/>
                          <path d="M8.5 2h7"/>
                          <path d="M14 16h-4"/>
                        </svg>
                      </div>
                      <span className="action-name">Tahlil Sonuçlarım</span>
                      <span className="action-desc">Laboratuvar, biyokimya ve hormon tahlili parametrelerinizi inceleyin.</span>
                    </div>

                    {/* Prescriptions trigger */}
                    <div className="card action-card" onClick={() => { setActiveTab('prescriptions'); }}>
                      <div className="action-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                          <path d="m8.5 7.5 8 8"/>
                        </svg>
                      </div>
                      <span className="action-name">Reçetelerim</span>
                      <span className="action-desc">E-Reçetelerinizi, dozaj bilgilerini ve kullanım talimatlarını görün.</span>
                    </div>

                    {/* Profile editor trigger */}
                    <div className="card action-card" onClick={() => { setTempProfileData({ ...profileData }); setActiveTab('profile'); }}>
                      <div className="action-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                      </div>
                      <span className="action-name">Profil Bilgilerim</span>
                      <span className="action-desc">Kişisel bilgilerinizi güncelleyin ve şifrenizi değiştirin.</span>
                    </div>

                  </div>
                </section>

                {/* Upcoming Appointments section */}
                <section className="dashboard-section">
                  <h3 className="section-title">Yaklaşan Randevular</h3>
                  {appointments.filter(a => (a.status === 'Bekliyor' || a.status === 'Onaylandı') && new Date(a.appointment_date) >= new Date(new Date().setHours(0,0,0,0))).length > 0 ? (
                    appointments
                      .filter(a => (a.status === 'Bekliyor' || a.status === 'Onaylandı') && new Date(a.appointment_date) >= new Date(new Date().setHours(0,0,0,0)))
                      .sort((a, b) => {
                        const dateDiff = new Date(a.appointment_date) - new Date(b.appointment_date);
                        if (dateDiff !== 0) return dateDiff;
                        return a.appointment_time.localeCompare(b.appointment_time);
                      })
                      .slice(0, 3)
                      .map(appt => {
                        const apptDoctor = doctors.find(d => d.id === appt.doctor_id);
                        return (
                          <div key={appt.id} className="card appointment-card" style={{ marginBottom: '16px' }}>
                            <div className="appt-info">
                              <div className="doctor-avatar-circle">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
                                  <path d="M8 15v1a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-4"/>
                                </svg>
                              </div>
                              <div className="appt-details">
                                <span className="appt-doctor">Dr. {apptDoctor ? `${apptDoctor.first_name} ${apptDoctor.last_name}` : 'Bilinmeyen Doktor'}</span>
                                <span className="appt-specialty">{apptDoctor ? apptDoctor.specialty : ''} Uzmanı • Sistem Hastanesi</span>
                                <span className="appt-time">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                                  </svg>
                                  {new Date(appt.appointment_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} - {appt.appointment_time}
                                </span>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span className="appt-badge">Onaylandı</span>
                            </div>
                          </div>
                        )
                      })
                  ) : (
                    <div className="card appointment-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Yaklaşan bir randevunuz bulunmamaktadır.
                    </div>
                  )}
                </section>

                {/* Ziyaretlerim (Recent Visits) section */}
                <section className="dashboard-section">
                  <h3 className="section-title">Son Ziyaretlerim</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {pastVisits.slice(0, 3).map((visit) => (
                      <div key={visit.id} className="card visit-card">
                        <div className="visit-header" style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="hospital-icon-circle">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M19 22V12h6v10M9 22V12h6v10M3 22V12h6v10"/>
                                <path d="M14 2H4a2 2 0 0 0-2 2v8h14V4a2 2 0 0 0-2-2Z"/>
                              </svg>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="visit-hospital">{visit.hospital}</span>
                              <span className="visit-doctor">
                                <strong>{visit.department}</strong> • {visit.doctor}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span className="visit-date">{visit.date}</span>
                            <button 
                              type="button" 
                              className="btn-micro" 
                              style={{ padding: '8px 14px', whiteSpace: 'nowrap' }} 
                              onClick={() => {
                                setVisitSearch(visit.hospital)
                                setActiveTab('visits')
                              }}
                            >
                              Detayları Gör
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Radyolojik Görüntülerim (Radiological Images) section */}
                <section className="dashboard-section">
                  <h3 className="section-title">Radyolojik Görüntülerim</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {radiologyStudies.slice(0, 3).map((study) => (
                      <div key={study.id} className="card visit-card">
                        <div className="visit-header" style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="hospital-icon-circle">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M3 12h3m12 0h3M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1"/>
                              </svg>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="visit-hospital">{study.title}</span>
                              <span className="visit-doctor">{study.hospital} • {study.date}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span className="visit-badge">{study.modality}</span>
                            <button 
                              type="button" 
                              className="btn-micro" 
                              style={{ padding: '8px 14px', whiteSpace: 'nowrap' }} 
                              onClick={() => openPACSViewer(study)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                              </svg>
                              PACS Görüntüle
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Tahlil Sonuçlarım (Laboratory Results) section */}
                <section className="dashboard-section">
                  <h3 className="section-title">Tahlil Sonuçlarım</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {labStudies.slice(0, 3).map((lab) => (
                      <div key={lab.id} className="card visit-card">
                        <div className="visit-header" style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="hospital-icon-circle">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M10 2v7.31a2.5 2.5 0 0 1-.73 1.77l-4.54 4.55a4 4 0 0 0-.73 4.47C4.66 21.36 6 22 7.5 22h9c1.5 0 2.84-.64 3.5-1.9a4 4 0 0 0-.73-4.47l-4.54-4.55a2.5 2.5 0 0 1-.73-1.77V2Z"/>
                                <path d="M8.5 2h7"/>
                                <path d="M14 16h-4"/>
                              </svg>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="visit-hospital">{lab.title}</span>
                              <span className="visit-doctor">{lab.hospital} • {lab.date}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span className="visit-badge">{lab.results.length} Parametre</span>
                            <button 
                              type="button" 
                              className="btn-micro" 
                              style={{ padding: '8px 14px', whiteSpace: 'nowrap' }} 
                              onClick={() => setSelectedLab(lab)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                              </svg>
                              Sonuçları Gör
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Reçetelerim section */}
                <section className="dashboard-section">
                  <h3 className="section-title">E-Reçetelerim</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {prescriptions.slice(0, 3).map((pres) => (
                      <div key={pres.id} className="card visit-card">
                        <div className="visit-header" style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="hospital-icon-circle">
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                                <path d="m8.5 7.5 8 8"/>
                              </svg>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="visit-hospital">E-Reçete: #{pres.prescriptionNo}</span>
                              <span className="visit-doctor">
                                <strong>{pres.doctor}</strong> • {pres.hospital}
                              </span>
                              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                                İlaçlar: {pres.medicines.length > 40 ? pres.medicines.substring(0, 40) + '...' : pres.medicines}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span className="visit-date">{pres.date}</span>
                            <button 
                              type="button" 
                              className="btn-micro" 
                              style={{ padding: '8px 14px', whiteSpace: 'nowrap' }} 
                              onClick={() => {
                                setActiveTab('prescriptions')
                              }}
                            >
                              Hepsini Gör
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

              </div>

              {/* RIGHT SIDE: Health summary and activities */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                
                {/* Health Metrics Section */}
                <section className="dashboard-section">
                  <h3 className="section-title">Sağlık Özetim</h3>
                  <div className="card stats-container">
                    
                    <div className="metrics-row">
                      <div className="metric-box">
                        <span className="metric-label">Kan Grubu</span>
                        <span className="metric-value" style={{ color: '#ef4444' }}>{profileData.bloodType}</span>
                        <span className="metric-sub">Değiştirilebilir</span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-label">Boy / Kilo</span>
                        <span className="metric-value">{profileData.height} cm / {profileData.weight} kg</span>
                        <span className="metric-sub">BKİ: {currentBmi.score} ({currentBmi.status})</span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-label">Yaş / İl</span>
                        <span className="metric-value">{currentAge} Yaş / {profileData.city}</span>
                        <span className="metric-sub">Güncel Veri</span>
                      </div>
                    </div>

                    <div className="metric-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
                      <div>
                        <span className="metric-label" style={{ display: 'block', marginBottom: '2px' }}>İletişim Telefonu</span>
                        <span className="metric-value" style={{ fontSize: '14px', marginTop: '0' }}>{profileData.phone}</span>
                      </div>
                      <span className="appt-badge">Aktif</span>
                    </div>

                  </div>
                </section>

                {/* Recent Activities Section */}
                <section className="dashboard-section">
                  <h3 className="section-title">Son Aktiviteler</h3>
                  <div className="card">
                    <div className="activity-list">
                      {recentActivities.length > 0 ? (
                        recentActivities.map(activity => (
                          <div key={activity.id} className="activity-item">
                            <div className="activity-dot"></div>
                            <div>
                              <p className="activity-desc">{activity.desc}</p>
                              <span className="activity-time">{activity.detail}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '16px' }}>
                          Henüz hiçbir son aktiviteniz bulunmamaktadır.
                        </div>
                      )}
                    </div>
                  </div>
                </section>

              </div>

            </div>
          </>
        )}

        {activeTab === 'visits' && (
          // ==================== VIEW 2: DEDICATED FULL-PAGE VISITS (ZİYARETLERİM) ====================
          <section className="dashboard-section" style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
            <div className="welcome-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 className="welcome-title">Ziyaret Geçmişim</h2>
                <p className="welcome-subtitle">Geçmiş hastane ziyaretlerinizi, konulan tanıları, yazılan reçeteleri ve tahlil dosyalarını inceleyin.</p>
              </div>

              {/* Visit Search bar */}
              <div className="input-container" style={{ maxWidth: '300px' }}>
                <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Hastane, hekim, tanı veya radyoloji ara..."
                  value={visitSearch}
                  onChange={(e) => setVisitSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="card" style={{ padding: '32px' }}>
              {filteredVisits.length > 0 ? (
                <div className="visit-list">
                  {filteredVisits.map((visit) => (
                    <div key={visit.id} className="card visit-card">
                      <div className="visit-header" style={{ width: '100%' }}>
                        <div className="hospital-icon-circle">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M19 22V12h6v10M9 22V12h6v10M3 22V12h6v10"/>
                            <path d="M14 2H4a2 2 0 0 0-2 2v8h14V4a2 2 0 0 0-2-2Z"/>
                            <path d="M6 6h4M8 4v4"/>
                          </svg>
                        </div>
                        
                        <div className="visit-details" style={{ flexGrow: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <h4 className="visit-hospital" style={{ fontSize: '16px' }}>{visit.hospital}</h4>
                              <p className="visit-doctor" style={{ fontSize: '13px', marginTop: '2px' }}>
                                <strong>{visit.department}</strong> • {visit.doctor}
                              </p>
                            </div>
                            <span className="appt-badge">{visit.status}</span>
                          </div>
                          
                          {/* Rich Diagnosis layout */}
                          <div style={{ marginTop: '12px', padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                            <span style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Konulan Tanı / Teşhis
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)', display: 'block', marginTop: '4px' }}>
                              {visit.diagnosis}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '16px' }}>
                            <div className="visit-date">
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                              </svg>
                              Muayene Tarihi: {visit.date}
                            </div>

                            <div className="visit-actions">
                              {visit.prescription !== 'Reçete Yok' && (
                                <button type="button" className="btn-micro" style={{ padding: '6px 12px' }} onClick={() => setActiveTab('prescriptions')}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 7.5 8 8"/>
                                  </svg>
                                  {visit.prescription}
                                </button>
                              )}
                              {visit.hasLabResult && (
                                <button type="button" className="btn-micro" style={{ padding: '6px 12px' }} onClick={() => triggerMockAction(`${visit.doctor} - Tahlil Sonuç Raporu`)}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
                                  </svg>
                                  Tahlil Raporu (PDF)
                                </button>
                              )}
                              {visit.hasRadiology && (
                                <button 
                                  type="button" 
                                  className="btn-micro" 
                                  onClick={() => openRadiologyFromVisit(visit)}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="3"/>
                                    <path d="M3 12h3m12 0h3M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1"/>
                                  </svg>
                                  Radyolojik Görüntülerim
                                </button>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: '600' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', opacity: 0.5 }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>
                  </svg>
                  <p>Arama kriterlerinize uygun hiçbir ziyaret geçmişi bulunamadı.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'radiology' && (
          // ==================== VIEW 3: DEDICATED FULL-PAGE RADIOLOGY (RADYOLOJİK GÖRÜNTÜLERİM) ====================
          <section className="dashboard-section" style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
            <div className="welcome-banner">
              <h2 className="welcome-title">Radyolojik Görüntülerim</h2>
              <p className="welcome-subtitle">Sistemde adınıza kayıtlı Röntgen, MR ve Tomografi tetkiklerinizi listeyin, DICOM görüntüleyicide etkileşimli inceleyin.</p>
            </div>

            <div className="radiology-grid">
              {radiologyStudies.map((study) => (
                <div key={study.id} className="card radiology-card">
                  {/* High-tech Viewport preview */}
                  <div className="radiology-banner-preview">
                    <span className="radiology-modality-badge">{study.modality}</span>
                    <span className="radiology-body-part-badge">{study.bodyPart}</span>
                    
                    {/* Simulated scanning graphic preview */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {study.imagePreview && (study.imagePreview.startsWith('http') || study.imagePreview.startsWith('/')) ? (
                        <img src={study.imagePreview} alt={study.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                      ) : (
                        <div style={{ transform: 'scale(0.4)', opacity: 0.45 }}>
                          {study.imagePreview === 'mri_knee' && (
                            <svg width="200" height="200" viewBox="0 0 100 100" fill="none">
                              <circle cx="50" cy="50" r="45" stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" />
                              <path d="M30 65 C35 55, 45 40, 50 40 C55 40, 65 55, 70 65 C60 75, 40 75, 30 65 Z" fill="#ffffff" opacity="0.8" />
                              <ellipse cx="50" cy="30" rx="12" ry="8" fill="#ffffff" opacity="0.6"/>
                            </svg>
                          )}
                          {study.imagePreview === 'xray_chest' && (
                            <svg width="200" height="200" viewBox="0 0 100 100" fill="none">
                              <path d="M20 30 Q35 15, 50 30 Q65 15, 80 30 Q80 85, 50 90 Q20 85, 20 30 Z" stroke="#ffffff" strokeWidth="2"/>
                              <path d="M30 40 C35 50, 45 50, 48 40" stroke="#ffffff" strokeWidth="1.5" />
                              <path d="M70 40 C65 50, 55 50, 52 40" stroke="#ffffff" strokeWidth="1.5" />
                              <line x1="50" y1="30" x2="50" y2="85" stroke="#ffffff" strokeWidth="3"/>
                            </svg>
                          )}
                          {study.imagePreview === 'ct_brain' && (
                            <svg width="200" height="200" viewBox="0 0 100 100" fill="none">
                              <ellipse cx="50" cy="50" rx="35" ry="42" stroke="#ffffff" strokeWidth="2"/>
                              <path d="M50 15 C35 25, 32 60, 50 82 C68 60, 65 25, 50 15 Z" fill="#ffffff" opacity="0.4" />
                              <ellipse cx="50" cy="45" rx="20" ry="25" stroke="#ffffff" strokeWidth="1" strokeDasharray="2 2" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="radiology-card-body">
                    <h3 className="radiology-card-title">{study.title}</h3>
                    <div className="radiology-card-meta">
                      <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M19 22V12h6v10M9 22V12h6v10M3 22V12h6v10"/><path d="M14 2H4a2 2 0 0 0-2 2v8h14V4a2 2 0 0 0-2-2Z"/>
                        </svg>
                        {study.hospital}
                      </span>
                      <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        Hekim: {study.doctor}
                      </span>
                      <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                        </svg>
                        Tetkik Tarihi: {study.date}
                      </span>
                    </div>
                  </div>

                  <div className="radiology-card-footer">
                    <button 
                      type="button" 
                      className="btn-save" 
                      style={{ flexGrow: 1, justifyContent: 'center' }}
                      onClick={() => openPACSViewer(study)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      Görüntüle (DICOM)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'labs' && (
          // ==================== VIEW 3.5: DEDICATED FULL-PAGE LABORATORY (TAHLİLLERİM) ====================
          <section className="dashboard-section" style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
            <div className="welcome-banner">
              <h2 className="welcome-title">Tahlil Sonuçlarım</h2>
              <p className="welcome-subtitle">Biyokimya, hemogram, hormon ve vitamin analiz sonuçlarınızı interaktif tablo ve grafiklerle detaylıca inceleyin.</p>
            </div>

            <div className="radiology-grid">
              {labStudies.map((lab) => (
                <div key={lab.id} className="card radiology-card">
                  {/* High-tech Viewport preview */}
                  <div className="radiology-banner-preview">
                    <span className="radiology-modality-badge">LAB</span>
                    <span className="radiology-body-part-badge">{lab.department}</span>
                    
                    {/* Chemistry flask SVG */}
                    <div style={{ color: '#ffffff', opacity: 0.65 }}>
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 2v7.31a2.5 2.5 0 0 1-.73 1.77l-4.54 4.55a4 4 0 0 0-.73 4.47C4.66 21.36 6 22 7.5 22h9c1.5 0 2.84-.64 3.5-1.9a4 4 0 0 0-.73-4.47l-4.54-4.55a2.5 2.5 0 0 1-.73-1.77V2Z"/>
                        <path d="M8.5 2h7"/>
                        <path d="M14 16h-4"/>
                      </svg>
                    </div>
                  </div>

                  <div className="radiology-card-body">
                    <h3 className="radiology-card-title">{lab.title}</h3>
                    <div className="radiology-card-meta">
                      <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M19 22V12h6v10M9 22V12h6v10M3 22V12h6v10"/><path d="M14 2H4a2 2 0 0 0-2 2v8h14V4a2 2 0 0 0-2-2Z"/>
                        </svg>
                        {lab.hospital}
                      </span>
                      <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        İsteyen Hekim: {lab.doctor_name}
                      </span>
                      <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                        </svg>
                        Onay Tarihi: {lab.date}
                      </span>
                    </div>
                  </div>

                  <div className="radiology-card-footer">
                    <button 
                      type="button" 
                      className="btn-save" 
                      style={{ flexGrow: 1, justifyContent: 'center' }}
                      onClick={() => setSelectedLab(lab)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      Detayları Gör
                    </button>
                    <button 
                      type="button" 
                      className="btn-cancel" 
                      onClick={() => generatePDF(lab)}
                    >
                      PDF İndir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'prescriptions' && (
          // ==================== VIEW 3.8: DEDICATED FULL-PAGE PRESCRIPTIONS (REÇETELERİM) ====================
          <section className="dashboard-section" style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
            <div className="welcome-banner">
              <h2 className="welcome-title">Reçetelerim</h2>
              <p className="welcome-subtitle">Hekimleriniz tarafından yazılan e-reçeteleri, ilaç isimlerini ve kullanım tarihlerini listeleyin.</p>
            </div>

            <div className="radiology-grid">
              {prescriptions.map((pres) => (
                <div key={pres.id} className="card radiology-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'linear-gradient(to right, rgba(16, 185, 129, 0.05), transparent)', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                        <path d="m8.5 7.5 8 8"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '4px 10px', borderRadius: '12px', letterSpacing: '0.5px' }}>E-REÇETE</span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: '500' }}>Sistem Kaydı</span>
                      </div>
                      <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '6px', letterSpacing: '0.5px' }}>#{pres.prescriptionNo}</h3>
                    </div>
                  </div>

                  <div className="radiology-card-body" style={{ paddingTop: '16px' }}>
                    <div className="radiology-card-meta">
                      <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M19 22V12h6v10M9 22V12h6v10M3 22V12h6v10"/><path d="M14 2H4a2 2 0 0 0-2 2v8h14V4a2 2 0 0 0-2-2Z"/>
                        </svg>
                        {pres.hospital}
                      </span>
                      <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        Hekim: {pres.doctor}
                      </span>
                      <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                        </svg>
                        Tarih: {pres.date}
                      </span>
                    </div>

                    <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Yazılan İlaçlar / Dozaj
                      </span>
                      <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--color-text-primary)', display: 'block', marginTop: '4px', lineHeight: '1.5' }}>
                        {pres.medicines.length > 60 ? pres.medicines.substring(0, 60) + '...' : pres.medicines}
                      </span>
                    </div>
                  </div>

                  <div className="radiology-card-footer" style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn-save" 
                      style={{ flexGrow: 1, justifyContent: 'center', backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
                      onClick={() => setSelectedPrescription(pres)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px' }}>
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      Detayları Gör
                    </button>
                    <button 
                      type="button" 
                      className="btn-save" 
                      style={{ flexGrow: 1, justifyContent: 'center' }}
                      onClick={() => {
                        navigator.clipboard.writeText(pres.prescriptionNo);
                        showToast(`E-Reçete Kodu (${pres.prescriptionNo}) panoya kopyalandı!`);
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px' }}>
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                      </svg>
                      Kodu Kopyala
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'appointments' && (
          <section className="dashboard-section" style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
            <div className="welcome-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 className="welcome-title">Randevularım</h2>
                <p className="welcome-subtitle">Güncel ve geçmiş randevularınızı buradan takip edebilirsiniz.</p>
              </div>
              <button className="btn-save" onClick={() => setShowAppointmentModal(true)}>
                + Yeni Randevu Al
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
              {appointments.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                  <p style={{ color: 'var(--text-muted)' }}>Henüz bir randevunuz bulunmuyor.</p>
                </div>
              ) : (
                appointments.map((appt) => (
                  <div key={appt.id} className="card visit-card">
                    <div className="visit-header" style={{ width: '100%', justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="hospital-icon-circle">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="visit-hospital">{appt.doctor_name} ({appt.doctor_specialty})</span>
                          <span className="visit-doctor">{appt.appointment_date} • {appt.appointment_time}</span>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                            Şikayet: {appt.reason || 'Belirtilmedi'}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="visit-badge" style={{ background: appt.status === 'Bekliyor' ? 'rgba(245, 158, 11, 0.1)' : appt.status === 'İptal Edildi' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: appt.status === 'Bekliyor' ? '#f59e0b' : appt.status === 'İptal Edildi' ? '#ef4444' : '#10b981' }}>
                          {appt.status}
                        </span>
                        {appt.status !== 'İptal Edildi' && appt.status !== 'Tamamlandı' && (
                          <button 
                            className="btn-micro" 
                            style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', transition: 'all 0.2s' }}
                            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            onClick={async () => {
                              if(window.confirm('Randevunuzu iptal etmek istediğinize emin misiniz?')) {
                                try {
                                  const res = await fetchWithAuth(`${API_URL}/api/appointments/${appt.id}`, {
                                    method: 'PUT',
                                    headers: {'Content-Type': 'application/json'},
                                    body: JSON.stringify({status: 'İptal Edildi'})
                                  });
                                  if(res.ok) {
                                    showToast('Randevunuz iptal edildi.');
                                    const apptRes = await fetchWithAuth(`${API_URL}/api/appointments/patient/${user.id}`);
                                    if(apptRes.ok) setAppointments(await apptRes.json());
                                  } else {
                                    showToast('Bir hata oluştu.', true);
                                  }
                                } catch(e) {
                                  showToast('Bir hata oluştu.', true);
                                }
                              }
                            }}
                          >
                            İptal Et
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === 'profile' && (
          // ==================== VIEW 4: PROFİL AYARLARI (PROFILE EDIT) ====================
          <section className="dashboard-section" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            
            <div className="welcome-banner">
              <h2 className="welcome-title">Profil Ayarlarım</h2>
              <p className="welcome-subtitle">Kişisel bilgilerinizi güncelleyip kaydedin. Değişiklikler anında yansıyacaktır.</p>
            </div>

            <div className="card" style={{ padding: '36px' }}>
              <form onSubmit={handleProfileSave} className={`profile-form-container ${isShaking ? 'shake-animation' : ''}`}>
                
                {/* SECTION 1: Kişisel Bilgiler */}
                <div className="profile-form-section">
                  <h4 className="profile-section-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    Kişisel Bilgiler
                  </h4>

                  <div className="form-row">
                    {/* Ad Soyad */}
                    <div className="form-group">
                      <label className="form-label" htmlFor="profName">Ad Soyad</label>
                      <div className="input-container">
                        <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        <input
                          type="text"
                          id="profName"
                          className="form-input"
                          value={tempProfileData.fullName}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]*$/.test(val)) {
                              setTempProfileData({ ...tempProfileData, fullName: val });
                            }
                          }}
                          maxLength={50}
                        />
                      </div>
                    </div>

                    {/* Doğum Tarihi & Yaş */}
                    <div className="form-group">
                      <label className="form-label" htmlFor="profBirthDate">
                        Doğum Tarihi
                        <span className="age-badge">{calculateAge(tempProfileData.birthDate)} Yaşında</span>
                      </label>
                      <div className="input-container">
                        <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                        </svg>
                        <input
                          type="date"
                          id="profBirthDate"
                          className="form-input"
                          value={tempProfileData.birthDate}
                          onChange={(e) => setTempProfileData({ ...tempProfileData, birthDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    {/* Kan Grubu */}
                    <div className="form-group">
                      <label className="form-label" htmlFor="profBlood">Kan Grubu</label>
                      <div className="input-container">
                        <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z"/>
                        </svg>
                        <select
                          id="profBlood"
                          className="form-input"
                          value={tempProfileData.bloodType}
                          onChange={(e) => setTempProfileData({ ...tempProfileData, bloodType: e.target.value })}
                        >
                          {bloodTypesList.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Yaşadığı İl */}
                    <div className="form-group">
                      <label className="form-label" htmlFor="profCity">Yaşadığı İl</label>
                      <div className="input-container">
                        <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        <select
                          id="profCity"
                          className="form-input"
                          value={tempProfileData.city}
                          onChange={(e) => setTempProfileData({ ...tempProfileData, city: e.target.value })}
                        >
                          {turkishCities.map((city) => (
                            <option key={city} value={city}>{city}</option>
                          ))}
                          <option value="Diğer">Diğer</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    {/* Boy */}
                    <div className="form-group">
                      <label className="form-label" htmlFor="profHeight">Boy (cm)</label>
                      <div className="input-container">
                        <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="4" x2="20" y1="2" y2="2"/><line x1="4" x2="20" y1="22" y2="22"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m15 19-3 3-3-3"/><path d="m15 5-3-3-3 3"/>
                        </svg>
                        <input
                          type="number"
                          id="profHeight"
                          className="form-input"
                          value={tempProfileData.height}
                          onChange={(e) => setTempProfileData({ ...tempProfileData, height: e.target.value })}
                          placeholder="cm cinsinden"
                          max="299"
                          min="50"
                        />
                      </div>
                    </div>

                    {/* Kilo */}
                    <div className="form-group">
                      <label className="form-label" htmlFor="profWeight">Kilo (kg)</label>
                      <div className="input-container">
                        <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>
                        </svg>
                        <input
                          type="number"
                          id="profWeight"
                          className="form-input"
                          value={tempProfileData.weight}
                          onChange={(e) => setTempProfileData({ ...tempProfileData, weight: e.target.value })}
                          placeholder="kg cinsinden"
                          max="500"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: İletişim Bilgileri */}
                <div className="profile-form-section">
                  <h4 className="profile-section-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    İletişim & Sistem Kayıt Bilgileri
                  </h4>

                  <div className="form-row">
                    {/* Telefon */}
                    <div className="form-group">
                      <label className="form-label" htmlFor="profPhone">Telefon Numarası</label>
                      <div className="input-container">
                        <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/>
                        </svg>
                        <input
                          type="tel"
                          id="profPhone"
                          className="form-input"
                          value={tempProfileData.phone}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length > 11) val = val.substring(0, 11);
                            let formatted = '';
                            if (val.length > 0) formatted += val.substring(0, 1);
                            if (val.length > 1) formatted += ' ' + val.substring(1, 4);
                            if (val.length > 4) formatted += ' ' + val.substring(4, 7);
                            if (val.length > 7) formatted += ' ' + val.substring(7, 9);
                            if (val.length > 9) formatted += ' ' + val.substring(9, 11);
                            setTempProfileData({ ...tempProfileData, phone: formatted });
                          }}
                          placeholder="0 5XX XXX XX XX"
                        />
                      </div>
                    </div>

                    {/* E-posta (Kayıt - DEĞİŞTİRİLEMEZ) */}
                    <div className="form-group">
                      <label className="form-label" htmlFor="profEmail">
                        E-Posta Adresi 
                        <span style={{ color: '#ef4444', fontSize: '10px', fontWeight: 'bold', marginLeft: '4px' }}>(Değiştirilemez)</span>
                      </label>
                      <div className="input-container">
                        <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <input
                          type="email"
                          id="profEmail"
                          className="form-input"
                          value={tempProfileData.email}
                          disabled
                        />
                      </div>
                      <span className="form-input-help">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>
                        E-posta adresiniz birincil hesap kimliğiniz olduğu için değiştirilemez.
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Şifre Değiştirme */}
                <div className="profile-form-section">
                  <h4 className="profile-section-title">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Güvenlik & Şifre Güncelleme
                  </h4>

                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label className="form-label" htmlFor="currPass">Mevcut Şifre</label>
                    <div className="input-container">
                      <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <input
                        type="password"
                        id="currPass"
                        className="form-input"
                        placeholder="Mevcut şifrenizi girin"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    {/* Yeni Şifre */}
                    <div className="form-group">
                      <label className="form-label" htmlFor="newPass">Yeni Şifre</label>
                      <div className="input-container">
                        <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <input
                          type="password"
                          id="newPass"
                          className="form-input"
                          placeholder="Yeni şifrenizi belirleyin"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Yeni Şifre Tekrar */}
                    <div className="form-group">
                      <label className="form-label" htmlFor="confirmNewPass">Yeni Şifre Tekrar</label>
                      <div className="input-container">
                        <svg className="input-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <input
                          type="password"
                          id="confirmNewPass"
                          className="form-input"
                          placeholder="Yeni şifreyi tekrar edin"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit / Cancel Buttons */}
                <div className="profile-footer">
                  <button type="submit" className="btn-save">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                    </svg>
                    Değişiklikleri Kaydet
                  </button>

                  <button 
                    type="button" 
                    className="btn-cancel" 
                    onClick={() => {
                      // Reset temp and cancel
                      setTempProfileData({ ...profileData })
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmNewPassword('')
                      setActiveTab('overview')
                      showToast('Düzenleme iptal edildi.', true)
                    }}
                  >
                    Vazgeç
                  </button>
                </div>

              </form>
            </div>
          </section>
        )}

      </main>

      {/* ==================== HIGH-TECH DICOM PACS VIEWER MODAL BACKDROP ==================== */}
      {selectedRadiology && (
        <div className="dicom-overlay" onClick={() => setSelectedRadiology(null)}>
          <div className="dicom-modal" onClick={(e) => e.stopPropagation()}>
            
            {/* PACS Header */}
            <div className="dicom-header">
              <div className="dicom-brand">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <span className="dicom-title">HEKIMIM PACS DICOM GÖRÜNTÜLEYİCİ</span>
                <span className="dicom-logo-badge">ONLINE PACS v1.2</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#71717a' }}>STATUS: CONNECTED TO ARCHIVE</span>
                <button type="button" className="dicom-close-btn" onClick={() => setSelectedRadiology(null)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* PACS Main Body */}
            <div className="dicom-body">
              
              {/* SIDEBAR: Medical Report & Study info */}
              <div className="dicom-sidebar">
                <div>
                  <h4 className="dicom-section-title">Hasta Bilgileri</h4>
                  <div className="dicom-meta-group">
                    <div className="dicom-meta-item">
                      <span className="dicom-meta-label">Hasta Adı</span>
                      <span className="dicom-meta-value">{profileData.fullName}</span>
                    </div>
                    <div className="dicom-meta-item">
                      <span className="dicom-meta-label">Yaş / Cinsiyet</span>
                      <span className="dicom-meta-value">{currentAge} Yaş / Erkek</span>
                    </div>
                    <div className="dicom-meta-item">
                      <span className="dicom-meta-label">Kan Grubu</span>
                      <span className="dicom-meta-value">{profileData.bloodType}</span>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <h4 className="dicom-section-title">Tetkik Bilgileri</h4>
                  <div className="dicom-meta-group">
                    <div className="dicom-meta-item">
                      <span className="dicom-meta-label">Tetkik Tanımı</span>
                      <span className="dicom-meta-value" style={{ color: '#ffffff' }}>{selectedRadiology.title}</span>
                    </div>
                    <div className="dicom-meta-item">
                      <span className="dicom-meta-label">Görüntüleme Modu</span>
                      <span className="dicom-meta-value">{selectedRadiology.modality}</span>
                    </div>
                    <div className="dicom-meta-item">
                      <span className="dicom-meta-label">Tetkik Tarihi</span>
                      <span className="dicom-meta-value">{selectedRadiology.date}</span>
                    </div>
                    <div className="dicom-meta-item">
                      <span className="dicom-meta-label">İsteyen Hekim</span>
                      <span className="dicom-meta-value">{selectedRadiology.doctor}</span>
                    </div>
                    <div className="dicom-meta-item">
                      <span className="dicom-meta-label">Kurum</span>
                      <span className="dicom-meta-value" style={{ fontSize: '11px' }}>{selectedRadiology.hospital}</span>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', flexGrow: 1 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <span style={{ fontSize: '12px', textAlign: 'center' }}>Tıbbi sonuçlarınız için<br/>lütfen hekiminizle görüşün.</span>
                  </div>
                </div>
              </div>

              {/* VIEWPORT: Clinical scan simulator */}
              <div className="dicom-viewport-container">
                <div className="dicom-viewport">
                  
                  {/* Grid Lines */}
                  {gridActive && <div className="dicom-grid-overlay"></div>}
                  {gridActive && <div className="dicom-crosshair"></div>}

                  {/* Horizontal laser beam scan animation */}
                  <div className="dicom-laser-line"></div>

                  {/* Corner HUD Data */}
                  <div className="dicom-hud-info dicom-hud-tl">
                    <div>PID: #981729A</div>
                    <div>NAME: {profileData.fullName.toUpperCase()}</div>
                    <div>DOB: {profileData.birthDate}</div>
                    <div>AGE: {currentAge}Y</div>
                  </div>
                  <div className="dicom-hud-info dicom-hud-tr">
                    <div>MODALITY: {selectedRadiology.modality}</div>
                    <div>PART: {selectedRadiology.bodyPart.toUpperCase()}</div>
                    <div>DATE: {selectedRadiology.date.toUpperCase()}</div>
                    <div>PACS: LOCAL_ARCHIVE</div>
                  </div>
                  <div className="dicom-hud-info dicom-hud-bl">
                    <div>FS: 1.5T / CR</div>
                    <div>THK: 3.0mm</div>
                    <div>WL: 40 / WW: 400</div>
                    <div>ZOOM: {zoom.toFixed(1)}x</div>
                  </div>
                  <div className="dicom-hud-info dicom-hud-br">
                    <div>BRT: {brightness}%</div>
                    <div>CON: {contrast}%</div>
                    <div>INV: {inverted ? 'TRUE' : 'FALSE'}</div>
                    <div>GRID: {gridActive ? 'ACTIVE' : 'OFF'}</div>
                  </div>

                  {/* Clinical Graphic Display (Interactive Filters) */}
                  <div 
                    className="dicom-canvas"
                    style={{
                      filter: `brightness(${brightness}%) contrast(${contrast}%) ${inverted ? 'invert(1)' : 'invert(0)'}`,
                      transform: `scale(${zoom})`,
                      transition: 'transform 0.1s ease',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    {selectedRadiology.imagePreview && (selectedRadiology.imagePreview.startsWith('http') || selectedRadiology.imagePreview.startsWith('/')) ? (
                      <img src={selectedRadiology.imagePreview} alt={selectedRadiology.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <>
                        {selectedRadiology.imagePreview === 'mri_knee' && (
                          <svg viewBox="0 0 100 100" fill="none" stroke="#ffffff" strokeWidth="1.5">
                            <circle cx="50" cy="50" r="45" strokeOpacity="0.2" strokeDasharray="3 3"/>
                            <path d="M50 12 C 55 12, 60 20, 60 30 C 60 40, 52 45, 52 50 C 52 55, 68 62, 70 70 C 72 78, 55 90, 50 90 C 45 90, 28 78, 30 70 C 32 62, 48 55, 48 50 C 48 45, 40 40, 40 30 C 40 20, 45 12, 50 12 Z" strokeWidth="2" strokeLinejoin="round" fill="rgba(255, 255, 255, 0.05)" />
                            <path d="M45 35 C42 42, 38 48, 35 50" strokeOpacity="0.8" />
                            <path d="M55 35 C58 42, 62 48, 65 50" strokeOpacity="0.8" />
                            {/* Meniscus Tear indicator */}
                            <path d="M46 62 Q 50 56, 54 62" stroke="#ef4444" strokeWidth="2.5" />
                            <circle cx="50" cy="60" r="1.5" fill="#ef4444" />
                            <path d="M38 72 C44 76, 56 76, 62 72" strokeOpacity="0.5" />
                          </svg>
                        )}
                        {selectedRadiology.imagePreview === 'xray_chest' && (
                          <svg viewBox="0 0 100 100" fill="none" stroke="#ffffff" strokeWidth="1.5">
                            {/* Ribcage Outline */}
                            <path d="M22 25 C 22 20, 78 20, 78 25 C 78 40, 82 72, 72 85 C 62 95, 38 95, 28 85 C 18 72, 22 40, 22 25 Z" strokeWidth="2" fill="rgba(255, 255, 255, 0.03)" />
                            {/* Left Lung */}
                            <path d="M26 30 Q 38 18, 48 30 Q 45 78, 30 80 Q 22 75, 26 30 Z" fill="rgba(255, 255, 255, 0.1)" strokeWidth="1"/>
                            {/* Right Lung */}
                            <path d="M74 30 Q 62 18, 52 30 Q 55 78, 70 80 Q 78 75, 74 30 Z" fill="rgba(255, 255, 255, 0.1)" strokeWidth="1"/>
                            {/* Rib bones */}
                            <path d="M24 38 Q 36 40, 47 38" strokeOpacity="0.4"/>
                            <path d="M76 38 Q 64 40, 53 38" strokeOpacity="0.4"/>
                            <path d="M23 48 Q 36 50, 46 48" strokeOpacity="0.4"/>
                            <path d="M77 48 Q 64 50, 54 48" strokeOpacity="0.4"/>
                            <path d="M23 58 Q 36 60, 46 58" strokeOpacity="0.4"/>
                            <path d="M77 58 Q 64 60, 54 58" strokeOpacity="0.4"/>
                            <path d="M24 68 Q 36 70, 47 68" strokeOpacity="0.4"/>
                            <path d="M76 68 Q 64 70, 53 68" strokeOpacity="0.4"/>
                            {/* Heart silhouette */}
                            <path d="M46 50 Q 52 64, 60 62 Q 54 75, 48 70 Z" fill="rgba(255, 255, 255, 0.15)" strokeWidth="1" strokeOpacity="0.5"/>
                            {/* Spine */}
                            <line x1="50" y1="20" x2="50" y2="88" strokeWidth="2.5" strokeOpacity="0.6" strokeDasharray="3 2"/>
                          </svg>
                        )}
                        {selectedRadiology.imagePreview === 'ct_brain' && (
                          <svg viewBox="0 0 100 100" fill="none" stroke="#ffffff" strokeWidth="1.5">
                            {/* Skull Outer Contours */}
                            <ellipse cx="50" cy="50" rx="36" ry="43" strokeWidth="2" fill="rgba(255, 255, 255, 0.03)" />
                            <ellipse cx="50" cy="50" rx="33" ry="40" strokeOpacity="0.4" />
                            {/* Brain lobes & contours */}
                            <path d="M50 13 C 32 23, 26 50, 32 75 C 38 86, 62 86, 68 75 C 74 50, 68 23, 50 13 Z" fill="rgba(255, 255, 255, 0.08)" strokeOpacity="0.8"/>
                            {/* Ventricles (Middle glowing butterfly shape) */}
                            <path d="M46 42 Q 50 35, 54 42 Q 52 50, 50 48 Q 48 50, 46 42 Z" strokeWidth="2" fill="rgba(255, 255, 255, 0.15)"/>
                            <path d="M42 46 Q 50 38, 58 46 Q 54 58, 50 54 Q 46 58, 42 46 Z" strokeOpacity="0.5" strokeDasharray="2 1"/>
                            {/* Cerebellum */}
                            <path d="M36 78 Q 50 72, 64 78 C 60 86, 40 86, 36 78 Z" fill="rgba(255, 255, 255, 0.12)" strokeOpacity="0.6"/>
                            {/* Sulci (Brain wrinkles) */}
                            <path d="M28 35 Q 36 32, 40 38" strokeOpacity="0.4"/>
                            <path d="M72 35 Q 64 32, 60 38" strokeOpacity="0.4"/>
                            <path d="M26 48 Q 36 46, 42 50" strokeOpacity="0.4"/>
                            <path d="M74 48 Q 64 46, 58 50" strokeOpacity="0.4"/>
                            <path d="M28 62 Q 36 60, 42 66" strokeOpacity="0.4"/>
                            <path d="M72 62 Q 64 60, 58 66" strokeOpacity="0.4"/>
                          </svg>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* CONTROLS BAR: Brightness, Contrast, Zoom, Grid, Invert */}
                <div className="dicom-controls-bar">
                  
                  {/* Slider controls */}
                  <div className="dicom-sliders">
                    
                    {/* Brightness */}
                    <div className="dicom-slider-group">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                      </svg>
                      <span>Parlaklık</span>
                      <input 
                        type="range" 
                        className="dicom-slider" 
                        min="50" 
                        max="180" 
                        value={brightness}
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                      />
                      <span style={{ fontSize: '10px', width: '28px', color: '#e4e4e7', fontFamily: 'monospace' }}>{brightness}%</span>
                    </div>

                    {/* Contrast */}
                    <div className="dicom-slider-group">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20Z" fill="currentColor"/>
                      </svg>
                      <span>Kontrast</span>
                      <input 
                        type="range" 
                        className="dicom-slider" 
                        min="50" 
                        max="180" 
                        value={contrast}
                        onChange={(e) => setContrast(parseInt(e.target.value))}
                      />
                      <span style={{ fontSize: '10px', width: '28px', color: '#e4e4e7', fontFamily: 'monospace' }}>{contrast}%</span>
                    </div>

                    {/* Zoom */}
                    <div className="dicom-slider-group">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>
                      </svg>
                      <span>Ölçek</span>
                      <input 
                        type="range" 
                        className="dicom-slider" 
                        min="0.8" 
                        max="2.0" 
                        step="0.1" 
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                      />
                      <span style={{ fontSize: '10px', width: '28px', color: '#e4e4e7', fontFamily: 'monospace' }}>{zoom.toFixed(1)}x</span>
                    </div>

                  </div>

                  {/* Tool Actions */}
                  <div className="dicom-action-buttons">
                    
                    {/* Toggle Grid */}
                    <button 
                      type="button" 
                      className={`btn-dicom-tool ${gridActive ? 'active' : ''}`}
                      onClick={() => setGridActive(!gridActive)}
                      title="Kılavuz Çizgilerini Aç/Kapat"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="3" x2="21" y1="15" y2="15"/><line x1="9" x2="9" y1="3" y2="21"/><line x1="15" x2="15" y1="3" y2="21"/>
                      </svg>
                      Grid
                    </button>

                    {/* Invert Colors */}
                    <button 
                      type="button" 
                      className={`btn-dicom-tool ${inverted ? 'inverted' : ''}`}
                      onClick={() => setInverted(!inverted)}
                      title="Renkleri Tersine Çevir (Negatif)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Zm0-2V4a8 8 0 0 1 0 16Z"/>
                      </svg>
                      Negatif
                    </button>

                    {/* Reset button */}
                    <button 
                      type="button" 
                      className="btn-dicom-tool"
                      onClick={() => {
                        setBrightness(100)
                        setContrast(100)
                        setZoom(1)
                        setGridActive(true)
                        setInverted(false)
                      }}
                      title="Ayarları Sıfırla"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                      </svg>
                      Sıfırla
                    </button>

                    {/* Close button */}
                    <button 
                      type="button" 
                      className="btn-save" 
                      style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                      onClick={() => setSelectedRadiology(null)}
                    >
                      Kapat
                    </button>

                  </div>

                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* ==================== HIGH-TECH LABORATORY WORKSTATION MODAL BACKDROP ==================== */}
      {/* PRESCRIPTION DETAILS MODAL */}
      {selectedPrescription && (
        <div className="dicom-overlay" onClick={() => setSelectedPrescription(null)}>
          <div className="dicom-modal" style={{ maxWidth: '600px', maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="dicom-header">
              <div className="dicom-brand">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                  <path d="m8.5 7.5 8 8"/>
                </svg>
                <span className="dicom-title">E-Reçete Detayları</span>
              </div>
              <button type="button" className="dicom-close-btn" onClick={() => setSelectedPrescription(null)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="dicom-body" style={{ padding: '24px', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Hekim</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '4px' }}>{selectedPrescription.doctor}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{selectedPrescription.hospital}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Reçete Bilgisi</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '4px' }}>{selectedPrescription.date}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>E-Reçete No: #{selectedPrescription.prescriptionNo}</span>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  Yazılan İlaçlar ve Kullanım Dozajları
                </h4>
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', lineHeight: '1.8', color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                  {selectedPrescription.medicines.split(', ').map((med, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                      <div style={{ marginTop: '4px', minWidth: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }}></div>
                      <span>{med}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  className="btn-save" 
                  style={{ flexGrow: 1, justifyContent: 'center' }}
                  onClick={() => {
                    navigator.clipboard.writeText(selectedPrescription.prescriptionNo);
                    showToast(`E-Reçete Kodu (${selectedPrescription.prescriptionNo}) panoya kopyalandı!`);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '8px' }}>
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                  </svg>
                  Kodu Kopyala
                </button>
                <button 
                  type="button" 
                  className="btn-save" 
                  style={{ flexGrow: 1, justifyContent: 'center', backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
                  onClick={() => setSelectedPrescription(null)}
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedLab && (
        <div className="dicom-overlay" onClick={() => setSelectedLab(null)}>
          <div className="dicom-modal" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
            
            {/* Lab Header */}
            <div className="dicom-header">
              <div className="dicom-brand">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2v7.31a2.5 2.5 0 0 1-.73 1.77l-4.54 4.55a4 4 0 0 0-.73 4.47C4.66 21.36 6 22 7.5 22h9c1.5 0 2.84-.64 3.5-1.9a4 4 0 0 0-.73-4.47l-4.54-4.55a2.5 2.5 0 0 1-.73-1.77V2Z"/>
                  <path d="M8.5 2h7"/>
                </svg>
                <span className="dicom-title">HEKİMİM TIBBİ LABORATUVAR PANELİ</span>
                <span className="dicom-logo-badge">LAB RESULT v1.0</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#71717a' }}>DURUM: ONAYLANDI</span>
                <button type="button" className="dicom-close-btn" onClick={() => setSelectedLab(null)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Lab Main Body */}
            <div className="dicom-body" style={{ flexDirection: 'column', padding: '24px', gap: '20px', overflowY: 'auto', maxHeight: '80vh' }}>
              
              {/* Lab Metadata Info Banner */}
              <div className="card" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', background: 'rgba(255, 255, 255, 0.01)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Hasta Bilgisi</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '4px' }}>{profileData.fullName}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{currentAge} Yaş / {profileData.bloodType}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Tetkik Tanımı</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '4px' }}>{selectedLab.title}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{selectedLab.department}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Hastane & Doktor</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '4px' }}>{selectedLab.hospital}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{selectedLab.doctor_name}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Rapor Tarihi</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)', marginTop: '4px' }}>{selectedLab.date}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Barkod: #LAB-{selectedLab.id}9182</span>
                </div>
              </div>

              {/* Lab Results Table */}
              <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Parametre / Analiz</th>
                      <th>Sonuç</th>
                      <th>Birim</th>
                      <th>Referans Aralığı</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLab.results.map((res, index) => {
                      let statusText = 'Normal';
                      let dynamicColor = 'var(--color-text-primary)';

                      if (res.status === 'high') {
                        statusText = 'Yüksek 📈';
                        dynamicColor = '#f59e0b';
                      } else if (res.status === 'low') {
                        statusText = 'Düşük 📉';
                        dynamicColor = '#3b82f6';
                      }

                      return (
                        <tr key={index}>
                          <td style={{ fontWeight: '700' }}>{res.name}</td>
                          <td style={{ fontWeight: '800', color: dynamicColor }}>{res.value}</td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{res.unit}</td>
                          <td style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{res.range}</td>
                          <td>
                            <span style={{ color: dynamicColor }}>
                              {statusText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Lab Footer Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  className="btn-save" 
                  style={{ flexGrow: 1, justifyContent: 'center' }}
                  onClick={() => generatePDF(selectedLab)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
                  </svg>
                  PDF Olarak İndir
                </button>
                <button 
                  type="button" 
                  className="btn-save" 
                  onClick={() => setSelectedLab(null)}
                >
                  Paneli Kapat
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {showAppointmentModal && (
        <div className="dicom-overlay" onClick={() => { setShowAppointmentModal(false); setNewAppointment({ doctor_id: '', appointment_date: '', appointment_time: '', reason: '' }); setSelectedSpecialty(''); }}>
          <div className="dicom-modal" style={{ maxWidth: '500px', background: 'var(--card-bg)' }} onClick={(e) => e.stopPropagation()}>
            <div className="dicom-header" style={{ background: 'var(--card-bg)' }}>
              <div className="dicom-brand">
                <span className="dicom-title" style={{ color: 'var(--text-main)' }}>Yeni Randevu Al</span>
              </div>
              <button type="button" className="dicom-close-btn" onClick={() => { setShowAppointmentModal(false); setNewAppointment({ doctor_id: '', appointment_date: '', appointment_time: '', reason: '' }); setSelectedSpecialty(''); }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="dicom-body" style={{ flexDirection: 'column', padding: '24px', gap: '20px', overflowY: 'auto' }}>
              <div className="form-group">
                <label className="form-label">Bölüm (Poliklinik) Seçin</label>
                <select 
                  className="form-input" 
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}
                  value={selectedSpecialty}
                  onChange={(e) => {
                    setSelectedSpecialty(e.target.value);
                    setNewAppointment({...newAppointment, doctor_id: ''}); // reset doctor
                  }}
                >
                  <option value="" style={{ color: 'black' }}>Tüm Bölümler</option>
                  {[...new Set(doctors.map(d => d.specialty).filter(Boolean))].map(spec => (
                    <option key={spec} value={spec} style={{ color: 'black' }}>{spec}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Doktor Seçin</label>
                <select 
                  className="form-input" 
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}
                  value={newAppointment.doctor_id}
                  onChange={(e) => setNewAppointment({...newAppointment, doctor_id: e.target.value})}
                >
                  <option value="" style={{ color: 'black' }}>Lütfen Seçiniz</option>
                  {doctors.filter(d => !selectedSpecialty || d.specialty === selectedSpecialty).map(d => (
                    <option key={d.id} value={d.id} style={{ color: 'black' }}>Dr. {d.first_name} {d.last_name} {selectedSpecialty ? '' : `- ${d.specialty}`}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tarih</label>
                <input 
                  type="date" 
                  className="form-input" 
                  style={{ colorScheme: 'dark', cursor: 'pointer' }}
                  min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                  value={newAppointment.appointment_date}
                  onChange={(e) => setNewAppointment({...newAppointment, appointment_date: e.target.value})}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Saat Seçimi (20 Dakikalık Periyotlar)</label>
                {newAppointment.doctor_id && newAppointment.appointment_date ? (
                  availableSlots.length === 0 ? (
                    <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '8px', textAlign: 'center', fontSize: '0.85rem' }}>
                      Doktor bu tarihte çalışmıyor veya tüm saatler dolu.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
                      {availableSlots.map(slot => {
                        const isSelected = newAppointment.appointment_time === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setNewAppointment({...newAppointment, appointment_time: slot})}
                            style={{
                              padding: '8px',
                              borderRadius: '8px',
                              border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--card-border)'}`,
                              background: isSelected ? 'rgba(20, 184, 166, 0.2)' : 'rgba(255,255,255,0.05)',
                              color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              fontWeight: isSelected ? '700' : '500',
                              transition: 'all 0.2s'
                            }}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--card-border)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Saat seçebilmek için lütfen önce doktor ve tarih seçin.
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Şikayetiniz / Notunuz</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  value={newAppointment.reason}
                  onChange={(e) => setNewAppointment({...newAppointment, reason: e.target.value})}
                  placeholder="Kısaca rahatsızlığınızı belirtin..."
                />
              </div>
              <button 
                className="btn-save" 
                style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
                onClick={async () => {
                  if(!newAppointment.doctor_id || !newAppointment.appointment_date || !newAppointment.appointment_time) {
                    showToast('Lütfen doktor, tarih ve saat seçin.', true);
                    return;
                  }
                  try {
                    let formattedTime = newAppointment.appointment_time;
                    if(formattedTime.split(':').length === 2) {
                      formattedTime += ':00';
                    }
                    const res = await fetchWithAuth(`${API_URL}/api/appointments/`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        patient_id: user.id,
                        doctor_id: parseInt(newAppointment.doctor_id),
                        appointment_date: newAppointment.appointment_date,
                        appointment_time: formattedTime,
                        reason: newAppointment.reason
                      })
                    });
                    if(res.ok) {
                      setNewAppointment({ doctor_id: '', appointment_date: '', appointment_time: '', reason: '' });
                      setShowAppointmentModal(false);
                      showToast('Randevunuz başarıyla oluşturuldu!', false);
                      const apptRes = await fetchWithAuth(`${API_URL}/api/appointments/patient/${user.id}`);
                      if (apptRes.ok) setAppointments(await apptRes.json());
                      setActiveTab('appointments');
                    } else {
                      showToast('Randevu alınamadı.', true);
                    }
                  } catch(e) {
                    showToast('Sunucu hatası.', true);
                  }
                }}
              >
                Randevuyu Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Toast Message */}
      {toastMessage && (
        <div className="toast">
          {isToastWarning ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" x2="12" y1="9" y2="13"/>
              <line x1="12" x2="12.01" y1="17" y2="17"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          )}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}

export default PatientDashboard
