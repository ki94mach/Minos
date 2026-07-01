"""Unit tests for patient-tree node splicing (utils.business_rules.remove_node)."""

from __future__ import annotations

import copy
import unittest
from types import SimpleNamespace

from bson import ObjectId

from utils.business_rules import remove_node


def _node(
    node_id: ObjectId | None = None,
    *,
    children: list | None = None,
    parent_id: ObjectId | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        _id=node_id or ObjectId(),
        children=list(children or []),
        parent_id=parent_id,
    )


def _child_ids(node: SimpleNamespace) -> list[str]:
    return [str(c._id) for c in node.children]


class RemoveNodeTests(unittest.TestCase):
    def test_leaf_delete(self) -> None:
        leaf = _node()
        root = _node(children=[leaf])
        root_snapshot = copy.deepcopy(root)

        self.assertTrue(remove_node(root, leaf._id))
        self.assertEqual(_child_ids(root), [])
        self.assertEqual(_child_ids(root_snapshot), [str(leaf._id)])

    def test_delete_with_grandchildren_deep_structure_unchanged(self) -> None:
        great_grandchild = _node()
        grandchild = _node(children=[great_grandchild])
        great_grandchild.parent_id = grandchild._id
        target = _node(children=[grandchild])
        sibling = _node()
        root = _node(children=[target, sibling])

        self.assertTrue(remove_node(root, target._id))

        self.assertEqual(_child_ids(root), [str(grandchild._id), str(sibling._id)])
        self.assertEqual(grandchild.parent_id, root._id)
        self.assertEqual(_child_ids(grandchild), [str(great_grandchild._id)])
        # Deeper descendants are not re-parented; only the splice target's children move up.
        self.assertEqual(great_grandchild.parent_id, grandchild._id)

    def test_delete_node_not_found(self) -> None:
        leaf = _node()
        inner = _node(children=[leaf])
        root = _node(children=[inner])
        before_children = _child_ids(root)
        before_inner_children = _child_ids(inner)

        self.assertFalse(remove_node(root, ObjectId()))

        self.assertEqual(_child_ids(root), before_children)
        self.assertEqual(_child_ids(inner), before_inner_children)
        self.assertEqual(leaf.parent_id, None)


if __name__ == "__main__":
    unittest.main()
