# src/input_normalizer.py

from datetime import datetime
from typing import Dict, Any, List


def normalize_detection_output(raw_output: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert deepvoice detection model output into the standard KG input format.

    Expected raw_output format:
    {
        "callId": "C001",
        "userId": "U001",
        "detectedSegments": [
            {
                "segmentId": "SEG_C001_001",
                "start": 8.2,
                "end": 12.6,
                "confidence": 0.88,
                "spoofProbability": 0.84
            }
        ]
    }
    """

    call_id = raw_output["callId"]
    user_id = raw_output.get("userId", "UNKNOWN_USER")

    detected_segments: List[Dict[str, Any]] = raw_output["detectedSegments"]

    if not detected_segments:
        raise ValueError("detectedSegments must contain at least one segment.")

    # 현재 kg_builder.py가 단일 callSegment 기준이라면
    # 1차 구현에서는 가장 spoofProbability가 높은 구간을 대표 구간으로 사용한다.
    primary_segment = max(
        detected_segments,
        key=lambda segment: segment["spoofProbability"]
    )

    segment_id = primary_segment.get("segmentId", f"SEG_{call_id}_001")
    segment_start = primary_segment["start"]
    segment_end = primary_segment["end"]
    spoof_probability = primary_segment["spoofProbability"]
    confidence = primary_segment.get("confidence", spoof_probability)

    return {
        "callId": call_id,
        "userId": user_id,

        "spoofProbability": spoof_probability,
        "confidence": confidence,

        # similarity는 아직 탐지 모델 출력에 없으므로 기본값을 둔다.
        # 나중에 speaker verification 모델을 붙이면 여기서 실제 값으로 교체하면 된다.
        "similarity": raw_output.get("similarity", 0.27),

        "summary": "현재 통화에서 딥보이스 의심 구간이 탐지되었습니다.",

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
            "confidence": confidence,
            "spoofProbability": spoof_probability
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
                    "probability": spoof_probability,
                    "description": "딥보이스 탐지 모델의 직접 출력입니다."
                }
            ]
        },

        # 전체 탐지 구간도 보존한다.
        # 현재 kg_builder.py가 단일 segment만 처리하더라도
        # 나중에 multi-segment KG로 확장할 때 이 필드를 사용할 수 있다.
        "detectedSegments": detected_segments
    }