# inference_rules.py: spoofProbabiity 기반 위험도, observedIssues, action 생성


# src/inference_rules.py

from typing import Dict, List


def infer_risk_level(spoof_probability: float) -> str:
    if spoof_probability >= 0.7:
        return "danger"
    elif spoof_probability >= 0.3:
        return "warning"
    return "safe"


def build_observed_issues(
    similarity: float,
    spoof_probability: float,
    segment_start: float,
    segment_end: float
) -> List[Dict]:
    issues = []

    if similarity < 0.4:
        issues.append({
            "issue": "등록 음성과 현재 음성의 화자 유사도 낮음",
            "evidenceType": "speaker_similarity",
            "score": similarity,
            "severity": "high",
            "description": "등록된 기준 음성과 현재 통화 음성의 화자 특성이 충분히 일치하지 않습니다."
        })

    if spoof_probability >= 0.7:
        issues.append({
            "issue": "짧은 구간에서 합성음 의심 특징 검출",
            "evidenceType": "localized_spoof_signal",
            "score": spoof_probability,
            "severity": "high",
            "description": f"{segment_start}초부터 {segment_end}초 구간에서 조작 음성 확률이 높게 나타났습니다."
        })

    if spoof_probability >= 0.5:
        issues.append({
            "issue": "음성 조작 가능성 탐지",
            "evidenceType": "spoof_probability",
            "score": spoof_probability,
            "severity": "medium",
            "description": "전체 통화 음성에서 조작 가능성을 시사하는 특징이 관측되었습니다."
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
                "title": "대화 내용 캡처 및 신고 준비하기",
                "detail": "의심스러운 요청이 있었다면 통화 시간, 번호, 요구 내용을 기록해두세요.",
                "priority": "medium"
            }
        ]

    if risk_level == "warning":
        return [
            {
                "title": "추가 확인하기",
                "detail": "상대방의 신원을 다른 연락 수단으로 확인하세요.",
                "priority": "medium"
            }
        ]

    return [
        {
            "title": "통화 계속 가능",
            "detail": "현재 탐지 결과만으로는 조작 음성 가능성이 낮습니다.",
            "priority": "low"
        }
    ]