import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import Cookies from "js-cookie";
import { TextField, Button, Stack, FormControl, Autocomplete } from "@mui/material";
import { API_ENDPOINTS } from "../api/endpoints";
import { asApiList } from "../api/parseApiList";

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
        annual_patient_con: number;
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
  const [busy, setBusy] = useState(false);

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

    const selectedOpt = options.find((opt) => opt._id === selectedId);
    if (!selectedOpt) {
      console.error("Selected characteristic not found in options");
      setBusy(false);
      return;
    }

    const nodePart = {
      node_type: "characteristic",
      rate,
      size,
      characteristic_data: {
        _id: selectedOpt._id,
        char_type: selectedOpt.type,
        name: selectedOpt.name,
      },
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
    } catch (err) {
      console.error("Failed to add node:", err);
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

      <Button type="submit" variant="contained" disabled={busy}>
        Add Node
      </Button>
    </Stack>
  );
}
