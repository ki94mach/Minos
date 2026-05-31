import { Dialog, DialogContent } from "@mui/material";
import CharacteristicForm from "../CharacteristicForm";
import type { Node } from "reactflow";

type Props = {
  open: boolean;
  onClose: () => void;
  parentNode: Node;
  onSaved: () => void;
  container?: HTMLElement | (() => HTMLElement | null) | null;
};

export default function AddCharacteristicDialog({
  open,
  onClose,
  parentNode,
  onSaved,
  container,
}: Props) {
  const parentSize = parentNode?.data.size;
  const parentId = parentNode?.data.docId || parentNode.id;
  const treeId = parentNode?.data.treeId;

  if (!treeId) {
    console.error("Missing treeId for parent node:", parentNode);
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth container={container}>
      <DialogContent dividers>
        <CharacteristicForm
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
