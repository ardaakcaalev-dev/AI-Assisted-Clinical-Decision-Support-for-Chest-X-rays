from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import io
import cv2
import numpy as np
import base64
import os
import torch.nn.functional as F
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import shutil
from pathlib import Path
import google.generativeai as genai

from app.core.config import UPLOAD_DIR, DENSENET_WEIGHTS_PATH, GEMINI_API_KEY, GEMINI_MODEL, VIT_WEIGHTS_PATH

genai.configure(api_key=GEMINI_API_KEY)

# ViT imports
from transformers import ViTModel

router = APIRouter()

# Global variables for models
densenet_model = None
vit_model = None
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Grad-CAM variables for DenseNet
features_blobs = []
gradients_blobs = []

def forward_hook(module, input, output):
    features_blobs.append(output)

def backward_hook(module, grad_in, grad_out):
    gradients_blobs.append(grad_out[0])

# Grad-CAM variables for ViT
vit_features_blobs = []
vit_gradients_blobs = []

def vit_forward_hook(module, input, output):
    # Depending on the module, output might be a tuple. For ViTLayer it's a tuple.
    if isinstance(output, tuple):
        t = output[0]
    else:
        t = output
    if t.requires_grad:
        t.retain_grad()
    vit_features_blobs.append(t)

# NIH Chest X-Ray Classes
DISEASES = [
    'Atelectasis', 'Cardiomegaly', 'Effusion', 'Infiltration', 'Mass', 'Nodule', 
    'Pneumonia', 'Pneumothorax', 'Consolidation', 'Edema', 'Emphysema', 
    'Fibrosis', 'Pleural_Thickening', 'Hernia'
]

# Fusion AUC Weights
DENSENET_AUC = {
    "Atelectasis": 0.761, "Cardiomegaly": 0.823, "Effusion": 0.823,
    "Infiltration": 0.661, "Mass": 0.762, "Nodule": 0.654,
    "Pneumonia": 0.662, "Pneumothorax": 0.819, "Consolidation": 0.762,
    "Edema": 0.849, "Emphysema": 0.834, "Fibrosis": 0.736,
    "Pleural_Thickening": 0.733, "Hernia": 0.818
}

VIT_AUC = {
    "Atelectasis": 0.761, "Cardiomegaly": 0.850, "Effusion": 0.829,
    "Infiltration": 0.678, "Mass": 0.746, "Nodule": 0.669,
    "Pneumonia": 0.688, "Pneumothorax": 0.831, "Consolidation": 0.774,
    "Edema": 0.859, "Emphysema": 0.833, "Fibrosis": 0.740,
    "Pleural_Thickening": 0.739, "Hernia": 0.851
}

# Per-class thresholds that maximise F1 for the ViT model (see notebooks/03_vit_training.ipynb)
VIT_THRESHOLDS = {
    "Atelectasis": 0.170, "Cardiomegaly": 0.100, "Effusion": 0.260,
    "Infiltration": 0.240, "Mass": 0.110, "Nodule": 0.110,
    "Pneumonia": 0.010, "Pneumothorax": 0.130, "Consolidation": 0.090,
    "Edema": 0.060, "Emphysema": 0.090, "Fibrosis": 0.040,
    "Pleural_Thickening": 0.080, "Hernia": 0.020
}

def _require_weights(path: str, name: str) -> Path:
    p = Path(path)
    if not p.exists():
        raise HTTPException(
            status_code=503,
            detail=f"{name} model weights not found at '{p}'. Download them and set the path in backend/.env (see README).",
        )
    return p


def _resolve_vit_weights(path: str) -> str:
    """A PyTorch checkpoint is a zip archive. Some downloads (e.g. from Google Drive) arrive unzipped
    as a folder; if so, re-pack it once into a sibling file that torch.load can read."""
    p = _require_weights(path, "ViT")
    if p.is_dir():
        packed = p.with_name(f"{p.stem}_packed.pt")
        if not packed.exists():
            archive = shutil.make_archive(str(packed.with_suffix("")), "zip", root_dir=p)
            shutil.move(archive, packed)
        return str(packed)
    return str(p)

