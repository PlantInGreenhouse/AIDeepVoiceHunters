# src/run_pipeline.py
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent


# project/aasist/
AASIST_ROOT = PROJECT_ROOT / "aasist"
# KG/
KG_ROOT = PROJECT_ROOT / "KG"
# /KG/src/
KG_SRC_DIR = KG_ROOT / "src"
# KG/src 내부 모듈을 import할 수 있도록 경로 추가
sys.path.append(str(KG_SRC_DIR))
sys.path.append(str(AASIST_ROOT))

# from model import run_deepvoice_model
from detection_output_adapter import create_detection_output_json_from_model_output
from main import main as build_kg_main


def run_pipeline():
    """
    Full pipeline:
    1. Run DeepVoice detection model
    2. Receive model output as list: [confidence, point]
    3. Create data/raw/detection_output.json
    4. Run KG generation pipeline
    5. Create data/graph/{call_id}_graph.json
    """

    # 1. 모델 실행
    model_output = run_deepvoice_model()

    create_detection_output_json_from_model_output(
        model_output=model_output
    )

    # 3. 기존 KG 생성 코드 실행
    build_kg_main()


if __name__ == "__main__":
    run_pipeline()