import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import Cookies from "js-cookie";
import {
  TextField,
  Button,
  Stack,
  FormControl,
  Autocomplete,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { API_ENDPOINTS } from "../api/endpoints";
import { asApiList } from "../api/parseApiList";

const PRIMARY_INDICATION_TYPE = "Primary Indication";

type MeasureType = "Prevalence" | "Incidence";

interface CharacteristicOption {
  _id: string;
  type: string;
  name: string;
}

interface CharacteristicFormProps {
  initial?: {
    _id: string;
    type: string;
    name: string;
    rate?: number;
  };
  parentId: string;
  parentSize: number; // size of parent node
  patientId: string;
  childrenToAdd?: ChildNode[];
  onSaved: (data: { characteristicId: string; rate: number }) => void;
}

interface ChildNode {
  node_type: "treatment" | "characteristic" | "followup";
  rate:      number;
  size?:     number;
  treatment_data?: {
    _id: string;
    name: string;
    type: string;
    regimen: {
      drugs: Array<{
        drug: {
          _id: string;
          name: string;
          strength: number;
          unit: string;
        };
        annual_patient_con?: number | null;
      }>;
    };
  };
  characteristic_data?: {
    _id: string;
    char_type: string;
    name: string;
  };
  children?: ChildNode[]; 
}

export default function CharacteristicForm({ initial, parentId, parentSize, patientId, onSaved, childrenToAdd = [], }: CharacteristicFormProps) {
  const [options, setOptions] = useState<CharacteristicOption[]>([]);
  const [selectedId, setSelectedId] = useState(initial?._id || "");
  const [rate, setRate] = useState<number>(initial?.rate ?? 1);
  const [measureType, setMeasureType] = useState<MeasureType | "">("");
  const [measureYears, setMeasureYears] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const selectedOpt = options.find((opt) => opt._id === selectedId);
  const isPrimaryIndication = selectedOpt?.type === PRIMARY_INDICATION_TYPE;

  // Fetch available characteristics for dropdown
  useEffect(() => {
    api.get(API_ENDPOINTS.CHARACTERISTICS)
      .then((response) => {
        setOptions(
          asApiList<CharacteristicOption>(response.data).map((obj) => ({
            _id: String(obj._id),
            type: obj.type,
            name: obj.name,
          }))
        );
      })
      .catch((err) => console.error("Failed to load characteristics:", err));
  }, []);

  // Compute size = parentSize * rate
  const size = useMemo(() => {
    return Math.round(parentSize * rate);
  }, [parentSize, rate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentId || !selectedId) return;
    setBusy(true);

    if (!selectedOpt) {
      console.error("Selected characteristic not found in options");
      setBusy(false);
      return;
    }

    const characteristicData: Record<string, string | number> = {
      _id: selectedOpt._id,
      char_type: selectedOpt.type,
      name: selectedOpt.name,
    };
    if (selectedOpt.type === PRIMARY_INDICATION_TYPE) {
      if (measureType !== "Prevalence" && measureType !== "Incidence") {
        alert("Select Prevalence or Incidence.");
        setBusy(false);
        return;
      }
      characteristicData.measure_type = measureType;
      const parsedYears = Number(measureYears);
      if (measureYears.trim() !== "") {
        if (!Number.isFinite(parsedYears) || parsedYears < 1) {
          alert("Enter a valid number of years (at least 1).");
          setBusy(false);
          return;
        }
        characteristicData.measure_years = parsedYears;
      }
    }

    const nodePart = {
      node_type: "characteristic",
      rate,
      size,
      characteristic_data: characteristicData,
    };

    // const childrenPayload = myChildForms.map(child => ({
    //   node_type:   child.node_type,      // e.g. "treatment"
    //   rate:        child.rate,
    //   size:        child.size,
    //   treatment_data: {                   // or characteristic_data / followup_data
    //     _id:   child._id,
    //     name:  child.name,
    //     /* …etc… */
    //   },
    //   // and if _those_ children have further children, you’d nest
    //   children: [ …more… ]
    // }));


    // const payload: any = {
    //   parent_node_id: parentId,
    //   node: {
    //     node_type: "characteristic",
    //     rate,
    //     size,
    //     characteristic_data: {
    //       _id: selectedId,
    //       char_type: selectedOpt.type,
    //       name: selectedOpt.name,
    //     },
    //   },
    //   // children: []
    // };

    const payload: Record<string, any> = {
      parent_node_id: parentId,
      node: nodePart,
    };

    if (childrenToAdd && childrenToAdd.length > 0) {
    payload.children = childrenToAdd;
  }

    try {
      const csrfToken = Cookies.get("csrf_token");

      const config = {
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken || "", 
        },
        withCredentials: true, 
    };

    console.log("Parent Node id:", parentId);
    
      await api.post(API_ENDPOINTS.ADD_NODE(patientId), payload, config);
      onSaved({ characteristicId: selectedId, rate });
    } catch (err: any) {
      console.error("Failed to add node:", err);
      const msg =
        err.response?.data?.error ??
        err.response?.data?.message ??
        "Failed to add node.";
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2} component="form" onSubmit={handleSubmit}>
      <FormControl fullWidth required>
        <Autocomplete
          options={options}
          getOptionLabel={(option) => `${option.type} – ${option.name}`}
          value={options.find((opt) => opt._id === selectedId) || null}
          onChange={(event, newValue) => {
            if (newValue) setSelectedId(newValue._id);
          }}
          renderInput={(params) => (
            <TextField {...params} label="Select Characteristic" required />
          )}
          isOptionEqualToValue={(option, value) => option._id === value._id}
        />
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

      {isPrimaryIndication && (
        <>
          <FormControl fullWidth required>
            <InputLabel id="measure-type-label">Measure type</InputLabel>
            <Select
              labelId="measure-type-label"
              value={measureType}
              label="Measure type"
              onChange={(e) =>
                setMeasureType(e.target.value as MeasureType | "")
              }
            >
              <MenuItem value="Prevalence">Prevalence</MenuItem>
              <MenuItem value="Incidence">Incidence</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Years"
            type="number"
            fullWidth
            value={measureYears}
            inputProps={{ min: 1, step: 1 }}
            onChange={(e) => setMeasureYears(e.target.value)}
            helperText="Number of years for this epidemiological measure"
          />
        </>
      )}

      <Button type="submit" variant="contained" disabled={busy}>
        Add Node
      </Button>
    </Stack>
  );
}
