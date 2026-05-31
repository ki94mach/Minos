import { Dialog, DialogContent } from "@mui/material";
import FollowupForm from "../FollowupForm";
import type { Node } from "reactflow";

type Props = {
  open: boolean;
  onClose: () => void;
  parentNode: Node;
  onSaved: () => void;
  container?: HTMLElement | (() => HTMLElement | null) | null;
};

export default function AddFollowupDialog({
  open,
  onClose,
  parentNode,
  onSaved,
  container,
}: Props) {
  const parentSize = parentNode?.data.size ?? 1;
  const parentId = parentNode?.data.docId || parentNode.id;
  const treeId = parentNode?.data.treeId;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth container={container}>
      <DialogContent dividers>
        <FollowupForm
          parentId={parentId}
          patientId={treeId}
          parentSize={parentSize}
          nodeName={parentNode.data.label}
          onSaved={async () => {
            onClose();
            await onSaved();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
