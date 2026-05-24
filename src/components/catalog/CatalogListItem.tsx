import React from "react";
import { IconButton, ListItem, ListItemText } from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import { catalogListItemSx } from "./catalogPageStyles";

type Props = {
  selected?: boolean;
  primary: string;
  secondary?: string;
  onEdit: () => void;
  onDelete: () => void;
};

export default function CatalogListItem({
  selected = false,
  primary,
  secondary,
  onEdit,
  onDelete,
}: Props) {
  return (
    <ListItem
      dense
      divider
      sx={catalogListItemSx(selected)}
      secondaryAction={
        <>
          <IconButton
            edge="end"
            size="small"
            aria-label="edit"
            onClick={onEdit}>
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            edge="end"
            size="small"
            aria-label="delete"
            onClick={onDelete}
            sx={{ ml: 0.5 }}>
            <Delete fontSize="small" />
          </IconButton>
        </>
      }>
      <ListItemText
        primary={primary}
        secondary={secondary}
        primaryTypographyProps={{ variant: "body2", fontWeight: 500 }}
        secondaryTypographyProps={{ variant: "caption" }}
      />
    </ListItem>
  );
}
