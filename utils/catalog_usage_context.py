# utils/catalog_usage_context.py
"""Resolve Population / PI context and path labels for catalog usage navigation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, List, Optional

from bson import ObjectId

from utils.tree_traversal import TreePath, _get_field, normalize_object_id

PRIMARY_INDICATION_TYPE = "Primary Indication"


def embedded_char_type(node: Any) -> Optional[str]:
    char_data = _get_field(node, "characteristic_data")
    if char_data is None:
        return None
    return _get_field(char_data, "type") or _get_field(char_data, "char_type")


def node_embedded_label(node: Any) -> str:
    node_type = _get_field(node, "node_type")
    if node_type == "characteristic":
        char_data = _get_field(node, "characteristic_data")
        return str(_get_field(char_data, "name", "Characteristic"))
    if node_type == "treatment":
        treat_data = _get_field(node, "treatment_data")
        return str(_get_field(treat_data, "name", "Treatment"))
    if node_type == "followup":
        fu_data = _get_field(node, "followup_data")
        return str(_get_field(fu_data, "name", "Follow-up"))
    return "Node"


def _characteristic_catalog_id(node: Any) -> Optional[ObjectId]:
    char_data = _get_field(node, "characteristic_data")
    if char_data is None:
        return None
    raw_id = _get_field(char_data, "_id")
    if raw_id is None:
        return None
    return normalize_object_id(raw_id)


def nodes_on_path(root: Any, path: TreePath) -> List[Any]:
    """Root through hit node inclusive."""
    chain = [root]
    current = root
    for index in path:
        children = _get_field(current, "children") or []
        current = children[index]
        chain.append(current)
    return chain


def _closest_pi_ancestor(chain: List[Any]) -> Optional[Any]:
    for node in reversed(chain):
        if embedded_char_type(node) == PRIMARY_INDICATION_TYPE:
            return node
    return None


@dataclass(frozen=True)
class UsageContext:
    population_catalog_id: str
    population_name: str
    pi_catalog_id: Optional[str]
    pi_name: Optional[str]
    node_label: str
    path_label: str


def build_path_label(
    population_name: str,
    pi_name: Optional[str],
    node_label: str,
    *,
    hit_is_population: bool,
    hit_is_pi: bool,
) -> str:
    parts: List[str] = []
    if population_name:
        parts.append(population_name)
    if pi_name:
        parts.append(pi_name)
    if not hit_is_population and not (hit_is_pi and node_label == pi_name):
        if node_label and node_label not in parts:
            parts.append(node_label)
    return " → ".join(parts)


def resolve_usage_context(root: Any, hit_node: Any, path: TreePath) -> UsageContext:
    chain = nodes_on_path(root, path)
    population_node = root
    pop_catalog_id = _characteristic_catalog_id(population_node)
    population_name = node_embedded_label(population_node)
    population_catalog_id = (
        str(pop_catalog_id) if pop_catalog_id is not None else ""
    )

    pi_node = _closest_pi_ancestor(chain)
    pi_catalog_id: Optional[str] = None
    pi_name: Optional[str] = None
    if pi_node is not None:
        pi_oid = _characteristic_catalog_id(pi_node)
        if pi_oid is not None:
            pi_catalog_id = str(pi_oid)
        pi_name = node_embedded_label(pi_node)

    node_label = node_embedded_label(hit_node)
    hit_is_population = hit_node is population_node
    hit_is_pi = embedded_char_type(hit_node) == PRIMARY_INDICATION_TYPE
    path_label = build_path_label(
        population_name,
        pi_name,
        node_label,
        hit_is_population=hit_is_population,
        hit_is_pi=hit_is_pi,
    )

    return UsageContext(
        population_catalog_id=population_catalog_id,
        population_name=population_name,
        pi_catalog_id=pi_catalog_id,
        pi_name=pi_name,
        node_label=node_label,
        path_label=path_label,
    )
