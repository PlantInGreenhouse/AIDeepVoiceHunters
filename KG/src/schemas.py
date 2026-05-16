# src/schemas.py

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class KGNode:
    id: str
    type: str
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class KGEdge:
    source: str
    target: str
    type: str
    properties: Dict[str, Any] = field(default_factory=dict)


@dataclass
class KnowledgeGraph:
    graphId: str
    nodes: List[KGNode]
    edges: List[KGEdge]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "graphId": self.graphId,
            "nodes": [
                {
                    "id": node.id,
                    "type": node.type,
                    "properties": node.properties
                }
                for node in self.nodes
            ],
            "edges": [
                {
                    "source": edge.source,
                    "target": edge.target,
                    "type": edge.type,
                    "properties": edge.properties
                }
                for edge in self.edges
            ]
        }