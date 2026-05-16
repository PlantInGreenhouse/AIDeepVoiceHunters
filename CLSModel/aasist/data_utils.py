import numpy as np
import soundfile as sf
import torch
from torch import Tensor
from torch.utils.data import Dataset

___author__ = "Hemlata Tak, Jee-weon Jung"
__email__ = "tak@eurecom.fr, jeeweon.jung@navercorp.com"


def genSpoof_list(dir_meta, is_train=False, is_eval=False):

    d_meta = {}
    file_list = []
    with open(dir_meta, "r") as f:
        l_meta = f.readlines()

    if is_train:
        for line in l_meta:
            _, key, _, _, label = line.strip().split(" ")
            file_list.append(key)
            d_meta[key] = 1 if label == "bonafide" else 0
        return d_meta, file_list

    elif is_eval:
        for line in l_meta:
            _, key, _, _, _ = line.strip().split(" ")
            #key = line.strip()
            file_list.append(key)
        return file_list
    else:
        for line in l_meta:
            _, key, _, _, label = line.strip().split(" ")
            file_list.append(key)
            d_meta[key] = 1 if label == "bonafide" else 0
        return d_meta, file_list


def pad(x, max_len=64600):
    x_len = x.shape[0]
    if x_len >= max_len:
        return x[:max_len]
    # need to pad
    num_repeats = int(max_len / x_len) + 1
    padded_x = np.tile(x, (1, num_repeats))[:, :max_len][0]
    return padded_x


def pad_random(x: np.ndarray, max_len: int = 64600):
    x_len = x.shape[0]
    # if duration is already long enough
    if x_len >= max_len:
        stt = np.random.randint(x_len - max_len)
        return x[stt:stt + max_len]

    # if too short
    num_repeats = int(max_len / x_len) + 1
    padded_x = np.tile(x, (num_repeats))[:max_len]
    return padded_x

def pad_center(x: np.ndarray, sr: int, max_len: int = 64600):
    """
    오디오 데이터를 고정 길이로 맞추며, 길 경우 중앙을 크롭합니다.
    
    Returns:
        padded_x (np.ndarray): 길이가 맞춰진 오디오 배열
        stt_sec (float): 원본 오디오 기준 시작 시간 (초)
        end_sec (float): 원본 오디오 기준 종료 시간 (초)
    """
    x_len = x.shape[0]

    # 1. 오디오가 목표 길이보다 길거나 같을 때 (Center Crop)
    if x_len >= max_len:
        # 전체 길이에서 남는 길이의 딱 절반을 시작점으로 잡습니다.
        stt = (x_len - max_len) // 2 
        end = stt + max_len
        
        # 샘플 인덱스를 샘플링 레이트로 나누어 초 단위로 변환합니다.
        stt_sec = stt / sr
        end_sec = end / sr
        
        return x[stt:end]

    # 2. 오디오가 목표 길이보다 짧을 때 (Tile Padding)
    num_repeats = int(max_len / x_len) + 1
    padded_x = np.tile(x, num_repeats)[:max_len]
    
    return padded_x

