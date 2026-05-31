import React, { useState, useEffect } from "react";
import {
  Button,
  DialogActions,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
  Box,
  Typography,
} from "@mui/material";
import api from "../api";
import Cookies from "js-cookie";
import { API_ENDPOINTS } from "../api/endpoints";

interface OneChar {
  _id: string;
  type: string;
  name: string;
}

interface EditCharModalData {
  nodeId: string;     
  currentCharId: string;
  currentType: string;
  currentName: string;
  currentRate: number;
  currentSize?: number;
  isTreeRoot?: boolean;
  patientId: string;
  parentId: string;
}

interface EditCharacteristicFormProps {
  allChars: OneChar[];         
  editData: EditCharModalData;
  onCancel: () => void;       
  onSave: () => void;          
}

const EditCharacteristicForm: React.FC<EditCharacteristicFormProps> = ({
  allChars,
  editData,
  onCancel,
  onSave,
}) => {
  const {
    nodeId,
    patientId,
    currentCharId,
    currentType,
    currentName,
    currentRate,
    currentSize,
    isTreeRoot,
  } = editData;

  // Local state for the dropdown and rate:
  const [selectedCharId, setSelectedCharId] = useState<string>(currentCharId);
  const [selectedType, setSelectedType] = useState<string>(currentType);
  const [selectedName, setSelectedName] = useState<string>(currentName);
  const [rateValue, setRateValue] = useState<number>(currentRate);
  const [sizeValue, setSizeValue] = useState<string>(
    String(currentSize ?? 1)
  );

  useEffect(() => {
    const found: OneChar | undefined = allChars.find((c) => c._id === selectedCharId);
    if (found) {
      setSelectedType(found.type);
      setSelectedName(found.name);
    }
  }, [selectedCharId, allChars]);

  const handleSave = async () => {
    const csrfToken = Cookies.get("csrf_token");
      const config = {
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken || "",
        },
        withCredentials: true,
      };

    try {
      if (selectedType !== currentType || selectedName !== currentName) {
      await api.put(
        API_ENDPOINTS.CHARACTERISTIC_DETAIL(currentCharId),
        { type: selectedType, name: selectedName },
        config
      );
    }

      const nodePayload: { rate?: number; size?: number } = {};
      if (!isTreeRoot) {
        nodePayload.rate = rateValue;
      }
      if (isTreeRoot) {
        const parsedSize = Number(sizeValue);
        if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
          alert("Enter a valid population size greater than zero.");
          return;
        }
        nodePayload.size = parsedSize;
      }

      const response = await api.put(
        API_ENDPOINTS.UPDATE_NODE(patientId, nodeId),
        nodePayload,
        config
      );

      if (response.data?.message) {
        alert(response.data.message);
      } else {
        alert("Node updated successfully.");
      }

      onSave();
    } catch (error: any) {
      console.error("Save error:", error);
      const resp = error.response?.data || {};
      // prioritize `error`, then `message`, then dump the whole body
      let text = resp.error || resp.message || JSON.stringify(resp);
      // if there’s a details array, append it
      if (Array.isArray(resp.details)) {
        text += "\nDetails: " + resp.details.join("; ");
      }
      alert(text);
    }
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {/* 1) Dropdown to select among allChars */}
      <FormControl fullWidth>
        <InputLabel id="char-select-label">Characteristic</InputLabel>
        <Select
          labelId="char-select-label"
          value={selectedCharId}
          label="Characteristic"
          onChange={(e: SelectChangeEvent<string>) => {
            setSelectedCharId(e.target.value as string);
          }}
        >
          {allChars.map((c) => (
            <MenuItem key={c._id} value={c._id}>
              {`${c.type} → ${c.name}`}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* 2) Display the selected type & name (read‐only) */}
      <Box>
        <Typography variant="body2" color="textSecondary">
          Type: {selectedType}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Name: {selectedName}
        </Typography>
      </Box>

      {isTreeRoot ? (
        <TextField
          label="Population size"
          type="number"
          fullWidth
          value={sizeValue}
          inputProps={{ min: 1, step: 1 }}
          onChange={(e) => setSizeValue(e.target.value)}
          helperText="Total population size for this root node"
        />
      ) : (
        <TextField
          label="Rate"
          type="number"
          fullWidth
          value={rateValue}
          onChange={(e) => setRateValue(Number(e.target.value))}
        />
      )}

      {/* 4) Cancel / Save buttons */}
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Box>
  );
};

export default EditCharacteristicForm;
export type { EditCharModalData, OneChar };
