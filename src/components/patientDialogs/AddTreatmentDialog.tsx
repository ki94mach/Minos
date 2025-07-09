import { Dialog, DialogContent } from "@mui/material";
import TreatmentForm from "../TreatmentForm";
import type { Node } from "reactflow";

type Props = {
  open: boolean;
  onClose: () => void;
  parentNode: Node;
  onSaved: () => void;
};

export default function AddTreatmentDialog({
  open,
  onClose,
  parentNode,
  onSaved,
}: Props) {
  const parentSize = parentNode?.data.size ?? 1;
  const parentId = parentNode?.data.docId || parentNode.id;
  const treeId = parentNode?.data.treeId;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogContent dividers>
        <TreatmentForm
          parentId={parentId}
          parentSize={parentSize}
          patientId={treeId}
          onSaved={async () => {
            onClose();
            await onSaved();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