import os
class Dataset_Deepvoice(Dataset): #train / test 겸용
    def __init__(self, base_dir, is_test = False):
        self.base_dir = base_dir
        self.cut = 64600  # take ~4 sec audio (64600 samples)
        self.is_test = is_test

        real_paths = []
        real_labels = []
        real_refs = []
        real_audio_voices = base_dir + "003/"
        for r_voice in os.listdir(real_audio_voices):
            cur_fname = os.listdir(real_audio_voices + r_voice)[0]
            #flac이 아니면(tras.txt라면) 다른 파일로 바꾸기
            if os.path.splitext(cur_fname)[1] != ".flac":
                cur_fname = os.listdir(real_audio_voices + r_voice)[1] #두번째로
            cur_ref = os.path.join(real_audio_voices + r_voice, cur_fname)
            for r_fname in os.listdir(real_audio_voices + r_voice):
                if os.path.splitext(r_fname)[1] != ".flac":
                    continue
                real_paths.append(os.path.join(real_audio_voices + r_voice, r_fname))
                real_labels.append(0)
                real_refs.append(cur_ref)

        fake_paths = []
        fake_labels = []
        fake_refs = []
        fake_audio_voices = base_dir + "gen/"
        for f_voice in os.listdir(fake_audio_voices):
            #얘는 real껄로 ref를
            cur_fname = os.listdir(real_audio_voices + f_voice)[0]
            #flac이 아니면(tras.txt라면) 다른 파일로 바꾸기
            if os.path.splitext(cur_fname)[1] != ".flac":
                cur_fname = os.listdir(real_audio_voices + f_voice)[1] #두번째로
            cur_ref = os.path.join(real_audio_voices + f_voice, cur_fname)

            for f_fname in os.listdir(fake_audio_voices + f_voice):
                if os.path.splitext(f_fname)[1] != ".flac":
                    continue
                fake_paths.append(os.path.join(fake_audio_voices + f_voice, f_fname))
                fake_labels.append(1)
                fake_refs.append(cur_ref)
        self.paths = real_paths + fake_paths
        self.labels = real_labels + fake_labels
        self.refs = real_refs + fake_refs


    def __len__(self):
        return len(self.paths)

    def __getitem__(self, index):
        X, x_sr = sf.read(self.paths[index])
        meta = 0
        if self.is_test:
            X_len_ori = X.shape[0]

            X_pad = pad_center(X, x_sr, self.cut)
            if X_len_ori >= X_pad.shape[0]: #cropped case
                mode = "crop"
            else: #padding case
                mode = "pad"
            
            meta = [X_len_ori, X_pad.shape[0], x_sr, self.cut]

            # ##temp recover
            # stt = (X_len_ori - X_pad.shape[0]) // 2
            # stt_sec = stt / x_sr
            # out_time = stt_sec + (self.cut // 2 / x_sr)
        else:
            X_pad = pad_random(X, self.cut)
        x_inp = Tensor(X_pad)

        Ref, ref_sr = sf.read(self.refs[index])
        if self.is_test:
            Ref_pad = pad_center(Ref, ref_sr, self.cut)
        else:
            Ref_pad = pad_random(Ref, self.cut)
        ref_inp = Tensor(Ref_pad)

        ###_---
        noise_factor = 0.005 
        x_inp = x_inp + noise_factor * torch.randn_like(x_inp)
        ref_inp = ref_inp + noise_factor * torch.randn_like(ref_inp)
        # sf.write("n_x.flac", x_inp, x_sr)
        # sf.write("n_ref.flac", ref_inp, ref_sr)
        #-----

        
        y = self.labels[index]
        return x_inp, y, ref_inp, meta

class Dataset_ASVspoof2019_train(Dataset):
    def __init__(self, list_IDs, labels, base_dir):
        """self.list_IDs	: list of strings (each string: utt key),
           self.labels      : dictionary (key: utt key, value: label integer)"""
        self.list_IDs = list_IDs
        self.labels = labels
        self.base_dir = base_dir
        self.cut = 64600  # take ~4 sec audio (64600 samples)

    def __len__(self):
        return len(self.list_IDs)

    def __getitem__(self, index):
        key = self.list_IDs[index]
        X, _ = sf.read(str(self.base_dir / f"flac/{key}.flac"))
        X_pad = pad_random(X, self.cut)
        x_inp = Tensor(X_pad)
        y = self.labels[key]
        return x_inp, y


class Dataset_ASVspoof2019_devNeval(Dataset):
    def __init__(self, list_IDs, base_dir):
        """self.list_IDs	: list of strings (each string: utt key),
        """
        self.list_IDs = list_IDs
        self.base_dir = base_dir
        self.cut = 64600  # take ~4 sec audio (64600 samples)

    def __len__(self):
        return len(self.list_IDs)

    def __getitem__(self, index):
        key = self.list_IDs[index]
        X, _ = sf.read(str(self.base_dir / f"flac/{key}.flac"))
        X_pad = pad(X, self.cut)
        x_inp = Tensor(X_pad)
        return x_inp, key
