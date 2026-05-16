from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
import shutil
from pydub import AudioSegment
import soundfile as sf
import json


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

@app.get("/")
async def root():
    return {"message": "AIDeepVoiceHunters 서버가 정상적으로 작동 중입니다!"}

@app.post("/analyze")
async def analyze(
    user_voice: UploadFile = File(...),
    comparison_voice: UploadFile = File(...)
):
    ref_voice = comparison_voice
    
    try:
        temp_dir = "./temp"
        os.makedirs(temp_dir, exist_ok=True)
            
        user_path = "./temp/user_voice.m4a"
        ref_path = "./temp/ref_voice.m4a"

        save_upload_file(user_voice, user_path)
        save_upload_file(ref_voice, ref_path)


        user_audio = AudioSegment.from_file(user_path, format="m4a")
        user_flac_path = os.path.splitext(user_path)[0] + ".flac"
        user_audio.export(user_flac_path, format="flac")

        ref_audio = AudioSegment.from_file(ref_path, format="m4a")
        ref_flac_path = os.path.splitext(ref_path)[0] + ".flac"
        ref_audio.export(ref_flac_path, format="flac")


        ##stereo
        X, x_sr = sf.read(user_flac_path)
        if len(X.shape) == 2: #2차원이고
            if X.shape[-1] == 2: #2채널이면
                X = X.mean(axis = -1)

        Ref, ref_sr = sf.read(ref_flac_path)
        if len(Ref.shape) == 2: #2차원이고
            if Ref.shape[-1] == 2: #2채널이면
                Ref = Ref.mean(axis = -1)

        sf.write(user_flac_path, X, x_sr)
        sf.write(ref_flac_path, Ref, ref_sr)

        from run_cls_kg import run_both
        run_both(user_flac_path, ref_flac_path)

        json_path = "./KG/data/graph/C001_graph.json"
        # 파일 열기 (한글 깨짐 방지를 위해 encoding='utf-8'을 꼭 넣어주세요)
        with open(json_path, 'r', encoding='utf-8') as file:
            final_result = json.load(file)
        node_list = final_result["nodes"]

        #Find probability
        for item in node_list:
            if item.get("type") == "SpoofAssessment":
                prob = item.get("properties").get("confidence")
                summary = item.get("properties").get("summary")
                break  

        #point
        for item in node_list:
            if item.get("type") == "DetectedPeriod":
                point = item.get("properties").get("point")
                break  

        print("server end")

        return {
            "riskScore": prob,
            "summary": summary,
            "spoofPoint": point,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))