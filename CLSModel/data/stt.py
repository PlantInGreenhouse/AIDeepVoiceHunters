import os
import whisper

model = whisper.load_model("turbo").cuda()

root_folder = "./train_data_01"
# root_folder = "./test_data_01"

flac_folder = root_folder + "/003"
output_folder = root_folder + "/text"
os.makedirs(output_folder, exist_ok=True)

for voices in os.listdir(flac_folder):
    os.makedirs(os.path.join(output_folder, voices), exist_ok=True)
    for filename in os.listdir(os.path.join(flac_folder, voices)):
        if os.path.splitext(filename)[1] != ".flac":
            print("skip: ", filename)
            continue
        flac_file = os.path.join(os.path.join(flac_folder, voices), filename)


        txt_filename = os.path.splitext(filename)[0] + ".txt"
        txt_path = os.path.join(os.path.join(output_folder, voices), txt_filename)
        try:
            result = model.transcribe(flac_file)["text"]
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(result)
        except Exception as e:
            print(f"오류 발생 ({filename}): {e}")