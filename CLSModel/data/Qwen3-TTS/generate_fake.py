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

root_folder = "../train_data_01"
# root_folder = "../test_data_01"

real_folder = root_folder + "/003"

output_folder = root_folder + "/gen"
os.makedirs(output_folder, exist_ok=True)


failed_list = []
fail_cnt = 0
for voices in os.listdir(real_folder):
    os.makedirs(os.path.join(output_folder, voices), exist_ok=True)

    #reference audio/text
    ref_audio_fname = os.listdir(os.path.join(real_folder, voices))[0] #각 사람마다 첫번째 오디오가 ref

    #flac이 아니면(tras.txt라면) 다른 파일로 바꾸기
    if os.path.splitext(ref_audio_fname)[1] != ".flac":
        ref_audio_fname = os.listdir(os.path.join(real_folder, voices))[1] #두번째로
        print(f"change ref audio {os.listdir(os.path.join(real_folder, voices))[0]} -> {ref_audio_fname}: ")

    #Reference audio
    ref_audio_path = os.path.join(os.path.join(real_folder, voices), ref_audio_fname)
    ref_audio = ref_audio_path

    #reference Text
    for f in os.listdir(os.path.join(real_folder, voices)):
        if os.path.splitext(f)[1] == ".txt":
            ref_text_fname = f
    ref_text_path = os.path.join(os.path.join(real_folder, voices), ref_text_fname)
    
    text_dict = {}
    try:
        with open(ref_text_path, 'r', encoding='utf-8') as f:
            for line in f:
                # 줄바꿈 문자 제거 및 앞뒤 공백 제거
                line = line.strip()
                
                # 빈 줄은 건너뜀
                if not line:
                    continue
                    
                # 첫 번째 공백을 기준으로 나눔
                if ' ' in line:
                    key, value = line.split(' ', 1)
                    text_dict[key] = value
    except Exception as e:
        print(f"오류 발생 ({ref_text_path}): {e}")
        continue

        
    ref_text = text_dict[os.path.splitext(ref_audio_fname)[0]]


    #Process each sample
    for filename in os.listdir(os.path.join(real_folder, voices)):
        #.flac이 아니면 넘기기
        if os.path.splitext(filename)[1] != ".flac":
            print("skip : ", filename)
            continue

        gen_text = text_dict[os.path.splitext(filename)[0]]

        gen_filename = os.path.splitext(filename)[0] + "_fake.flac"
        gen_path = os.path.join(os.path.join(output_folder, voices), gen_filename)

        try:
            wavs, sr = model.generate_voice_clone(
                text = gen_text,
                language="Korean",
                ref_audio=ref_audio,
                ref_text=ref_text,
            )
            sf.write(gen_path, wavs[0], sr)
            # print("saved")
        except Exception as e:
            print(f"오류 발생 ({filename}): {e}")
            failed_list.append(filename)
            fail_cnt+= 1
exit("end")