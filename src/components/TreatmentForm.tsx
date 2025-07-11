import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Cookies from "js-cookie";
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { API_ENDPOINTS } from "../api/endpoints";

interface Drug {
  _id: string;
  name: string;
  strength: number;
  unit: string;
}

interface DrugWithCon {
  drug: Drug;
  annual_patient_con: number;
}

export interface TreatmentOption {
  _id: string;
  name: string;
  type: "Regimen" | "Treatment" | "Alternative";
  regimen?: {
    drugs: DrugWithCon[];
  };
}

interface TreatmentFormProps {
  parentId: string;
  parentSize: number;
  patientId: string;
  onSaved: () => void;
}

export default function TreatmentForm({
  parentId,
  parentSize,
  patientId,
  onSaved,
}: TreatmentFormProps) {
  const [treatments, setTreatments] = useState<TreatmentOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [rate, setRate] = useState(1);
  const [busy, setBusy] = useState(false);

  // Fetch all treatments of type "Regimen"
  useEffect(() => {
    api.get(API_ENDPOINTS.TREATMENTS)
      .then((res) => {
        const parsed: TreatmentOption[] = res.data.map((item: string) => {
          const obj = JSON.parse(item);
          return {
            ...obj,
            _id: obj._id.$oid,
          };
        });
        setTreatments(parsed);
      })
      .catch((err) => console.error("Failed to load treatments:", err));
  }, []);

  const size = useMemo(() => {
    return Math.round(parentSize * rate);
  }, [parentSize, rate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentId || !selectedId) return;
    setBusy(true);

    const selected = treatments.find((t) => t._id === selectedId);
    if (!selected) {
      console.error("Selected treatment not found.");
      setBusy(false);
      return;
    }

    const fixedRegimen = selected.regimen?.drugs
      ? {
          drugs: selected.regimen.drugs.map((d) => ({
            ...d,
            drug: {
              ...d.drug,
              _id:
                typeof d.drug._id === "object" && "$oid" in d.drug._id
                  ? d.drug._id["$oid"]
                  : d.drug._id,
            },
          })),
        }
      : undefined; 

    const node = {
      node_type: "treatment",
      rate,
      size,
      treatment_data: {
        _id: selected._id,
        name: selected.name,
        type: selected.type,
        // regimen: fixedRegimen,
        ...(selected.type === "Regimen" && fixedRegimen
          ? { regimen: fixedRegimen }
          : {}),
      },
    };

    const payload = {
      parent_node_id: parentId,
      node,
    };

    try {
      const csrfToken = Cookies.get("csrf_token");
      const config = {
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken || "",
        },
        withCredentials: true,
      };

      console.log("Payload:", payload);

      await api.post(API_ENDPOINTS.ADD_NODE(patientId),
        payload,
        config
      );
      onSaved();
    } catch (err) {
      console.error("Failed to add treatment node:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2} component="form" onSubmit={handleSubmit}>
      <FormControl fullWidth required>
        <InputLabel id="treatment-select-label">Treatment</InputLabel>
        <Select
          labelId="treatment-select-label"
          value={selectedId}
          label="Treatment"
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {treatments.map((t) => (
            <MenuItem key={t._id} value={t._id}>
              {t.name} ({t.type})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Rate"
        type="number"
        inputProps={{ step: "0.01", min: 0, max: 1 }}
        value={rate}
        onChange={(e) => setRate(parseFloat(e.target.value))}
        required
      />

      <TextField
        label="Computed Size"
        type="number"
        value={size}
        InputProps={{ readOnly: true }}
      />

      <Button type="submit" variant="contained" disabled={busy}>
        Add Node
      </Button>
    </Stack>
  );
}
