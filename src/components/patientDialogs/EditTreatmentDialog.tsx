import { Dialog, DialogTitle, DialogContent } from "@mui/material";
import EditTreatmentForm from "../EditTreatmentForm";
import type { EditTreatModalData } from "../EditTreatmentForm";
import type { TreatmentOption } from "../TreatmentForm";

type EditTreatmentDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData: EditTreatModalData;
  allTreatments: TreatmentOption[];
};

export default function EditTreatmentDialog({
  open,
  onClose,
  onSaved,
  editData,
  allTreatments,
}: EditTreatmentDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Treatment Node</DialogTitle>
      <DialogContent dividers>
        <EditTreatmentForm
          editData={editData}
          allTreatments={allTreatments}
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
