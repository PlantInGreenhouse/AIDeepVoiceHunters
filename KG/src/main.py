# src/main.py

from kg_store import load_json, save_kg
from input_normalizer import normalize_detection_output
from kg_builder import build_voice_kg
from config import INPUT_PATH, OUTPUT_DIR
from summary_generator import generate_summary_from_graph


def inject_summary_to_graph(graph, summary: str) -> None:
    for node in graph.nodes:
        if node.type == "SpoofAssessment":
            node.properties["summary"] = summary
            return

    raise ValueError("SpoofAssessment node not found.")


def main():
    raw_detection_output = load_json(INPUT_PATH)
    call_id = raw_detection_output["callId"]
    output_path = f"{OUTPUT_DIR}/{call_id}_graph.json"

    kg_input = normalize_detection_output(raw_detection_output)

    graph = build_voice_kg(kg_input)

    summary = generate_summary_from_graph(graph.to_dict())
    inject_summary_to_graph(graph, summary)

    save_kg(graph, output_path)

    print(f"Knowledge graph saved to {output_path}")
    print(f"Number of nodes: {len(graph.nodes)}")
    print(f"Number of edges: {len(graph.edges)}")


if __name__ == "__main__":
    main()