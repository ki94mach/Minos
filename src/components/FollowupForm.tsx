import React, { useState } from "react";
import { Stack, TextField, Button } from "@mui/material";
import api from "../api";
import { API_ENDPOINTS } from "../api/endpoints";

export default function FollowupForm({
  parentId,
  patientId,
  parentSize = 1,
  onSaved,
  nodeName,
}: {
  parentId: string;
  patientId: string;
  parentSize?: number;
  onSaved: () => void;
  nodeName: string;
}) {
  const [name, setName] = useState(`Follow Up: ${nodeName}`);
  const [overallSurvival, setOverallSurvival] = useState(0.5);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    let followupId: string | null = null;

    try {
      const createResp = await api.post(API_ENDPOINTS.FOLLOWUPS, {
        name,
        overall_survival: overallSurvival,
        patient_id: patientId,
        parent_id: parentId,
      });

      followupId = createResp.data.id as string;
      const size = Math.round(parentSize * overallSurvival);

      await api.post(API_ENDPOINTS.ADD_NODE(patientId), {
        parent_node_id: parentId,
        node: {
          node_type: "followup",
          rate: overallSurvival,
          size,
          followup_data: {
            _id: followupId,
            overall_survival: overallSurvival,
          },
        },
      });

      onSaved();
    } catch (err: unknown) {
      if (followupId) {
        try {
          await api.delete(API_ENDPOINTS.FOLLOWUP_DETAIL(followupId));
        } catch {
          // Best-effort rollback if add_node failed after followup was created.
        }
      }
      console.error("Error creating follow-up node:", err);
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(
        axiosErr.response?.data?.error ??
          "Follow-up creation failed. If you retried, use a different name or delete the existing follow-up in the catalog."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit}>
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <TextField
        label="Overall Survival"
        type="number"
        inputProps={{ step: "any", min: 0, max: 1 }}
        value={overallSurvival}
        onChange={(e) => setOverallSurvival(parseFloat(e.target.value))}
        required
      />
      <Button type="submit" variant="contained" disabled={busy}>
        Add Follow-up
      </Button>
    </Stack>
  );
}
