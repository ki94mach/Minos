import React, { useState } from "react";
import { Stack, TextField, Button } from "@mui/material";
import axios from "axios";
import Cookies from "js-cookie";

/**
 * Interface describing a single Follow‐up item.
 * - _id: (optional) when editing, this is the existing follow‐up’s ID.
 * - description: text for this follow‐up.
 * - parent_id: when creating a brand‐new follow‐up under some parent node.
 */
export interface FollowupItem {
  _id?: string;
  description: string;
  parent_id?: string;
}

export default function FollowupForm({
  initial,
  parentId,
  onSaved,
}: {
  /** If present, we are “editing” the existing follow‐up. */
  initial?: FollowupItem;
  /** When creating a new follow‐up, attach it under this parent node. */
  parentId?: string;
  /** Called after successful save (POST or PUT). */
  onSaved: () => void;
}) {
  // Initialize description from initial?.description (edit mode), or empty string (create).
  const [description, setDescription] = useState(initial?.description ?? "");
  const [busy, setBusy] = useState(false);

  /**
   * Build CSRF headers so that Flask/Django/etc. accept our request.
   */
  function authHeaders() {
    const csrf = Cookies.get("csrf_token") ?? "";
    return {
      withCredentials: true,
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
    };
  }

  return (
    <Stack
      spacing={2}
      component="form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);

        try {
          if (initial?._id) {
            // ─────────────── Editing an existing follow‐up ───────────────
            await axios.put(
              `http://localhost:5000/api/followups/${initial._id}`,
              { description },
              authHeaders()
            );
          } else {
            // ─────────────── Creating a brand‐new follow‐up ───────────────
            // Always send description; if parentId is defined, include parent_id
            const payload: Partial<FollowupItem> = { description };
            if (parentId) {
              payload.parent_id = parentId;
            }
            await axios.post(
              "http://localhost:5000/api/followups",
              payload,
              authHeaders()
            );
          }

          // After successful save, invoke onSaved() to close Dialog + refresh graph
          onSaved();
        } catch (err) {
          console.error("Error saving follow‐up:", err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        multiline
        minRows={2}
      />
      <Button type="submit" variant="contained" disabled={busy}>
        {initial ? "Update" : "Add"}
      </Button>
    </Stack>
  );
}
