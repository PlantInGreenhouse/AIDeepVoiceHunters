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
    optim_config = config["optim_config"]
    optim_config["epochs"] = config["num_epochs"]

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
    model.load_state_dict(
            torch.load(config["model_path"], map_location=device))
    model.add_new_modules()
    model.to(device)
    dataset = Dataset_Deepvoice("../data/train_data_01/")
    
    from torch.utils.data import random_split, DataLoader

    dataset_size = len(dataset)
    train_size = int(dataset_size * 0.8)
    val_size = dataset_size - train_size 
    print(f"Total: {dataset_size} | Train: {train_size} | Val: {val_size}")
    generator = torch.Generator().manual_seed(args.seed)

    # 3. random_split으로 데이터셋 분할
    train_dataset, val_dataset = random_split(
        dataset, 
        [train_size, val_size], 
        generator=generator
    )

    train_loader = DataLoader(
        train_dataset, 
        batch_size=config["batch_size"], 
        shuffle=True,   
        num_workers=4,   
        drop_last=True    
    )

    val_loader = DataLoader(
        val_dataset, 
        batch_size=config["batch_size"], 
        shuffle=False,  
        num_workers=4
    )

    optimizer = torch.optim.Adam(model.parameters(),
                                     lr=optim_config['base_lr'],
                                     betas=optim_config['betas'],
                                     weight_decay=optim_config['weight_decay'],
                                     amsgrad=str_to_bool(
                                         optim_config['amsgrad']))

    save_dir = f'./results/e={config["num_epochs"]}_b={config["batch_size"]}_lr={optim_config["base_lr"]}/'
    os.makedirs(save_dir, exist_ok=True)

    import wandb
    run = wandb.init(entity="jiwoo3853", project = "aihack", config = config) 
        

    # Training
    for epoch in range(config["num_epochs"]):
        print("Start training epoch{:03d}".format(epoch))
        running_loss = train_epoch(train_loader, model, optimizer, device)
        val_loss = val_epoch(val_loader, model, device)
        print(f"train loss: {running_loss}, val loss: {val_loss}")
        run.log({"train Loss":running_loss, "val loss": val_loss})

        #model save
        dir = save_dir + f'ckpt_{epoch}.pth'

        torch.save({ # Save our checkpoint loc
        'model_state_dict': model.state_dict(),
        }, dir)
    print("end")

def get_model(model_config: Dict, device: torch.device):
    """Define DNN model architecture"""
    module = import_module("models.{}".format(model_config["architecture"]))
    _model = getattr(module, "Model")
    model = _model(model_config).to(device)
    nb_params = sum([param.view(-1).size()[0] for param in model.parameters()])
    print("no. model params:{}".format(nb_params))

    return model

def train_epoch(
    trn_loader: DataLoader,
    model,
    optim: Union[torch.optim.SGD, torch.optim.Adam],
    device: torch.device):
    """Train the model for one epoch"""
    model.train()

    # set objective (Loss) functions
    weight = torch.FloatTensor([0.1, 0.9]).to(device)
    criterion = nn.CrossEntropyLoss(weight=weight)

    running_loss = 0.
    for batch_x, batch_y, batch_ref in tqdm(trn_loader):
        batch_x = batch_x.to(device)
        batch_ref = batch_ref.to(device)
        batch_y = batch_y.view(-1).type(torch.int64).to(device) #B

        _, batch_out = model(batch_x, batch_ref, time_attention = True) #B x 2

        batch_loss = criterion(batch_out, batch_y)
        running_loss += batch_loss.item() 
        optim.zero_grad()
        batch_loss.backward()
        optim.step()

    running_loss /= len(trn_loader)
    return running_loss

def val_epoch(
    val_loader: DataLoader,
    model,
    device: torch.device):
    model.eval()

    # set objective (Loss) functions
    weight = torch.FloatTensor([0.1, 0.9]).to(device)
    criterion = nn.CrossEntropyLoss(weight=weight)

    running_loss = 0.
    with torch.no_grad():
        for batch_x, batch_y, batch_ref in tqdm(val_loader): 
            batch_x = batch_x.to(device)
            batch_ref = batch_ref.to(device)
            batch_y = batch_y.view(-1).type(torch.int64).to(device) #B

            _, batch_out = model(batch_x, batch_ref, time_attention = True) #B x 2

            batch_loss = criterion(batch_out, batch_y)
            running_loss += batch_loss.item() 
    running_loss /= len(val_loader)
    return running_loss


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
