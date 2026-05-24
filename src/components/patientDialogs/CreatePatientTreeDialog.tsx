import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from "@mui/material";
import { listCharacteristics } from "../../api/characteristics";
import { createPatient } from "../../api/patients";
import {
  getDefaultCharName,
  getDefaultCharType,
} from "../../config/defaultCharacteristic";

const DEFAULT_ROOT_SIZE = 90_000_000;

type PopulationOption = {
  _id: string;
  type: string;
  name: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export default function CreatePatientTreeDialog({
  open,
  onClose,
  onCreated,
}: Props) {
  const [populations, setPopulations] = useState<PopulationOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [size, setSize] = useState(String(DEFAULT_ROOT_SIZE));
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    listCharacteristics()
      .then((chars) => {
        const pops = chars.filter((c) => c.type === "Population");
        setPopulations(pops);

        if (pops.length === 0) {
          setSelectedId("");
          return;
        }

        const preferredType = getDefaultCharType();
        const preferredName = getDefaultCharName();
        const preferred = pops.find(
          (c) => c.type === preferredType && c.name === preferredName
        );
        setSelectedId((preferred ?? pops[0])._id);
      })
      .catch((err) => {
        console.error("Failed to load Population characteristics:", err);
        setPopulations([]);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const selected = populations.find((p) => p._id === selectedId);

  const handleCreate = async () => {
    if (!selected) {
      alert("Select a Population characteristic.");
      return;
    }

    const parsedSize = Number(size);
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      alert("Enter a valid size greater than zero.");
      return;
    }

    setBusy(true);
    try {
      await createPatient({
        node: {
          node_type: "characteristic",
          rate: 1.0,
          size: parsedSize,
          parent_id: null,
          characteristic_data: {
            _id: selected._id,
            char_type: selected.type,
            name: selected.name,
          },
          children: [],
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error("Failed to create patient tree:", err);
      alert("Failed to create patient tree.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create patient tree</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        {loading ? (
          <Typography color="text.secondary">Loading characteristics…</Typography>
        ) : populations.length === 0 ? (
          <Typography color="text.secondary">
            No Population characteristics in the catalog. Add one on the
            Characteristics page first.
          </Typography>
        ) : (
          <>
            <FormControl fullWidth>
              <InputLabel id="population-select-label">Population</InputLabel>
              <Select
                labelId="population-select-label"
                value={selectedId}
                label="Population"
                onChange={(e: SelectChangeEvent<string>) =>
                  setSelectedId(e.target.value)
                }>
                {populations.map((p) => (
                  <MenuItem key={p._id} value={p._id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Root size"
              type="number"
              fullWidth
              value={size}
              inputProps={{ min: 1, step: 1 }}
              onChange={(e) => setSize(e.target.value)}
              helperText="Total population size for this root node"
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={busy || loading || populations.length === 0}>
          {busy ? "Creating…" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
