import json
import numpy as np
import random
import torch
from importlib import import_module
from typing import Dict, List, Union
import soundfile as sf
from CLSModel.aasist.data_utils import pad_center
from torch import Tensor


##Set seed
seed = 1234

random.seed(seed)
np.random.seed(seed)
torch.manual_seed(seed)
torch.cuda.manual_seed_all(seed)
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False


def get_model(model_config: Dict, device: torch.device):
    """Define DNN model architecture"""
    module = import_module("CLSModel.aasist.models.{}".format(model_config["architecture"]))
    _model = getattr(module, "Model")
    model = _model(model_config).to(device)
    nb_params = sum([param.view(-1).size()[0] for param in model.parameters()])
    print("no. model params:{}".format(nb_params))

    return model

def run_detection():
    with open("./CLSModel/aasist/config/AASIST.conf", "r") as f_json:
        config = json.loads(f_json.read())
    model_config = config["model_config"]
    ######settings
    device = "cuda"
    ckpt_dir = "CLSModel/aasist/results/e=100_b=24_lr=0.0001/ckpt_1.pth"
    audio_path = "/work/jiwoo3853/AIDeepVoiceHunters/CLSModel/data/test_data_01/003/104/104_003_0019.flac"
    ref_audio_path = "/work/jiwoo3853/AIDeepVoiceHunters/CLSModel/data/test_data_01/gen/104/104_003_0019_fake.flac"
    cut = 64600

    # define model architecture
    model = get_model(model_config, device)
    ##Load pretrained weights
    model.add_new_modules() 

    checkpoint = torch.load(ckpt_dir, map_location='cpu')
    model.load_state_dict(checkpoint["model_state_dict"])

    model.to(device)





    ####Data preprocessing
    X, x_sr = sf.read(audio_path)
    X_len_ori = X.shape[0]

    X_pad = pad_center(X, x_sr, cut)
    if X_len_ori >= X_pad.shape[0]: #cropped case
        mode = "crop"
    else: #padding case
        mode = "pad"
                

                # ##temp recover
                # stt = (X_len_ori - X_pad.shape[0]) // 2
                # stt_sec = stt / x_sr
                # out_time = stt_sec + (self.cut // 2 / x_sr)
    x_inp = Tensor(X_pad)

    Ref, ref_sr = sf.read(ref_audio_path)
    Ref_pad = pad_center(Ref, ref_sr, cut)
    ref_inp = Tensor(Ref_pad)

    # noise_factor = 0.005 
    # x_inp = x_inp + noise_factor * torch.randn_like(x_inp)
    # ref_inp = ref_inp + noise_factor * torch.randn_like(ref_inp)
            # sf.write("n_ref.flac", ref_inp, ref_sr)

    ####Model Inference
    model.eval()
    with torch.no_grad():
        x_inp = x_inp.unsqueeze(0).to(device) #batch dim
        ref_inp = ref_inp.unsqueeze(0).to(device) #batch dim
        _, batch_out, t_attn_score = model(x_inp, ref_inp, time_attention = True) #B x 2
        prob = torch.softmax(batch_out, dim=1)[0][1]

        
        anomalous_idx = torch.argmax(t_attn_score.squeeze(1), dim=-1)
        stt = (X_len_ori - X_pad.shape[0]) // 2
        stt_sec = stt / x_sr
        anomalous_time = stt_sec + (anomalous_idx/ x_sr)
    return [prob.item(), anomalous_time.item()]


import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent

# project/aasist/
# KG/
KG_ROOT = PROJECT_ROOT / "KG"
# /KG/src/
KG_SRC_DIR = KG_ROOT / "src"
# KG/src 내부 모듈을 import할 수 있도록 경로 추가
sys.path.append(str(KG_SRC_DIR))

from detection_output_adapter import create_detection_output_json_from_model_output
from main import main as build_kg_main

def run_kg(model_output):
    create_detection_output_json_from_model_output(
        model_output=model_output
    )
    build_kg_main()





def run_both():
    model_output = run_detection()
    print("model output: ", model_output)
    run_kg(model_output)
    breakpoint()

    final_output = None
    return final_output



def main():
    final_output = run_both()
    breakpoint()
    exit()


if __name__=="__main__":
    exit(main())
