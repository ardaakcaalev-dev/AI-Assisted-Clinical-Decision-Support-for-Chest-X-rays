# Veri Akış Şemaları (DFD) Serisi

Sistemin üç farklı seviyedeki Veri Akış Şemaları (DFD). Diyagramlar Mermaid formatındadır; GitHub bunları doğrudan görüntüler.

---

## Kavramsal Veri Akış Şeması (Level 0 DFD)
*Sisteme dışarıdan kuş bakışı bakar. Sadece dış varlıklar ve ana sistemi gösterir.*

```mermaid
graph TD
    classDef system fill:#2c3e50,stroke:#34495e,stroke-width:4px,color:#fff,font-weight:bold
    classDef entity fill:#3498db,stroke:#2980b9,stroke-width:2px,color:#fff,font-weight:bold
    classDef ai fill:#e67e22,stroke:#d35400,stroke-width:2px,color:#fff,font-weight:bold

    Sistem((Hekimim\nKlinik Karar\nDestek Sistemi)):::system
    
    Hasta[Hasta]:::entity
    Hekim[Hekim]:::entity
    Gemini[Yapay Zeka Servisi]:::ai
    
    Hasta -- "Kayıt Bilgileri, Tahlil/Röntgen Görüntüleme İsteği" --> Sistem
    Sistem -- "PDF Tahlil Raporu, Geçmiş Ziyaretler" --> Hasta
    
    Hekim -- "Hasta Seçimi, X-Ray Görüntüsü" --> Sistem
    Sistem -- "Risk Skorları, Isı Haritası, Karar Destek Raporu" --> Hekim
    
    Sistem -- "Röntgen Verisi, Analiz İsteği" --> Gemini
    Gemini -- "Teşhis Çıktısı, Üretilmiş Metin" --> Sistem
```

---

## Mantıksal Veri Akış Şeması (Level 1 DFD)
*Sistemin içine girer ve teknolojiden bağımsız olarak ana iş akışlarını ve veri depolarını gösterir.*

```mermaid
graph TD
    classDef process fill:#16a085,stroke:#1abc9c,stroke-width:2px,color:#fff,font-weight:bold,shape:circle
    classDef datastore fill:#f1c40f,stroke:#f39c12,stroke-width:2px,color:#333,font-weight:bold
    classDef entity fill:#3498db,stroke:#2980b9,stroke-width:2px,color:#fff,font-weight:bold
    classDef ai fill:#e67e22,stroke:#d35400,stroke-width:2px,color:#fff,font-weight:bold

    %% Dış Varlıklar
    Hasta[Hasta]:::entity
    Hekim[Hekim]:::entity
    Gemini[Yapay Zeka Servisi]:::ai

    %% İşlemler (Processes)
    P1((1.0\nKullanıcı\nDoğrulama)):::process
    P2((2.0\nHasta ve\nTahlil Yönetimi)):::process
    P3((3.0\nTıbbi Görüntü\nAnalizi)):::process
    P4((4.0\nRapor\nÜretimi)):::process

    %% Veri Depoları (Data Stores)
    D1[(D1: Kullanıcı Kayıtları)]:::datastore
    D2[(D2: Tıbbi Arşiv)]:::datastore

    %% Akışlar
    Hasta -- "Kimlik Bilgisi" --> P1
    Hekim -- "Kimlik Bilgisi" --> P1
    
    P1 -- "Doğrulanmış Hasta" --> P2
    P1 -- "Doğrulanmış Hekim" --> P3
    P1 -- "Erişim Sorgusu" --> D1
    
    P2 -- "Tahlil/Randevu Verisi" --> D2
    D2 -- "Geçmiş Tıbbi Bilgiler" --> P2
    P2 -- "Hastanın Geçmiş Tıbbi Bilgisi" --> P3
    
    %% HASTA ARTIK GEÇMİŞ RÖNTGENLERİ DE ALABİLİYOR
    P2 -- "Tahlil Raporu ve Geçmiş Röntgen Çıktısı" --> Hasta
    
    Hekim -- "Yeni X-Ray Görüntüsü" --> P3
    P3 -- "Görüntü Arşivi" --> D2
    P3 -- "Risk Skorları ve Haritalar" --> P4
    
    P4 -- "Analiz İsteği ve Görüntü" --> Gemini
    Gemini -- "Teşhis Çıktısı (Metin)" --> P4
    
    %% GERİ BESLEME (P4'ten P2'ye)
    P4 -- "Teşhis Kaydı (Hasta Profili İçin)" --> P2
    
    P4 -- "Nihai Karar Destek Raporu" --> Hekim
    D2 -- "Analiz Referansları" --> P4
```

---

## Fiziksel Veri Akış Şeması (Physical DFD)
*Mantıksal akışların teknik olarak (PostgreSQL, React, JWT vb.) nasıl yapıldığını gösteren mimari harita.*

```mermaid
graph TD
    classDef process fill:#8e44ad,stroke:#9b59b6,stroke-width:2px,color:#fff,font-weight:bold
    classDef datastore fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff,font-weight:bold
    classDef entity fill:#2c3e50,stroke:#34495e,stroke-width:2px,color:#fff,font-weight:bold

    %% Dış Cihazlar / İstemciler
    HastaApp[Hasta Tarayıcısı\n(React SPA)]:::entity
    HekimApp[Hekim Tarayıcısı\n(React SPA)]:::entity
    GeminiAPI[Google Gemini API]:::entity

    %% Sunucu Süreçleri (FastAPI)
    AuthServer((1.0\nJWT Auth Sunucusu\n(FastAPI))):::process
    LabServer((2.0\nLaboratuvar API\n(Stateless JWT Verify))):::process
    VisionEngine((3.0\nCNN/ViT Motoru\n(Stateless JWT Verify))):::process
    ReportEngine((4.0\nLLM Rapor Motoru\n(FastAPI))):::process
    
    %% İstemci Taraflı Süreç (HATA DÜZELTMESİ)
    PDFRenderer((İstemci PDF\nOluşturucu\nhtml2pdf.js)):::process

    %% Fiziksel Depolar
    DB[(D1: PostgreSQL DB\ndoctor_patient_db)]:::datastore
    Storage[(D2: Local File System\n/uploads)]:::datastore

    %% Akışlar
    HastaApp -- "POST /api/auth\n(Email/Pass)" --> AuthServer
    HekimApp -- "POST /api/auth\n(Email/Pass)" --> AuthServer
    AuthServer -- "Bearer Token (JWT)" --> HastaApp
    AuthServer -- "Bearer Token (JWT)" --> HekimApp
    AuthServer -- "SQL SELECT" --> DB
    
    HastaApp -- "GET /api/lab-studies\n+ HTTP Bearer" --> LabServer
    LabServer -- "JSON Tahlil Verisi" --> PDFRenderer
    PDFRenderer -- "PDF Rapor Dosyası" --> HastaApp
    LabServer -- "SQL SELECT/INSERT" --> DB
    
    HekimApp -- "POST /api/radiology\n(multipart/form-data)" --> VisionEngine
    VisionEngine -- "Save .jpg/.png & Heatmap" --> Storage
    VisionEngine -- ".pt / .h5 Inference" --> ReportEngine
    ReportEngine -- "Read Heatmap URL" --> Storage
    
    ReportEngine -- "HTTP POST\n(Image URL + Prompt)" --> GeminiAPI
    GeminiAPI -- "JSON (LLM Text)" --> ReportEngine
    ReportEngine -- "SQL INSERT (Analysis)" --> DB
    ReportEngine -- "JSON (Score + Heatmap URL + Text)" --> HekimApp
```
