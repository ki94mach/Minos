import React, { useState } from "react";
import { Box, Collapse, IconButton, ListItem, ListItemText } from "@mui/material";
import { Delete, Edit, ExpandLess, ExpandMore } from "@mui/icons-material";
import CatalogUsagePanel from "./CatalogUsagePanel";
import type { CatalogEntityKind } from "./catalogEditSave";
import { catalogListItemSx } from "./catalogPageStyles";

type Props = {
  catalogId: string;
  kind: CatalogEntityKind;
  selected?: boolean;
  primary: string;
  secondary?: string;
  isPopulationCatalogHit?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export default function CatalogListItemWithUsages({
  catalogId,
  kind,
  selected = false,
  primary,
  secondary,
  isPopulationCatalogHit = false,
  onEdit,
  onDelete,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box component="li" sx={{ listStyle: "none" }}>
      <ListItem
        dense
        divider
        sx={{ ...catalogListItemSx(selected), pr: { xs: 12, sm: 14 } }}
        secondaryAction={
          <>
            <IconButton
              edge="end"
              size="small"
              aria-label={expanded ? "Hide usages" : "Show usages"}
              onClick={() => setExpanded((open) => !open)}>
              {expanded ? (
                <ExpandLess fontSize="small" />
              ) : (
                <ExpandMore fontSize="small" />
              )}
            </IconButton>
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
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CatalogUsagePanel
          catalogId={catalogId}
          kind={kind}
          isPopulationCatalogHit={isPopulationCatalogHit}
        />
      </Collapse>
    </Box>
  );
}
