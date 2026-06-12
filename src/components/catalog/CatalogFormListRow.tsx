import React from "react";
import { DragIndicator } from "@mui/icons-material";
import { Delete } from "@mui/icons-material";
import { Box, IconButton, ListItem, ListItemText } from "@mui/material";
import { catalogListItemSx } from "./catalogPageStyles";

type Props = {
  primary: string;
  secondary?: string;
  onRemove: () => void;
  sortable?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLLIElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLLIElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLLIElement>) => void;
  onDragEnd?: (event: React.DragEvent<HTMLLIElement>) => void;
  trailing?: React.ReactNode;
};

/** Compact row for items inside a catalog form (e.g. regimen drugs). */
export default function CatalogFormListRow({
  primary,
  secondary,
  onRemove,
  sortable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  trailing,
}: Props) {
  return (
    <ListItem
      dense
      divider
      draggable={sortable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      sx={{
        ...catalogListItemSx(false),
        ...(trailing ? { pr: 22 } : {}),
      }}
      secondaryAction={
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {trailing}
          <IconButton
            edge="end"
            size="small"
            aria-label="remove"
            onClick={onRemove}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      }>
      {sortable && (
        <IconButton
          edge="start"
          size="small"
          aria-label="reorder"
          sx={{ cursor: "grab", mr: 0.5 }}
          onMouseDown={(event) => event.stopPropagation()}>
          <DragIndicator fontSize="small" />
        </IconButton>
      )}
      <ListItemText
        primary={primary}
        secondary={secondary}
        primaryTypographyProps={{ variant: "body2" }}
        secondaryTypographyProps={{ variant: "caption" }}
        sx={{ flex: 1, minWidth: 0 }}
      />
    </ListItem>
  );
}
