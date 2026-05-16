import os
import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel

model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-Base", #직접 다운
    device_map="cuda:0",
    dtype=torch.bfloat16,
    # attn_implementation="flash_attention_2", #flash attention 안씀
)

fname = "/work/jiwoo3853/AIDeepVoiceHunters/CLSModel/data/Qwen3-TTS/my_ref.flac"

gen_text = "엄마 나 경민인데, 지금 교통사고나서 병원비 좀 바로 보내줘"
ref_text = "여보세요 나야 잠깐 통화 가능해? 나 지금 물먹는 중"


wavs, sr = model.generate_voice_clone(
    text = gen_text,
    language="Korean",
    ref_audio=fname,
    ref_text=ref_text,
)


audio_np = wavs[0]
import numpy as np
if audio_np.dtype != np.int16:
    audio_np = np.clip(audio_np, -1.0, 1.0)
    audio_np = np.int16(audio_np * 32767)

from pydub import AudioSegment
audio_data = AudioSegment(
    data=audio_np.tobytes(),
    sample_width=audio_np.dtype.itemsize,  
    frame_rate=sr,                
    channels=1
)

audio_data.export("fake.m4a", format="ipod")


