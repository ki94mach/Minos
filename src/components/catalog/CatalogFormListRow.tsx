import React from "react";
import { IconButton, ListItem, ListItemText } from "@mui/material";
import { Delete } from "@mui/icons-material";
import { catalogListItemSx } from "./catalogPageStyles";

type Props = {
  primary: string;
  secondary?: string;
  onRemove: () => void;
};

/** Compact row for items inside a catalog form (e.g. regimen drugs). */
export default function CatalogFormListRow({
  primary,
  secondary,
  onRemove,
}: Props) {
  return (
    <ListItem
      dense
      divider
      sx={catalogListItemSx(false)}
      secondaryAction={
        <IconButton
          edge="end"
          size="small"
          aria-label="remove"
          onClick={onRemove}>
          <Delete fontSize="small" />
        </IconButton>
      }>
      <ListItemText
        primary={primary}
        secondary={secondary}
        primaryTypographyProps={{ variant: "body2" }}
        secondaryTypographyProps={{ variant: "caption" }}
      />
    </ListItem>
  );
}