# Validation Transforms
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ViT Class
class ViTChestXray(nn.Module):
    def __init__(self, num_labels=14, dropout=0.3):
        super().__init__()
        self.vit = ViTModel.from_pretrained('google/vit-base-patch16-224', attn_implementation='eager')
        hidden_size = self.vit.config.hidden_size
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(hidden_size, num_labels)

    def forward(self, pixel_values):
        outputs = self.vit(pixel_values=pixel_values)
        cls_output = outputs.last_hidden_state[:, 0, :]
        cls_output = self.dropout(cls_output)
        logits = self.classifier(cls_output)
        return torch.sigmoid(logits)

def load_models():
    global densenet_model, vit_model
    
    if densenet_model is None:
        weights = _require_weights(DENSENET_WEIGHTS_PATH, "DenseNet121")
        print(f"Loading DenseNet121... {weights}")
        densenet_model = models.densenet121()
        num_ftrs = densenet_model.classifier.in_features
        densenet_model.classifier = nn.Linear(num_ftrs, 14)
        
        state_dict = torch.load(weights, map_location=device)
        new_state_dict = {k.replace('module.', ''): v for k, v in state_dict.items()}
        densenet_model.load_state_dict(new_state_dict)
        densenet_model.to(device)
        densenet_model.eval()
        
        def new_forward(x):
            features = densenet_model.features(x)
            out = F.relu(features, inplace=False)
            out = F.adaptive_avg_pool2d(out, (1, 1))
            out = torch.flatten(out, 1)
            out = densenet_model.classifier(out)
            return out
        densenet_model.forward = new_forward
        
        target_layer = densenet_model.features.norm5
        target_layer.register_forward_hook(forward_hook)
        target_layer.register_full_backward_hook(backward_hook)
        
    if vit_model is None:
        vit_weights = _resolve_vit_weights(VIT_WEIGHTS_PATH)
        print(f"Loading ViT... {vit_weights}")

        vit_model = ViTChestXray(num_labels=14).to(device)
        vit_state_dict = torch.load(vit_weights, map_location=device)
        vit_model.load_state_dict(vit_state_dict)
        vit_model.eval()
        
        if hasattr(vit_model.vit, 'encoder'):
            target_layer_v = vit_model.vit.encoder.layer[-1].layernorm_before
        elif hasattr(vit_model.vit, 'layers'):
            target_layer_v = vit_model.vit.layers[-1].layernorm_before
        else:
            raise AttributeError("ViTModel does not have 'encoder' or 'layers' attribute.")
            
        target_layer_v.register_forward_hook(vit_forward_hook)
        
    return densenet_model, vit_model

