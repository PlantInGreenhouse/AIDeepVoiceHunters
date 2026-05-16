# src/kg_builder.py

from typing import Dict, List
from schemas import KGNode, KGEdge, KnowledgeGraph
from inference_rules import infer_risk_level, build_observed_issues, build_actions


def build_voice_kg(input_data: Dict) -> KnowledgeGraph:
    call_id = input_data["callId"]
    user_id = input_data["userId"]

    confidence = input_data["confidence"]

    call_segment = input_data["callSegment"]
    detected_period = input_data["detectedPeriod"]

    segment_start = call_segment["start"]
    segment_end = call_segment["end"]

    risk_level = infer_risk_level(confidence)

    observed_issues = build_observed_issues(
        confidence=confidence,
        segment_start=segment_start,
        segment_end=segment_end
    )

    actions = build_actions(risk_level)

    graph_id = f"KG_{call_id}"

    nodes: List[KGNode] = []
    edges: List[KGEdge] = []

    # -------------------------
    # Core Node IDs
    # -------------------------

    call_node_id = f"call:{call_id}"
    user_voice_node_id = input_data["userVoice"]["voiceId"]
    comparison_voice_node_id = f"comparisonVoice:{call_id}"
    segment_node_id = call_segment["segmentId"]
    detected_period_node_id = f"detectedPeriod:{call_id}"
    spoof_assessment_node_id = f"spoofAssessment:{call_id}"

    # -------------------------
    # Core Nodes
    # -------------------------

    nodes.append(KGNode(
        id=call_node_id,
        type="Call",
        properties={
            "callId": call_id,
            "userId": user_id,
            "level": risk_level,
            "confidence": confidence
        }
    ))

    nodes.append(KGNode(
        id=user_voice_node_id,
        type="UserVoice",
        properties=input_data["userVoice"]
    ))

    nodes.append(KGNode(
        id=comparison_voice_node_id,
        type="ComparisonVoice",
        properties=input_data["comparisonVoice"]
    ))

    nodes.append(KGNode(
        id=segment_node_id,
        type="CallSegment",
        properties=call_segment
    ))

    nodes.append(KGNode(
        id=detected_period_node_id,
        type="DetectedPeriod",
        properties=detected_period
    ))

    # summary는 여기서 만들지 않는다.
    # LLM summary 생성 후 main.py에서 SpoofAssessment 노드에 주입한다.
    nodes.append(KGNode(
        id=spoof_assessment_node_id,
        type="SpoofAssessment",
        properties={
            "level": risk_level,
            "confidence": confidence
        }
    ))

    # -------------------------
    # Spoof Type Nodes
    # -------------------------

    spoof_type = input_data.get("spoofType", {})

    if spoof_type:
        spoof_type_node_id = f"spoofType:{call_id}"

        nodes.append(KGNode(
            id=spoof_type_node_id,
            type="SpoofType",
            properties={
                "label": spoof_type.get("label"),
                "description": spoof_type.get("description")
            }
        ))

        edges.append(KGEdge(
            source=spoof_assessment_node_id,
            target=spoof_type_node_id,
            type="HAS_SPOOF_TYPE"
        ))

        for candidate in spoof_type.get("candidates", []):
            candidate_node_id = f"spoofCandidate:{call_id}:{candidate['type']}"

            nodes.append(KGNode(
                id=candidate_node_id,
                type="SpoofCandidate",
                properties=candidate
            ))

            edges.append(KGEdge(
                source=spoof_type_node_id,
                target=candidate_node_id,
                type="HAS_CANDIDATE",
                properties={
                    "confidence": candidate["confidence"]
                }
            ))

    # -------------------------
    # Observed Issue Nodes
    # -------------------------

    for idx, issue in enumerate(observed_issues, start=1):
        issue_node_id = f"observedIssue:{call_id}:{idx}"

        nodes.append(KGNode(
            id=issue_node_id,
            type="ObservedIssue",
            properties=issue
        ))

        edges.append(KGEdge(
            source=segment_node_id,
            target=issue_node_id,
            type="HAS_OBSERVED_ISSUE",
            properties={
                "evidenceType": issue["evidenceType"],
                "score": issue["score"],
                "severity": issue["severity"]
            }
        ))

        edges.append(KGEdge(
            source=issue_node_id,
            target=spoof_assessment_node_id,
            type="SUPPORTS_ASSESSMENT"
        ))

    # -------------------------
    # Action Nodes
    # -------------------------

    for idx, action in enumerate(actions, start=1):
        action_node_id = f"action:{call_id}:{idx}"

        nodes.append(KGNode(
            id=action_node_id,
            type="UserAction",
            properties=action
        ))

        edges.append(KGEdge(
            source=spoof_assessment_node_id,
            target=action_node_id,
            type="RECOMMENDS_ACTION",
            properties={
                "priority": action["priority"]
            }
        ))

    # -------------------------
    # Core Edges
    # -------------------------

    edges.extend([
        KGEdge(
            source=call_node_id,
            target=user_voice_node_id,
            type="HAS_REGISTERED_VOICE"
        ),
        KGEdge(
            source=call_node_id,
            target=comparison_voice_node_id,
            type="HAS_COMPARISON_VOICE"
        ),
        KGEdge(
            source=comparison_voice_node_id,
            target=segment_node_id,
            type="HAS_SEGMENT"
        ),
        KGEdge(
            source=segment_node_id,
            target=detected_period_node_id,
            type="HAS_DETECTED_PERIOD"
        ),
        KGEdge(
            source=segment_node_id,
            target=spoof_assessment_node_id,
            type="INDICATES_DEEPVOICE",
            properties={
                "confidence": confidence
            }
        )
    ])

    return KnowledgeGraph(
        graphId=graph_id,
        nodes=nodes,
        edges=edges
    )