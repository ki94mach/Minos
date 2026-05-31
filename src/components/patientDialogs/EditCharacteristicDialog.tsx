import { Dialog, DialogTitle, DialogContent } from "@mui/material";
import EditCharacteristicForm from "../EditCharacteristicForm";
import type { OneChar, EditCharModalData } from "../EditCharacteristicForm";

type EditCharacteristicDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData: EditCharModalData;
  allChars: OneChar[];
  container?: HTMLElement | (() => HTMLElement | null) | null;
};

export default function EditCharacteristicDialog({
  open,
  onClose,
  editData,
  allChars,
  onSaved,
  container,
}: EditCharacteristicDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth container={container}>
      <DialogTitle>
        {editData.isTreeRoot ? "Edit Population Root" : "Edit Characteristic Node"}
      </DialogTitle>
      <DialogContent dividers>
        <EditCharacteristicForm
          editData={editData}
          allChars={allChars}
          onCancel={onClose}
          onSave={() => {
            onClose();
            onSaved();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