@router.post("/analyze-xray")
async def analyze_xray(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Sadece resim dosyaları kabul edilmektedir.")
        
    try:
        d_model, v_model = load_models()
        
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        input_tensor = transform(image).unsqueeze(0).to(device)
        
        with torch.no_grad():
            d_out = d_model(input_tensor)
            d_probs = torch.sigmoid(d_out)[0].cpu().numpy()
            
            v_probs = v_model(input_tensor)[0].cpu().numpy()
            
        results = []
        for i, disease in enumerate(DISEASES):
            d_auc = DENSENET_AUC[disease]
            v_auc = VIT_AUC[disease]
            # Sabit Ağırlık: Her zaman DenseNet %60, ViT %40
            w_d, w_v = 0.60, 0.40
                
            fusion_prob = (w_d * d_probs[i]) + (w_v * v_probs[i])
            
            # Check threshold against raw ViT probability
            is_detected = bool(v_probs[i] >= VIT_THRESHOLDS[disease])
            
            results.append({
                "disease": disease,
                "probability": float(fusion_prob),
                "percentage": round(float(fusion_prob) * 100, 2),
                "densenet_prob": float(d_probs[i]),
                "vit_prob": float(v_probs[i]),
                "is_detected": is_detected,
                "applied_threshold": float(VIT_THRESHOLDS[disease]),
                "weights_used": {
                    "densenet": w_d,
                    "vit": w_v
                }
            })
            
        results.sort(key=lambda x: x["probability"], reverse=True)
        
        return {
            "success": True,
            "predictions": results,
            "message": "AI Fusion analizi başarıyla tamamlandı."
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/gradcam")
async def generate_gradcam(
    disease: str = Form(...),
    file: Optional[UploadFile] = File(None),
    file_url: Optional[str] = Form(None)
):
    global features_blobs, gradients_blobs, vit_features_blobs, vit_gradients_blobs
    
    if disease not in DISEASES:
        raise HTTPException(status_code=400, detail="Geçersiz hastalık ismi.")
        
    try:
        d_model, v_model = load_models()
        
        features_blobs.clear()
        gradients_blobs.clear()
        vit_features_blobs.clear()
        vit_gradients_blobs.clear()
        
        if file_url:
            filepath = UPLOAD_DIR / os.path.basename(file_url)
            if not os.path.exists(filepath):
                 raise HTTPException(status_code=404, detail="File not found on server.")
            with open(filepath, "rb") as f:
                image_bytes = f.read()
        elif file:
            image_bytes = await file.read()
        else:
            raise HTTPException(status_code=400, detail="Görüntü dosyası veya URL belirtilmedi.")
            
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        original_img_np = np.array(pil_image)
        
        input_tensor = transform(pil_image).unsqueeze(0).to(device)
        input_tensor.requires_grad_(True)
        
        # 1. DenseNet Grad-CAM
        d_model.zero_grad()
        d_outputs = d_model(input_tensor)
        class_idx = DISEASES.index(disease)
        score = d_outputs[0, class_idx]
        score.backward()
        
        gradients = gradients_blobs[0].cpu().data.numpy()[0]
        features = features_blobs[0].cpu().data.numpy()[0]
        weights = np.mean(gradients, axis=(1, 2))
        
        cam = np.zeros(features.shape[1:], dtype=np.float32)
        for i, w in enumerate(weights):
            cam += w * features[i]
            
        cam = np.maximum(cam, 0)
        cam = cv2.resize(cam, (original_img_np.shape[1], original_img_np.shape[0]))
        cam = cam - np.min(cam)
        cam = cam / (np.max(cam) + 1e-8)
        cam = np.uint8(255 * cam)
        
        heatmap_d = cv2.applyColorMap(cam, cv2.COLORMAP_JET)
        heatmap_d_rgb = cv2.cvtColor(heatmap_d, cv2.COLOR_BGR2RGB)
        superimposed_d = heatmap_d_rgb * 0.4 + original_img_np * 0.6
        superimposed_d = np.uint8(superimposed_d)
        
        final_pil_d = Image.fromarray(superimposed_d)
        buffered_d = io.BytesIO()
        final_pil_d.save(buffered_d, format="JPEG", quality=85)
        d_str = base64.b64encode(buffered_d.getvalue()).decode()
        
        return {
            "success": True,
            "disease": disease,
            "gradcam_base64": f"data:image/jpeg;base64,{d_str}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Harita oluşturulurken hata: {str(e)}")

class ReportRequest(BaseModel):
    patient_info: str
    study_info: str
    clinical_history: str
    ai_results: List[Dict[str, Any]]

@router.post("/generate-report")
async def generate_report(req: ReportRequest):
    try:
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not set in backend/.env")
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        # Build prompt
        prompt = f"""Sen alanında uzman, tecrübeli bir Radyoloji Uzmanısın.
Sana hastanın temel bilgileri, klinik öyküsü ve AI (Yapay Zeka) modelimizin analiz sonuçları verilecektir.
Senden bu verileri kullanarak resmi bir 'Radyoloji Ön Değerlendirme Raporu' yazmanı istiyorum.

Kurallar:
1. Kesin teşhis kelimeleri kullanma, 'şüphesi', 'ile uyumlu bulgular' gibi profesyonel terimler kullan.
2. Raporu 3 başlıkta yaz: Klinik Bilgi, Radyolojik Bulgular, Sonuç ve Öneri. Başka hiçbir şey yazma (selamlama, giriş cümlesi vb. olmasın).
3. Dili tıbbi ağırlıkta olsun ancak hastanın okuduğunda durumu anlayabileceği bir tonda olsun.
4. Sadece verilen hastalıklar (Yapay Zeka Kararları) hakkında yorum yap.
5. Yapay Zeka kararlarını yazarken yüzdeleri de belirt.

Hasta Bilgisi: {req.patient_info}
İşlem Bilgisi: {req.study_info}
Klinik Öykü: {req.clinical_history}

Yapay Zeka (AI Fusion) Kararları (Sadece doktorun onayladıkları):
"""
        for r in req.ai_results:
            prompt += f"- {r.get('disease')}: %{r.get('percentage')} risk (Eşik Aşıldı: {r.get('is_detected')})\n"

        response = model.generate_content(prompt)
        
        return {
            "success": True,
            "report": response.text
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Rapor üretilirken hata: {str(e)}")
