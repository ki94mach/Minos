import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import type { PatientMapUsageEntry } from "../../utils/patientMapSearchUtils";

type Props = {
  open: boolean;
  title: string;
  entries: PatientMapUsageEntry[];
  onSelect: (entry: PatientMapUsageEntry) => void;
  onClose: () => void;
};

export default function PatientMapUsagePickerDialog({
  open,
  title,
  entries,
  onSelect,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <List disablePadding>
          {entries.map((entry) => (
            <ListItemButton
              key={`${entry.group.patient_id}:${entry.usage.node_id}:${entry.secondaryLabel}`}
              onClick={() => onSelect(entry)}
              sx={{ py: 1.25, px: 2 }}>
              <ListItemText
                primary={entry.primaryLabel}
                secondary={entry.secondaryLabel}
                primaryTypographyProps={{ variant: "body2" }}
                secondaryTypographyProps={{ variant: "caption" }}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
