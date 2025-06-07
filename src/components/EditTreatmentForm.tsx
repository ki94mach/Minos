// src/components/EditTreatmentForm.tsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  TextField,
  Typography,
} from "@mui/material";
import axios from "axios";
import Cookies from "js-cookie";
import { Treatment } from "./TreatmentForm";

interface EditTreatModalData {
  nodeId: string;            // the node’s Mongo _id
  currentTreatId: string;    // the _id of the embedded treatment_data
  currentRate: number;
  patientId: string;
}

interface EditTreatmentFormProps {
  allTreatments: Treatment[];       // fetched from /api/treatments
  editData: EditTreatModalData;
  onCancel: () => void;
  onSave: () => void;
}

const EditTreatmentForm: React.FC<EditTreatmentFormProps> = ({
  allTreatments,
  editData,
  onCancel,
  onSave,
}) => {
  const { nodeId, currentTreatId, currentRate, patientId } = editData;

  const [selectedId, setSelectedId] = useState<string>(currentTreatId);
  const [rate, setRate] = useState<number>(currentRate);
  const [name, setName] = useState("");
  const [type, setType] = useState<"Treatment"|"Regimen"|"Alternative">("Treatment");

  // whenever you pick a different treatment, update its name & type
  useEffect(() => {
    const t = allTreatments.find((t) => t._id === selectedId);
    if (t) {
      setName(t.name);
      setType(t.type);
    }
  }, [selectedId, allTreatments]);

  const handleSave = async () => {
    try {
      const csrfToken = Cookies.get("csrf_token");
      const cfg = {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken ?? "",
        },
      };

      // build payload: always send the new rate,
      // and if the user picked a new treatment, send treatment_data
      const body: any = { rate };
      if (selectedId !== currentTreatId) {
        body.treatment_data = {
          _id: selectedId,
          name,
          type,
        };
      }

      await axios.put(
        `http://localhost:5000/api/patients/${patientId}/node/${nodeId}`,
        body,
        cfg
      );
      onSave();
    } catch (e: any) {
      console.error("Failed to update treatment node:", e);
      const resp = e.response?.data || {};
      let text = resp.error || resp.message || JSON.stringify(resp);
      alert(text);
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={2} mt={2}>
      <FormControl fullWidth>
        <InputLabel id="treat-select-label">Treatment</InputLabel>
        <Select
          labelId="treat-select-label"
          value={selectedId}
          label="Treatment"
          onChange={(e: SelectChangeEvent<string>) => {
            setSelectedId(e.target.value);
          }}
        >
          {allTreatments.map((t) => (
            <MenuItem key={t._id} value={t._id}>
              {t.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Typography variant="body2">Type: {type}</Typography>

      <TextField
        label="Rate"
        type="number"
        fullWidth
        value={rate}
        onChange={(e) => setRate(+e.target.value)}
      />

      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Box>
  );
};

export default EditTreatmentForm;
