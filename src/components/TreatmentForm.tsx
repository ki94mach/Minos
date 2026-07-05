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
} from "@mui/material";
import { API_ENDPOINTS } from "../api/endpoints";
import { asApiList } from "../api/parseApiList";

interface Drug {
  _id: string;
  name: string;
  strength?: number | null;
  unit?: string | null;
}

interface DrugWithCon {
  drug: Drug;
  annual_patient_con?: number | null;
}

interface AlternativeOption {
  _id: string;
  name: string;
  ratio: number;
  priority: number;
  evidence_level?: string;
  regimen?: {
    drugs: DrugWithCon[];
  };
}

export interface TreatmentOption {
  _id: string;
  name: string;
  type: "Regimen" | "Treatment" | "Alternative";
  priority?: number;
  evidence_level?: string;
  regimen?: {
    drugs: DrugWithCon[];
  };
  alternatives?: AlternativeOption[];
}

function extractId(id: unknown): string {
  return typeof id === "object" && id !== null && "$oid" in id
    ? (id as { $oid: string }).$oid
    : String(id);
}

function normalizeDrugRef(drug: Drug): Drug {
  return {
    ...drug,
    _id: extractId(drug._id),
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
        setTreatments(asApiList<TreatmentOption>(res.data));
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
            drug: normalizeDrugRef(d.drug),
          })),
        }
      : undefined;

    const fixedAlternatives =
      selected.type === "Alternative" && selected.alternatives?.length
        ? selected.alternatives.map((alt) => {
            const entry: Record<string, unknown> = {
              _id: extractId(alt._id),
              name: alt.name,
              ratio: alt.ratio,
              priority: alt.priority,
            };
            if (alt.evidence_level?.trim()) {
              entry.evidence_level = alt.evidence_level.trim();
            }
            if (alt.regimen?.drugs?.length) {
              entry.regimen = {
                drugs: alt.regimen.drugs.map((d) => ({
                  ...d,
                  drug: normalizeDrugRef(d.drug),
                })),
              };
            }
            return entry;
          })
        : undefined;

    const treatmentData: Record<string, unknown> = {
        _id: selected._id,
        name: selected.name,
        type: selected.type,
      };
    if (selected.priority != null) {
      treatmentData.priority = selected.priority;
    }
    if (selected.evidence_level?.trim()) {
      treatmentData.evidence_level = selected.evidence_level.trim();
    }
    if (selected.type === "Regimen" && fixedRegimen) {
      treatmentData.regimen = fixedRegimen;
    }
    if (fixedAlternatives) {
      treatmentData.alternatives = fixedAlternatives;
    }

    const node = {
      node_type: "treatment",
      rate,
      size,
      treatment_data: treatmentData,
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
          onChange={(e) => setSelectedId(e.target.value)}>
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
        inputProps={{ step: "any", min: 0, max: 1 }}
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
