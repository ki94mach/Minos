import json
import hashlib


class Utils:

    # =============================================================================
    # Utility: Compute Hash of a Tree Structure
    # =============================================================================
    @staticmethod
    def compute_tree_hash(tree):
        """
        Compute a SHA-256 hash of the tree structure.
        The 'tree' should be serializable to JSON. We use sort_keys=True to ensure
        consistent ordering.
        """
        # Serialize the tree to a JSON string. You might want to filter out fields
        # that you do not wish to include in the hash computation.
        tree_json = json.dumps(tree, sort_keys=True)
        return hashlib.sha256(tree_json.encode('utf-8')).hexdigest()
