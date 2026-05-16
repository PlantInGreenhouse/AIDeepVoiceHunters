# src/detection_output_adapter.py

"""
Example usage:

from detection_output_adapter import create_detection_output_json

confidence = 0.88
point = 8.2

create_detection_output_json(
    confidence=confidence,
    point=point,
)
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import INPUT_PATH, DEFAULT_CALL_ID, DEFAULT_USER_ID


def build_detection_output(
    confidence: float,
    point: float,
    segment_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Convert DeepVoice detection model output into detection_output.json format.

    Detection model output:
    - confidence
    - callSegment point

    callId and userId are loaded from config.py.
    """

    if not 0.0 <= confidence <= 1.0:
        raise ValueError(f"confidence must be between 0 and 1. Got: {confidence}")

    if point < 0:
        raise ValueError(f"point must be greater than or equal to 0. Got: {point}")

    if segment_id is None:
        segment_id = f"SEG_{DEFAULT_CALL_ID}_001"

    return {
        "callId": DEFAULT_CALL_ID,
        "userId": DEFAULT_USER_ID,
        "detectedSegments": [
            {
                "segmentId": segment_id,
                "point": point,
                "confidence": confidence,
            }
        ],
    }


def save_detection_output(
    detection_output: Dict[str, Any],
    output_path: str = INPUT_PATH,
) -> None:
    """
    Save detection output to data/raw/detection_output.json.
    """

    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(detection_output, f, ensure_ascii=False, indent=2)


def create_detection_output_json(
    confidence: float,
    point: float,
    output_path: str = INPUT_PATH,
) -> Dict[str, Any]:
    """
    Main function used after running the detection model.

    The detection model only needs to provide:
    - confidence
    - point
    """

    detection_output = build_detection_output(
        confidence=confidence,
        point=point,
    )

    save_detection_output(
        detection_output=detection_output,
        output_path=output_path,
    )

    return detection_output


def create_detection_output_json_from_model_output(
    model_output: List[float],
    output_path: str = INPUT_PATH,
) -> Dict[str, Any]:
    """
    Use this when the detection model returns a list.

    Expected model_output:
    [
        0.88,  # confidence
        8.2    # point
    ]

    model_output[0] -> confidence
    model_output[1] -> point
    """

    if not isinstance(model_output, list):
        raise TypeError(f"model_output must be a list. Got: {type(model_output)}")

    if len(model_output) < 2:
        raise ValueError(
            "model_output must contain at least two values: [confidence, point]"
        )

    confidence = float(model_output[0])
    point = float(model_output[1])

    return create_detection_output_json(
        confidence=confidence,
        point=point,
        output_path=output_path,
    )


if __name__ == "__main__":
    # Example 1: 직접 confidence, point 전달
    output = create_detection_output_json(
        confidence=0.88,
        point=8.2,
    )

    print(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"Detection output saved to {INPUT_PATH}")

    # Example 2: 모델 output 리스트에서 생성
    model_output = [0.88, 8.2]

    output_from_list = create_detection_output_json_from_model_output(
        model_output=model_output
    )

    print(json.dumps(output_from_list, ensure_ascii=False, indent=2))