# src/summary_generator.py

from typing import Dict, List, Any
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM


MODEL_NAME = "kakaocorp/kanana-1.5-2.1b-instruct-2505"

_tokenizer = None
_model = None


def load_summary_model():
    """
    Load Gemma 3 1B IT model once and reuse it.

    Notes:
    - MPS is used on Apple Silicon if available.
    - CUDA is used if available.
    - Otherwise, CPU is used.
    """

    global _tokenizer, _model

    if _tokenizer is not None and _model is not None:
        return _tokenizer, _model

    if torch.cuda.is_available():
        device = "cuda"
        dtype = torch.bfloat16
    elif torch.backends.mps.is_available():
        device = "mps"
        dtype = torch.float16
    else:
        device = "cpu"
        dtype = torch.float32

    _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    _model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        torch_dtype=dtype,
        device_map=None,
    )

    _model.to(device)
    _model.eval()

    return _tokenizer, _model


def get_node_by_type(graph_dict: Dict[str, Any], node_type: str) -> Dict[str, Any]:
    for node in graph_dict["nodes"]:
        if node["type"] == node_type:
            return node

    raise ValueError(f"{node_type} node not found.")


def get_nodes_by_type(graph_dict: Dict[str, Any], node_type: str) -> List[Dict[str, Any]]:
    return [
        node
        for node in graph_dict["nodes"]
        if node["type"] == node_type
    ]


def extract_summary_context_from_graph(graph_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract only summary-relevant information from the completed KG.

    Do not pass the entire graph JSON to the LLM.
    Gemma 1B may not reliably interpret large JSON structures.
    """

    call_node = get_node_by_type(graph_dict, "Call")
    segment_node = get_node_by_type(graph_dict, "CallSegment")
    assessment_node = get_node_by_type(graph_dict, "SpoofAssessment")
    spoof_type_node = get_node_by_type(graph_dict, "SpoofType")

    observed_issue_nodes = get_nodes_by_type(graph_dict, "ObservedIssue")
    action_nodes = get_nodes_by_type(graph_dict, "UserAction")

    call_props = call_node["properties"]
    segment_props = segment_node["properties"]
    assessment_props = assessment_node["properties"]
    spoof_type_props = spoof_type_node["properties"]

    observed_issues = [
        {
            "issue": node["properties"].get("issue"),
            "evidenceType": node["properties"].get("evidenceType"),
            "score": node["properties"].get("score"),
            "severity": node["properties"].get("severity"),
            "description": node["properties"].get("description"),
        }
        for node in observed_issue_nodes
    ]

    actions = [
        {
            "title": node["properties"].get("title"),
            "priority": node["properties"].get("priority"),
        }
        for node in action_nodes
    ]

    return {
        "graphId": graph_dict["graphId"],
        "callId": call_props["callId"],
        "userId": call_props["userId"],
        "level": assessment_props["level"],
        "confidence": assessment_props["confidence"],
        "spoofType": spoof_type_props["label"],
        "segment": {
            "start": segment_props["start"],
            "end": segment_props["end"],
            "unit": segment_props.get("unit", "seconds"),
        },
        "observedIssues": observed_issues,
        "actions": actions,
    }


def build_summary_prompt_from_graph(graph_dict: Dict[str, Any]) -> str:
    context = extract_summary_context_from_graph(graph_dict)

    call_id = context["callId"]
    level = context["level"]
    confidence = context["confidence"]
    spoof_type = context["spoofType"]

    segment = context["segment"]
    start = segment["start"]
    end = segment["end"]
    unit = segment.get("unit", "seconds")

    observed_issues = context["observedIssues"]
    actions = context["actions"]

    issue_lines = "\n".join(
        [
            f"- {issue['issue']} | severity: {issue['severity']} | score: {issue['score']} | 근거: {issue['description']}"
            for issue in observed_issues
        ]
    )

    action_lines = "\n".join(
        [
            f"- {action['title']} | priority: {action['priority']}"
            for action in actions
        ]
    )

    return f"""
너는 딥보이스 탐지 결과를 사용자에게 요약 및 설명하는 보안 알림 생성기다.

아래 지식그래프에서 추출한 정보만 근거로 사용자가 이해하기 쉬운 한국어 요약 문장을 생성하라.

조건:
- 출력 문장만 작성할 것
- 입력에 없는 정보는 절대 생성하지 말 것
- 가족 관계, 화자 유사도, 송금 요구, 공격자 의도는 추측하지 말 것
- 등록된 기준 음성과 현재 음성을 직접 비교했다고 말하지 말 것
- 딥보이스라고 확정하지 말고 "의심", "가능성", "탐지됨" 같은 표현을 사용할 것
- 과장하지 말 것
- 사용자의 다음 행동까지 길게 설명하지 말고, 탐지 결과 중심으로 요약할 것

탐지 결과:
- callId: {call_id}
- 탐지 유형: {spoof_type}
- 위험도: {level}
- 탐지 확신도: {confidence}
- 탐지 구간: {start}{unit} ~ {end}{unit}

관측 근거:
{issue_lines}

권장 행동 후보:
{action_lines}

출력:
""".strip()


def postprocess_summary(text: str) -> str:
    """
    Clean model output.

    Gemma may include prompt-like text or multiple lines.
    This function keeps the first meaningful sentence.
    """

    text = text.strip()

    if "출력:" in text:
        text = text.split("출력:")[-1].strip()

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return ""

    summary = lines[0]

    if len(summary) > 120:
        summary = summary[:120].rstrip()

    return summary


def fallback_summary_from_graph(graph_dict: Dict[str, Any]) -> str:
    context = extract_summary_context_from_graph(graph_dict)

    confidence = context["confidence"]
    start = context["segment"]["start"]
    end = context["segment"]["end"]

    if confidence >= 0.7:
        return f"{start}초부터 {end}초 구간에서 딥보이스 의심 신호가 높은 신뢰도로 탐지되었습니다."
    elif confidence >= 0.5:
        return f"{start}초부터 {end}초 구간에서 딥보이스 의심 가능성이 탐지되었습니다."
    return f"{start}초부터 {end}초 구간에서 탐지는 수행되었지만 딥보이스 가능성은 낮게 판단되었습니다."


def generate_summary_from_graph(graph_dict: Dict[str, Any]) -> str:
    """
    Generate SpoofAssessment summary using the completed KG.

    Input:
        graph_dict:
        {
            "graphId": "KG_C001",
            "nodes": [...],
            "edges": [...]
        }

    Output:
        A single Korean summary sentence.
    """

    prompt = build_summary_prompt_from_graph(graph_dict)

    tokenizer, model = load_summary_model()
    device = next(model.parameters()).device

    messages = [
        {
            "role": "user",
            "content": prompt,
        }
    ]

    try:
        formatted_prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
    except Exception:
        formatted_prompt = prompt

    inputs = tokenizer(
        formatted_prompt,
        return_tensors="pt",
    ).to(device)

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=100,
            do_sample=False,
            repetition_penalty=1.05,
            pad_token_id=tokenizer.eos_token_id,
            eos_token_id=tokenizer.eos_token_id,
        )

    generated_ids = output_ids[0][inputs["input_ids"].shape[-1]:]
    generated_text = tokenizer.decode(
        generated_ids,
        skip_special_tokens=True,
    )

    summary = postprocess_summary(generated_text)

    if not summary:
        return fallback_summary_from_graph(graph_dict)

    return summary