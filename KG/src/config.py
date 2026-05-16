# KG/src/config.py

from pathlib import Path

# project/KG/src/config.py
SRC_DIR = Path(__file__).resolve().parent

# project/KG
KG_ROOT = SRC_DIR.parent

INPUT_PATH = str(KG_ROOT / "data" / "raw" / "detection_output.json")
OUTPUT_DIR = str(KG_ROOT / "data" / "graph")

DEFAULT_CALL_ID = "C001"
DEFAULT_USER_ID = "U001"

RISK_THRESHOLDS = {
    "safe": 0.3,
    "warning": 0.7,
    "danger": 1.0,
}