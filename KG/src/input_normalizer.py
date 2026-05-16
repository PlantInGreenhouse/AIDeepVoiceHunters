# src/input_normalizer.py

from datetime import datetime
from typing import Dict, Any, List


def normalize_detection_output(raw_output: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert DeepVoice detection model output into the standard KG input format.

    Expected raw_output format:
    {
        "callId": "C001",
        "userId": "U001",
        "detectedSegments": [
            {
                "segmentId": "SEG_C001_001",
                "start": 8.2,
                "end": 12.6,
                "confidence": 0.88
            }
        ]
    }

    The detection model is expected to output only:
    1. confidence score
    2. detected call segment period: start, end
    """

    call_id = raw_output["callId"]
    user_id = raw_output["userId"]

    detected_segments: List[Dict[str, Any]] = raw_output["detectedSegments"]

    if not detected_segments:
        raise ValueError("detectedSegments must contain at least one segment.")

    # 1차 구현에서는 confidence가 가장 높은 구간을 대표 구간으로 사용한다.
    primary_segment = max(
        detected_segments,
        key=lambda segment: segment["confidence"]
    )

    segment_id = primary_segment.get("segmentId", f"SEG_{call_id}_001")
    segment_start = primary_segment["start"]
    segment_end = primary_segment["end"]
    confidence = primary_segment["confidence"]

    return {
        "callId": call_id,
        "userId": user_id,
        "confidence": confidence,
        "userVoice": {
            "nodeType": "UserVoice",
            "voiceId": f"UV_{user_id}",
            "label": "등록된 기준 음성",
            "description": "사용자가 사전에 등록한 기준 음성입니다.",
            "registeredAt": raw_output.get("registeredAt"),
            "audioRef": raw_output.get("userVoiceAudioRef")
        },

        "comparisonVoice": {
            "nodeType": "ComparisonVoice",
            "callId": call_id,
            "label": "현재 통화 음성",
            "description": "실시간 통화에서 입력된 비교 대상 음성입니다.",
            "recordedAt": raw_output.get("recordedAt", datetime.now().isoformat()),
            "audioRef": raw_output.get("comparisonVoiceAudioRef")
        },

        "callSegment": {
            "nodeType": "CallSegment",
            "segmentId": segment_id,
            "label": "딥보이스 의심 구간",
            "description": "딥보이스 탐지 모델에서 조작 가능성이 높게 탐지된 구간입니다.",
            "start": segment_start,
            "end": segment_end,
            "unit": "seconds",
            "confidence": confidence
        },

        "detectedPeriod": {
            "start": segment_start,
            "end": segment_end,
            "unit": "seconds"
        },

        "spoofType": {
            "label": "DeepVoice",
            "description": "딥보이스 또는 음성 합성/변환 기반 조작 가능성이 탐지되었습니다.",
            "candidates": [
                {
                    "type": "DeepVoice",
                    "confidence": confidence,
                    "description": "딥보이스 탐지 모델의 직접 출력입니다."
                }
            ]
        },

        # 전체 탐지 구간 보존.
        # 현재 kg_builder.py는 대표 구간만 사용하지만,
        # 나중에 multi-segment KG로 확장할 때 사용할 수 있다.
        "detectedSegments": detected_segments
    }