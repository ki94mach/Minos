import React from "react";
import { FormControlLabel, Switch } from "@mui/material";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export default function OverviewViewToggle({ checked, onChange }: Props) {
  return (
    <FormControlLabel
      control={
        <Switch
          checked={checked}
          onChange={(_, next) => onChange(next)}
          inputProps={{ "aria-label": "Primary Indication View" }}
        />
      }
      label="Primary Indication View"
      labelPlacement="end"
      sx={{ mr: 0, whiteSpace: "nowrap" }}
    />
  );
}
