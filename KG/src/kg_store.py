# src/kg_store.py

import json
from pathlib import Path
from typing import Dict
from schemas import KnowledgeGraph


def save_kg(graph: KnowledgeGraph, output_path: str) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(graph.to_dict(), f, ensure_ascii=False, indent=2)


def load_json(input_path: str) -> Dict:
    with open(input_path, "r", encoding="utf-8") as f:
        return json.load(f)
