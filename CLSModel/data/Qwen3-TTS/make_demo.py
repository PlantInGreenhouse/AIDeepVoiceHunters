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

fname = "/work/jiwoo3853/AIDeepVoiceHunters/CLSModel/data/Qwen3-TTS/my_real.flac"

gen_text = "엄마 나 경민인데, 지금 교통사고나서 병원비 좀 바로 보내줘"
ref_text = "엄마 나 경민인데, 지금 교통사고나서 병원비 좀 바로 보내줘"


wavs, sr = model.generate_voice_clone(
    text = gen_text,
    language="Korean",
    ref_audio=fname,
    ref_text=ref_text,
)

noise_factor = 0.005 

real, real_sr = sf.read(fname)
real = torch.tensor(real)

real = real + noise_factor * torch.randn_like(real)
sf.write("temp_real.flac", real, real_sr)


wavs = torch.tensor(wavs[0])
wavs = wavs + noise_factor * torch.randn_like(wavs)


sf.write("temp.flac", wavs, sr)
   
exit("end")