import React from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import { treeTokens } from "../../theme/theme";
import {
  buildTreatmentRegimenSections,
  type TreatmentCatalogType,
} from "../../utils/treatmentRegimenDisplay";

export type TreatmentRegimenDialogData = {
  treatmentName: string;
  treatmentCatalogType: TreatmentCatalogType | null;
  regimen?: { drugs?: unknown[] } | null;
  alternatives?: Array<{
    name?: string;
    priority?: number;
    ratio?: number;
    regimen?: { drugs?: unknown[] } | null;
  }>;
};

type Props = TreatmentRegimenDialogData & {
  open: boolean;
  onClose: () => void;
  container?: HTMLElement | (() => HTMLElement | null) | null;
};

export default function TreatmentRegimenDialog({
  open,
  onClose,
  treatmentName,
  treatmentCatalogType,
  regimen,
  alternatives,
  container,
}: Props) {
  const sections = buildTreatmentRegimenSections(
    treatmentCatalogType,
    regimen as Parameters<typeof buildTreatmentRegimenSections>[1],
    alternatives as Parameters<typeof buildTreatmentRegimenSections>[2]
  );
  const catalogTypeLabel = treatmentCatalogType ?? "Treatment";

  const handleClose = (
    event: React.SyntheticEvent,
    _reason?: "backdropClick" | "escapeKeyDown"
  ) => {
    event.stopPropagation();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      container={container}
      slotProps={{
        backdrop: {
          onMouseDown: (event: React.MouseEvent) => {
            event.stopPropagation();
          },
        },
      }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" component="span">
          {treatmentName} — Regimen details
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Chip
            size="small"
            label={catalogTypeLabel}
            variant="outlined"
            sx={{
              borderColor: treeTokens.treatment,
              color: treeTokens.treatment,
            }}
          />
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ maxHeight: "60vh", py: 0 }}>
        {sections.map((section, index) => (
          <Box key={`${section.kind}:${section.title}:${index}`} sx={{ py: 2 }}>
            {index > 0 && <Divider sx={{ mb: 2 }} />}
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
              {section.title}
            </Typography>
            {section.kind === "alternative" && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1 }}>
                Priority: {section.priority ?? "—"} · Ratio:{" "}
                {section.ratio != null ? section.ratio : "—"}
              </Typography>
            )}
            {section.drugs.length > 0 ? (
              <List dense disablePadding>
                {section.drugs.map((drug, drugIndex) => (
                  <ListItem
                    key={`${drug.name}:${drugIndex}`}
                    disableGutters
                    sx={{ py: 0.25 }}>
                    <ListItemText
                      primary={drug.name}
                      secondary={[
                        drug.strengthUnit || null,
                        drug.annualConsumption != null
                          ? `Annual consumption: ${drug.annualConsumption}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      primaryTypographyProps={{ variant: "body2" }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {section.emptyMessage ?? "No drugs listed."}
              </Typography>
            )}
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
