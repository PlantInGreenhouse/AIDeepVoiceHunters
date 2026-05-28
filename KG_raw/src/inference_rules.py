# src/inference_rules.py

from typing import Dict, List


def infer_risk_level(confidence: float) -> str:
    """
    Infer risk level from DeepVoice detection confidence.

    confidence:
    - 0.7 이상: danger
    - 0.5 이상: warning
    - 그 미만: safe
    """

    if confidence >= 0.7:
        return "danger"
    elif confidence >= 0.5:
        return "warning"
    return "safe"


def build_observed_issues(
    confidence: float,
    segment_point: float,
) -> List[Dict]:
    """
    Build observed issues using only model confidence and detected segment period.

    The model output does not include:
    - spoofProbability
    - similarity

    Therefore, issues must not mention speaker similarity or spoof probability.
    """

    issues = []

    if confidence >= 0.7:
        issues.append({
            "issue": "딥보이스 의심 구간 탐지",
            "evidenceType": "deepvoice_detection_confidence",
            "score": confidence,
            "severity": "high",
            "description": (
                f"{segment_point}부근에서 딥보이스 조작 가능성이 높은 신호가 탐지되었습니다."
            )
        })

    elif confidence >= 0.5:
        issues.append({
            "issue": "딥보이스 의심 가능성 탐지",
            "evidenceType": "deepvoice_detection_confidence",
            "score": confidence,
            "severity": "medium",
            "description": (
                f"{segment_point}부근에서 딥보이스 의심 신호가 탐지되었습니다."
            )
        })

    else:
        issues.append({
            "issue": "딥보이스 탐지 신뢰도 낮음",
            "evidenceType": "deepvoice_detection_confidence",
            "score": confidence,
            "severity": "low",
            "description": (
                "딥보이스로 판단할 만큼의 신뢰도는 낮습니다."
            )
        })

    return issues


def build_actions(risk_level: str) -> List[Dict]:
    if risk_level == "danger":
        return [
            {
                "title": "저장된 번호로 직접 재확인하기",
                "detail": "현재 통화를 끊고 기존에 저장된 가족 번호로 다시 연락하세요.",
                "priority": "high"
            },
            {
                "title": "송금 및 인증번호 전달 중단하기",
                "detail": "상대방이 금전, 계좌, 인증번호, 개인정보를 요구했다면 즉시 중단하세요.",
                "priority": "high"
            },
            {
                "title": "경찰 및 금융기관 신고하기",
                "detail": "딥보이스 사기 피해가 의심됩니다. 가까운 경찰서나 금융기관에 신고하여 추가 피해를 방지하세요.",
                "priority": "high"
            }
        ]

    if risk_level == "warning":
        return [
            {
                "title": "추가 확인하기",
                "detail": "상대방의 신원을 다른 연락 수단으로 확인하세요.",
                "priority": "medium"
            },
            {
                "title": "개인정보 제공 주의",
                "detail": "금전, 계좌, 인증번호, 개인정보를 요구하는 경우 즉시 중단하고 상대방의 신원을 확인하세요.",
                "priority": "medium"
            },
            {
                "title": "통화내용 신뢰하지 않기",
                "detail": "현재 탐지된 구간에서 딥보이스 의심 신호가 탐지되었습니다. 통화 내용에 대한 신뢰도를 낮추고, 중요한 정보 제공을 자제하세요.",
                "priority": "medium"
            }
        ]

    return [
        {
            "title": "통화 계속 가능",
            "detail": "현재 탐지 결과만으로는 조작 음성 가능성이 낮습니다.",
            "priority": "low"
        },
        {
                "title": "추가 조치 필요 없음",
                "detail": "탐지된 구간에서 딥보이스 의심 신호가 낮게 탐지되었습니다. 현재로서는 추가 조치가 필요하지 않습니다.",
                "priority": "low"
        }
    ]