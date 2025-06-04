// src/components/TreatmentForm.tsx
import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Divider,
  Autocomplete,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import axios from "axios";
import Cookies from "js-cookie";

/* ─────────────── shared types ─────────────── */
export interface Drug {
  _id: string;
  name: string;
  strength: number;
  unit: string;
}
export interface DrugWithCon {
  drug: Drug;
  annual_patient_con: number;
}
export interface Alternative {
  _id?: string;
  name: string;
  ratio: number;
  regimen: { drugs: DrugWithCon[] };
}
export interface Treatment {
  _id?: string;
  name: string;
  type: "Treatment" | "Regimen" | "Alternative";
  regimen?: { drugs: DrugWithCon[] };
  alternatives?: Alternative[];
}

/* ─────────────── helper for CSRF header ───── */
function authHeaders() {
  const csrf = Cookies.get("csrf_token") ?? "";
  return {
    withCredentials: true,
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
  };
}

/* ───────────────── component ──────────────── */
export default function TreatmentForm({
  initial,
  parentId,
  onSaved
}: {
  initial?: Treatment;
  parentId?: string;
  onSaved: () => void;
}) {
  /* ─────────── state ─────────── */
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [regimens, setRegimens] = useState<Treatment[]>([]);
  const [name, setName] = useState(initial?.name ?? "");
  const [tType, setTType] = useState<Treatment["type"]>(
    initial?.type ?? "Treatment"
  );

  const [selectedDrugId, setSelectedDrugId] = useState("");
  const [annualCon, setAnnualCon] = useState<number>(0);
  const [regimenDrugs, setRegimenDrugs] = useState<DrugWithCon[]>(
    initial?.regimen?.drugs ?? []
  );

  const [altRatio, setAltRatio] = useState<number>(0);
  const [alts, setAlts] = useState<Alternative[]>(
    initial?.alternatives ?? []
  );
  const [selRegimenId, setSelRegimenId] = useState("");

  const [err, setErr] = useState<string>("");

  /* ─────────── fetch refs on mount ─────────── */
  useEffect(() => {
    (async () => {
      const d = await axios.get("http://localhost:5000/api/drugs");
      setDrugs(
        d.data.map((x: string) => {
          const o = JSON.parse(x);
          return { ...o, _id: o._id.$oid };
        })
      );

      const t = await axios.get("http://localhost:5000/api/treatments");
      const parsed: Treatment[] = t.data.map((x: string) => {
        const o = JSON.parse(x);
        return { ...o, _id: o._id.$oid };
      });
      setRegimens(parsed.filter((r) => r.type === "Regimen"));
    })();
  }, []);

  /* ─────────── helpers ─────────── */
  const addDrug = () => {
    if (!selectedDrugId || annualCon <= 0) return;
    const d = drugs.find((x) => x._id === selectedDrugId);
    if (!d) return;
    setRegimenDrugs((prev) => [
      ...prev,
      { drug: d, annual_patient_con: annualCon },
    ]);
    setSelectedDrugId("");
    setAnnualCon(0);
  };

  const addAlternative = () => {
    if (!selRegimenId || altRatio <= 0 || altRatio > 1) return;
    const reg = regimens.find((r) => r._id === selRegimenId);
    if (!reg || !reg.regimen) return;
    setAlts((p) => [
      ...p,
      {
        _id: reg._id,
        name: reg.name,
        ratio: altRatio,
        regimen: reg.regimen!,
      },
    ]);
    setSelRegimenId("");
    setAltRatio(0);
  };

  /* ─────────── submit ─────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { name, type: tType };
    if (parentId) {
      payload.parent_id = parentId;
    }
    if (tType === "Regimen") {
      payload.regimen = { drugs: regimenDrugs };
    }
    if (tType === "Alternative") {
      payload.alternatives = alts;
    }
    try {
      if (initial?._id) {
        await axios.put(
          `http://localhost:5000/api/treatments/${initial._id}`,
          payload,
          authHeaders()
        );
      } else {
        await axios.post(
          "http://localhost:5000/api/treatments",
          payload,
          authHeaders()
        );
      }
      onSaved();
    } catch (e: any) {
      setErr(e.response?.data?.error ?? "Error submitting treatment");
    }
  };
  

  /* ─────────── UI ─────────── */
  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={8}>
          <TextField
            fullWidth
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth required>
            <InputLabel>Type</InputLabel>
            <Select
              value={tType}
              label="Type"
              onChange={(e) =>
                setTType(e.target.value as Treatment["type"])
              }
            >
              <MenuItem value="Treatment">Treatment</MenuItem>
              <MenuItem value="Regimen">Regimen</MenuItem>
              <MenuItem value="Alternative">Alternative</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {tType === "Regimen" && (
        <Box mt={3}>
          <Typography variant="subtitle1">Regimen drugs</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Autocomplete
                options={drugs}
                getOptionLabel={(o) =>
                  `${o.name} - ${o.strength} ${o.unit}`
                }
                value={drugs.find((d) => d._id === selectedDrugId) ?? null}
                onChange={(_, v) => setSelectedDrugId(v ? v._id : "")}
                renderInput={(p) => (
                  <TextField {...p} label="Search drug" />
                )}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                type="number"
                label="Annual consumption"
                fullWidth
                value={annualCon}
                onChange={(e) => setAnnualCon(+e.target.value)}
              />
            </Grid>
            <Grid item xs={2}>
              <Button variant="contained" fullWidth onClick={addDrug}>
                Add
              </Button>
            </Grid>
          </Grid>
          <List>
            {regimenDrugs.map((r, i) => (
              <ListItem
                key={i}
                secondaryAction={
                  <IconButton
                    onClick={() =>
                      setRegimenDrugs(regimenDrugs.filter((_, ix) => ix !== i))
                    }
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={`${r.drug.name} – ${r.drug.strength} ${r.drug.unit}`}
                  secondary={`Annual con: ${r.annual_patient_con}`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {tType === "Alternative" && (
        <Box mt={3}>
          <Typography variant="subtitle1">Add alternative regimen</Typography>
          <Autocomplete
            options={regimens}
            getOptionLabel={(o) => o.name}
            value={regimens.find((r) => r._id === selRegimenId) ?? null}
            onChange={(_, v) => setSelRegimenId(v ? v._id! : "")}
            renderInput={(p) => <TextField {...p} label="Search regimen" />}
            sx={{ mb: 2 }}
          />
          <TextField
            type="number"
            label="Ratio (0 – 1)"
            fullWidth
            value={altRatio}
            onChange={(e) => setAltRatio(+e.target.value)}
            inputProps={{ min: 0, max: 1, step: 0.01 }}
          />
          <Button sx={{ mt: 1 }} onClick={addAlternative}>
            Add alternative
          </Button>
          <Divider sx={{ my: 2 }} />
          {alts.map((a, i) => (
            <Paper key={i} sx={{ p: 1, mb: 1 }}>
              <Grid container spacing={1} alignItems="center">
                <Grid item xs={8}>
                  <Typography>{a.name}</Typography>
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    type="number"
                    label="Ratio"
                    value={a.ratio}
                    onChange={(e) => {
                      const upd = [...alts];
                      let v = +e.target.value;
                      if (isNaN(v) || v < 0) v = 0;
                      if (v > 1) v = 1;
                      upd[i].ratio = v;
                      setAlts(upd);
                    }}
                    inputProps={{ min: 0, max: 1, step: 0.01 }}
                    size="small"
                  />
                </Grid>
                <Grid item xs={1}>
                  <IconButton
                    onClick={() => setAlts(alts.filter((_, ix) => ix !== i))}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Box>
      )}

      {err && (
        <Typography color="error" sx={{ mt: 2 }}>
          {err}
        </Typography>
      )}

      <Box sx={{ mt: 3, textAlign: "right" }}>
        <Button type="submit" variant="contained">
          {initial ? "Update" : "Add"}
        </Button>
      </Box>
    </Box>
  );
}
