// src/components/CharacteristicForm.tsx

import React, { useState } from "react";
import { TextField, Button, Stack } from "@mui/material";
import { CharacteristicItem, saveCharacteristic } from "../api/characteristics";

export default function CharacteristicForm({
  initial,
  parentId,
  onSaved,
}: {
  initial?: CharacteristicItem;
  parentId?: string;
  onSaved: () => void;
}) {
  const [type, setType] = useState(initial?.type ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <Stack
      spacing={2}
      component="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);

        try {
          if (initial?._id) {
            // ─────────────── Editing an existing characteristic ───────────────
            await saveCharacteristic({
              _id: initial._id,
              type,
              name,
            });
          } else {
            // ─────────────── Creating a new characteristic ───────────────
            // parentId is optional, but if provided we include it here
            if (parentId) {
              await saveCharacteristic({
                type,
                name,
                parent_id: parentId,
              } as any);
            } else {
              await saveCharacteristic({ type, name });
            }
          }
          onSaved();
        } catch (err) {
          // Handle error if needed (e.g. show a Snackbar)
          console.error(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField
        label="Type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        required
      />
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Button type="submit" variant="contained" disabled={busy}>
        {initial ? "Update" : "Add"}
      </Button>
    </Stack>
  );
}
