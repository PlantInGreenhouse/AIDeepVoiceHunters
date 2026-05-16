from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
import shutil

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def save_upload_file(upload_file: UploadFile, dst_path: str):
    with open(dst_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

def run_voice_model(user_voice_path: str, comparison_voice_path: str):
    """
    여기에 실제 모델 추론 코드 연결.
    user_voice_path: 등록 음성
    comparison_voice_path: 통화 음성
    """

    # 예시 결과. 실제 모델 결과로 바꾸면 됨.
    similarity = 32.5
    spoof_probability = 78.0
    confidence = 91.0

    return {
        "riskScore": round(spoof_probability),
        "similarity": round(similarity),
        "confidence": round(confidence),
        "spoofProbability": round(spoof_probability),
        "summary": "등록 음성과 통화 음성의 화자 특성이 크게 달라 딥보이스 의심 상태로 판단되었습니다.",
        "reasons": [
            "등록 음성과 통화 음성의 화자 임베딩 유사도가 낮게 측정되었습니다.",
            "일부 구간에서 합성음 또는 변조 음성으로 의심되는 패턴이 관찰되었습니다.",
            "모델 신뢰도가 기준값 이상으로 측정되었습니다."
        ]
    }

@app.get("/")
async def root():
    return {"message": "AIDeepVoiceHunters 서버가 정상적으로 작동 중입니다!"}


@app.post("/analyze")
async def analyze(
    user_voice: UploadFile = File(...),
    comparison_voice: UploadFile = File(...)
):
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            user_path = os.path.join(tmpdir, "user_voice.m4a")
            comparison_path = os.path.join(tmpdir, "comparison_voice.m4a")

            save_upload_file(user_voice, user_path)
            save_upload_file(comparison_voice, comparison_path)

            result = run_voice_model(user_path, comparison_path)

            return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))