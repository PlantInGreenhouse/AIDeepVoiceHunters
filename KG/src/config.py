# src/config.py

INPUT_PATH = "data/raw/detection_output.json"
OUTPUT_DIR = "data/graph"

DEFAULT_CALL_ID = "C001"

RISK_THRESHOLDS = {
    "safe": 0.3,
    "warning": 0.7,
    "danger": 1.0,
}