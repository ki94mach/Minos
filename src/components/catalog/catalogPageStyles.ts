import type { SxProps, Theme } from "@mui/material";

export const catalogPageContainerSx: SxProps<Theme> = {
  py: 4,
};

export const catalogPageTitleSx: SxProps<Theme> = {
  mb: 3,
  fontWeight: 600,
};

export const catalogCardSx: SxProps<Theme> = {
  borderRadius: 2,
  border: 1,
  borderColor: "divider",
};

export const catalogFormSectionTitleSx: SxProps<Theme> = {
  fontWeight: 600,
  mb: 2,
};

export const catalogSectionDividerSx: SxProps<Theme> = {
  my: 3,
};

export const catalogListSectionLabelSx: SxProps<Theme> = {
  display: "block",
  mb: 1.5,
  color: "text.secondary",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  fontSize: "0.7rem",
};

export const catalogSearchFieldSx: SxProps<Theme> = {
  mb: 2,
};

export const catalogListSx: SxProps<Theme> = {
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  overflow: "hidden",
  bgcolor: "background.paper",
};

export const catalogListItemSx = (
  selected: boolean
): SxProps<Theme> => ({
  py: 1.25,
  px: 2,
  minHeight: 52,
  bgcolor: selected ? "action.selected" : "transparent",
});

export const catalogNestedListSx: SxProps<Theme> = {
  ...catalogListSx,
  mt: 1.5,
};

export const catalogFormActionsSx: SxProps<Theme> = {
  mt: 2,
};

export const catalogEmptyStateSx: SxProps<Theme> = {
  py: 3,
  textAlign: "center",
  color: "text.secondary",
};
