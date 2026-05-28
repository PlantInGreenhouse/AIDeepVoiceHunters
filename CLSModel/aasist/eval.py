"""
Main script that trains, validates, and evaluates
various models including AASIST.

AASIST
Copyright (c) 2021-present NAVER Corp.
MIT license
"""
import argparse
import json
import os
import sys
import warnings
from importlib import import_module
from typing import Dict, List, Union

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from data_utils import Dataset_Deepvoice
from utils import set_seed, str_to_bool
from tqdm import tqdm #
warnings.filterwarnings("ignore", category=FutureWarning)


def main(args: argparse.Namespace) -> None:
    """
    Main function.
    """
    # load experiment configurations
    with open(args.config, "r") as f_json:
        config = json.loads(f_json.read())
    model_config = config["model_config"]

    # make experiment reproducible
    set_seed(args.seed, config)

    # set device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("Device: {}".format(device))
    if device == "cpu":
        raise ValueError("GPU not detected!")

    # define model architecture
    model = get_model(model_config, device)

    ##Load pretrained weights
    model.add_new_modules() 

    checkpoint = torch.load("./results/train_aasist_pass/ckpt_2.pth", map_location='cpu')
    model.load_state_dict(checkpoint["model_state_dict"])

    model.to(device) 

    dataset = Dataset_Deepvoice("../data/test_data_01/", is_test=True)
    test_loader = DataLoader(
        dataset, 
        batch_size=1, 
        shuffle=False,   
        drop_last=False    
    )
    
    ##Evaluation
    all_preds = []
    all_labels = []

    model.eval()
    with torch.no_grad():
        for batch_x, batch_y, batch_ref, meta in tqdm(test_loader): 
            batch_x = batch_x.to(device)
            batch_ref = batch_ref.to(device)
            batch_y = batch_y.view(-1).type(torch.int64).to(device) #B

            _, batch_out, t_attn_score = model(batch_x, batch_ref, time_attention = True) #B x 2
            # t_attn_score : B 1 self.cut
            preds = torch.argmax(batch_out, dim=1)
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(batch_y.cpu().numpy())

    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
    accuracy = accuracy_score(all_labels, all_preds)
    precision = precision_score(all_labels, all_preds, zero_division=0)
    recall = recall_score(all_labels, all_preds, zero_division=0)
    f1 = f1_score(all_labels, all_preds, zero_division=0)

    # 5. 결과 출력
    print(f"Accuracy  : {accuracy:.4f}")
    print(f"Precision : {precision:.4f}")
    print(f"Recall    : {recall:.4f}")
    print(f"F1 Score  : {f1:.4f}")


def get_model(model_config: Dict, device: torch.device):
    """Define DNN model architecture"""
    module = import_module("models.{}".format(model_config["architecture"]))
    _model = getattr(module, "Model")
    model = _model(model_config).to(device)
    nb_params = sum([param.view(-1).size()[0] for param in model.parameters()])
    print("no. model params:{}".format(nb_params))

    return model

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ASVspoof detection system")
    parser.add_argument("--config",
                        dest="config",
                        type=str,
                        help="configuration file",
                        required=True)
    parser.add_argument(
        "--output_dir",
        dest="output_dir",
        type=str,
        help="output directory for results",
        default="./exp_result",
    )
    parser.add_argument("--seed",
                        type=int,
                        default=1234,
                        help="random seed (default: 1234)")
    parser.add_argument(
        "--eval",
        action="store_true",
        help="when this flag is given, evaluates given model and exit")
    parser.add_argument("--comment",
                        type=str,
                        default=None,
                        help="comment to describe the saved model")
    parser.add_argument("--eval_model_weights",
                        type=str,
                        default=None,
                        help="directory to the model weight file (can be also given in the config file)")
    main(parser.parse_args())
