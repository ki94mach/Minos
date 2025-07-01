import React, { useState, useMemo } from "react";
import { Stack, TextField, Button } from "@mui/material";
import axios from "axios";
import Cookies from "js-cookie";
import { nodeModuleNameResolver } from "typescript";

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

  const size = useMemo(() => Math.round(parentSize * overallSurvival), [parentSize, overallSurvival]);

  function authHeaders() {
    const csrf = Cookies.get("csrf_token") ?? "";
    return {
      withCredentials: true,
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
    };
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      // Step 1: Create the follow-up and get its ID
      const createResp = await axios.post(
        "http://localhost:5000/api/followups",
        {
          name: name,
          overall_survival: overallSurvival,
          patient_id: patientId,
          parent_id: parentId,
        },
        authHeaders()
      );

      const followupId = createResp.data.id;
      const size = Math.round(parentSize * overallSurvival);

      // Step 2: Add the follow-up node to the patient tree
      await axios.post(
        `http://localhost:5000/api/patients/${patientId}/add_node`,
        {
          parent_node_id: parentId,
          node: {
            node_type: "followup",
            rate: overallSurvival,
            size,
            followup_data: {
              _id: followupId,
              name,
              overall_survival: overallSurvival,
            },
          },
        },
        authHeaders()
      );

      onSaved();
    } catch (err) {
      console.error("Error creating follow-up node:", err);
      alert("Follow-up creation failed.");
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
        inputProps={{ step: 0.01, min: 0, max: 1 }}
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
