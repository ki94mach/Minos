import json
import hashlib


class Utils:

    # =============================================================================
    # Utility: Compute Hash of a Tree Structure
    # =============================================================================
    # Node-level annotation fields that must not affect structural dedup.
    _ANNOTATION_FIELDS = (
        "description",
        "description_updated_by",
        "description_updated_at",
        "references",
    )

    @staticmethod
    def _strip_annotations(value):
        """Recursively drop user-authored annotation fields from a tree dict."""
        if isinstance(value, dict):
            return {
                key: Utils._strip_annotations(item)
                for key, item in value.items()
                if key not in Utils._ANNOTATION_FIELDS
            }
        if isinstance(value, list):
            return [Utils._strip_annotations(item) for item in value]
        return value

    @staticmethod
    def compute_tree_hash(tree):
        """
        Compute a SHA-256 hash of a patient tree (MongoEngine Node or BSON dict).
        Uses canonical JSON (sort_keys, default=str) so identical trees always
        produce the same hash regardless of dict insertion order.

        User-authored annotations (description/references) are stripped before
        hashing so notes and uploaded files never change structural dedup and
        never trigger the unique-index collision on ``PatientTree.tree_hash``.
        """
        if hasattr(tree, "to_mongo"):
            tree = tree.to_mongo().to_dict()
        tree = Utils._strip_annotations(tree)
        tree_json = json.dumps(tree, sort_keys=True, default=str)
        return hashlib.sha256(tree_json.encode("utf-8")).hexdigest()
