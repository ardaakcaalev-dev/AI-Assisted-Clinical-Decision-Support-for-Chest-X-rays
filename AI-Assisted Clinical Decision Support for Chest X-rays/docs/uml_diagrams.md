# UML Tasarım Diyagramları

Sistemin yapısal nesnelerini ve işleyiş adımlarını modellemek amacıyla, yazılım mimarisi tasarımında uluslararası standart olan UML (Unified Modeling Language) kullanılmıştır. Projenin karmaşık yapısını daha iyi ifade edebilmek adına, statik yapıyı göstermek için "Sınıf Diyagramı (Class Diagram)", dinamik yapay zeka analiz akışını göstermek için ise "Sıra Diyagramı (Sequence Diagram)" tercih edilmiştir.

## Sınıf Diyagramı (Class Diagram)

Sistemdeki veritabanı tablolarının nesne yönelimli (Object-Oriented) karşılıkları olan Modeller ve bu nesneler arasındaki kalıtım/ilişki yapıları Sınıf Diyagramı ile şematize edilmiştir. 
Sistemin merkezinde bulunan soyut (Abstract) "User" nesnesi; Doctor, Patient ve Admin sınıflarına kalıtım vermektedir. Doktorlar, kendi hastalarına muayene kaydı (Medical Record) oluştururken, bu kayıtlar kendi içerisinde yapay zeka analiz sonuçlarını (AI Analysis) barındırmaktadır.

```mermaid
classDiagram
    class User {
        <<Abstract>>
        +int id
        +String email
        +String password_hash
        +String role
        +login()
        +logout()
    }
    
    class Doctor {
        +String first_name
        +String last_name
        +String specialization
        +List~Patient~ patients
        +createMedicalRecord()
    }
    
    class Patient {
        +String tc_no
        +Date date_of_birth
        +String gender
        +List~MedicalRecord~ records
        +downloadPDF()
    }
    
    class Admin {
        +manageUsers()
        +viewSystemStats()
    }
    
    class MedicalRecord {
        +int id
        +Date created_at
        +String clinical_history
        +String diagnosis
        +getDetails()
    }
    
    class AIAnalysis {
        +int id
        +JSON risk_scores
        +String heatmap_url
        +String llm_report
        +generateHeatmap()
    }

    User <|-- Doctor : Kalıtım (Inheritance)
    User <|-- Patient : Kalıtım
    User <|-- Admin : Kalıtım
    Doctor "1" --> "*" Patient : Tedavi Eder
    Doctor "1" --> "*" MedicalRecord : Oluşturur
    Patient "1" --> "*" MedicalRecord : Sahibidir
    MedicalRecord "1" --> "1" AIAnalysis : İçerir
```

---

## Sıra Diyagramı (Sequence Diagram)

Sistemin en kritik iş süreci olan "Yapay Zeka Destekli Radyoloji Analizi", bir Sıra Diyagramı ile zamansal boyutta modellenmiştir. 
Bu diyagramda; hekimin arayüze röntgen yüklemesiyle başlayan sürecin arka plan API'ye iletilmesi, PyTorch destekli modelin analiz ve ısı haritası (Grad-CAM) oluşturması, ardından bu sayısal sonuçların Gemini LLM API'ye gönderilerek doğal dilde tıbbi rapora çevrilmesi ve son olarak tüm sürecin birleştirilip hekimin arayüzüne (React) döndürülmesi adım adım gösterilmiştir.

```mermaid
sequenceDiagram
    autonumber
    actor Hekim
    participant Arayüz as React Önyüzü
    participant API as FastAPI Sunucusu
    participant Model as PyTorch (DenseNet/ViT)
    participant LLM as Gemini API
    
    Hekim->>Arayüz: Röntgen Görüntüsü Yükler
    Arayüz->>API: POST /api/ai/analyze-xray (Image)
    activate API
    API->>Model: Tensör Dönüşümü ve Çıkarım İsteği
    activate Model
    Model-->>API: 14 Hastalık Risk Skoru & Grad-CAM Haritası
    deactivate Model
    API->>LLM: Skorları Gönder (JSON Prompt)
    activate LLM
    LLM-->>API: Doğal Dil Tıbbi Karar Raporu
    deactivate LLM
    API-->>Arayüz: Birleştirilmiş Analiz Sonucu (JSON)
    deactivate API
    Arayüz-->>Hekim: Isı Haritası ve LLM Raporunu Göster
```
