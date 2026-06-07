from __future__ import annotations

from collections import defaultdict

from .domain import GraphEdge, GraphNode, RuleSetSnapshot


def _normalise(text: str) -> str:
    return " ".join("".join(ch.lower() if ch.isalnum() else " " for ch in (text or "")).split())


def _tokens(text: str) -> set[str]:
    return {token for token in _normalise(text).split(" ") if len(token) > 2}


def _similarity(left: str, right: str) -> float:
    a = _tokens(left)
    b = _tokens(right)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _condition_signature(rule) -> tuple:
    return tuple(sorted((condition.field, condition.operator, str(condition.value)) for condition in rule.conditions))


def _conditions_overlap(left, right) -> bool:
    left_by_field = {condition.field: condition for condition in left.conditions}
    right_by_field = {condition.field: condition for condition in right.conditions}
    shared = set(left_by_field) & set(right_by_field)
    if not shared:
        return False
    for field in shared:
        a = left_by_field[field].value
        b = right_by_field[field].value
        left_values = a if isinstance(a, list) else [a]
        right_values = b if isinstance(b, list) else [b]
        if not set(map(str, left_values)) & set(map(str, right_values)):
            return False
    return True


def _is_opposing(left: str, right: str) -> bool:
    left_norm = _normalise(left)
    right_norm = _normalise(right)
    return (
        ("must not" in left_norm and "must" in right_norm)
        or ("must" in left_norm and "must not" in right_norm)
        or ("open market" in left_norm and "arrangement" in right_norm)
        or ("arrangement" in left_norm and "open market" in right_norm)
    )


class RulesGraphService:
    def build(self, snapshot: RuleSetSnapshot) -> dict:
        nodes: list[GraphNode] = []
        edges: list[GraphEdge] = []
        node_ids: set[str] = set()
        edge_ids: set[str] = set()
        signal_labels = {
            signal.get("field"): {str(value): str(value).replace("_", " ").title() for value in signal.get("values", [])}
            for signal in snapshot.taxonomy.get("signals", [])
        }

        def add_node(node: GraphNode):
            if node.node_id in node_ids:
                return
            node_ids.add(node.node_id)
            nodes.append(node)

        def add_edge(edge: GraphEdge):
            if edge.edge_id in edge_ids:
                return
            edge_ids.add(edge.edge_id)
            edges.append(edge)

        for source in snapshot.sources:
            add_node(GraphNode(
                node_id=f"source:{source['source_id']}",
                node_type="source",
                label=source["source_name"],
                metadata=source,
            ))

        objective_labels = {item["objective_id"]: item["label"] for item in snapshot.taxonomy.get("objectives", [])}
        for rule in snapshot.rules:
            add_node(GraphNode(
                node_id=rule.rule_id,
                node_type="rule",
                label=rule.title,
                metadata={
                    "rule_type": rule.rule_type,
                    "active": rule.active,
                    "source_name": rule.source_name,
                },
            ))
            add_edge(GraphEdge(
                edge_id=f"edge:{rule.source_id}:{rule.rule_id}",
                source=f"source:{rule.source_id}",
                target=rule.rule_id,
                relation="contains_rule",
            ))
            for objective in rule.objectives:
                objective_node_id = f"objective:{objective}"
                add_node(GraphNode(
                        node_id=objective_node_id,
                        node_type="objective",
                        label=objective_labels.get(objective, objective.replace("_", " ").title()),
                    ))
                add_edge(GraphEdge(
                    edge_id=f"edge:{rule.rule_id}:{objective}",
                    source=rule.rule_id,
                    target=objective_node_id,
                    relation="supports_objective",
                ))
            for condition in rule.conditions:
                values = condition.value if isinstance(condition.value, list) else [condition.value]
                for value in values:
                    value_key = str(value)
                    signal_node_id = f"signal:{condition.field}:{value_key}"
                    add_node(GraphNode(
                        node_id=signal_node_id,
                        node_type="signal",
                        label=signal_labels.get(condition.field, {}).get(value_key, value_key.replace("_", " ").title()),
                        metadata={
                            "field": condition.field,
                            "value": value_key,
                            "operator": condition.operator,
                        },
                    ))
                    add_edge(GraphEdge(
                        edge_id=f"edge:{signal_node_id}:{rule.rule_id}",
                        source=signal_node_id,
                        target=rule.rule_id,
                        relation="triggers_rule",
                        metadata={"field": condition.field, "operator": condition.operator},
                    ))

        rules_by_source: dict[str, list] = defaultdict(list)
        for rule in snapshot.rules:
            rules_by_source[rule.source_id].append(rule)

        for source_id, source_rules in rules_by_source.items():
            if len(source_rules) < 2:
                continue
            ordered = sorted(source_rules, key=lambda item: item.rule_id)
            for index, left in enumerate(ordered):
                for right in ordered[index + 1:]:
                    add_edge(GraphEdge(
                        edge_id=f"edge:source-peer:{left.rule_id}:{right.rule_id}",
                        source=left.rule_id,
                        target=right.rule_id,
                        relation="shares_source",
                        metadata={"source_id": source_id},
                    ))

        ordered_rules = sorted(snapshot.rules, key=lambda item: item.rule_id)
        for index, left in enumerate(ordered_rules):
            for right in ordered_rules[index + 1:]:
                same_signature = _condition_signature(left) == _condition_signature(right)
                semantic_similarity = max(_similarity(left.title, right.title), _similarity(left.summary, right.summary))
                if same_signature and semantic_similarity > 0.35:
                    add_edge(GraphEdge(
                        edge_id=f"edge:similar:{left.rule_id}:{right.rule_id}",
                        source=left.rule_id,
                        target=right.rule_id,
                        relation="similar_rule",
                        metadata={"similarity": round(semantic_similarity, 2)},
                    ))
                if _conditions_overlap(left, right) and _is_opposing(left.summary, right.summary):
                    add_edge(GraphEdge(
                        edge_id=f"edge:conflict:{left.rule_id}:{right.rule_id}",
                        source=left.rule_id,
                        target=right.rule_id,
                        relation="conflicts_with",
                        metadata={"reason": "overlapping conditions with opposing intent"},
                    ))

        return {
            "snapshot_id": snapshot.snapshot_id,
            "nodes": [node.model_dump(mode="json") for node in nodes],
            "edges": [edge.model_dump(mode="json") for edge in edges],
        }
