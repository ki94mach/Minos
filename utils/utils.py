import json
import hashlib


class Utils:

    # =============================================================================
    # Utility: Compute Hash of a Tree Structure
    # =============================================================================
    @staticmethod
    def compute_tree_hash(tree):
        """
        Compute a SHA-256 hash of a patient tree (MongoEngine Node or BSON dict).
        Uses canonical JSON (sort_keys, default=str) so identical trees always
        produce the same hash regardless of dict insertion order.
        """
        if hasattr(tree, "to_mongo"):
            tree = tree.to_mongo().to_dict()
        tree_json = json.dumps(tree, sort_keys=True, default=str)
        return hashlib.sha256(tree_json.encode("utf-8")).hexdigest()
