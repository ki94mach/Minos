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
import axios from "axios";
import Cookies from "js-cookie";

interface OneChar {
  _id: string;
  type: string;
  name: string;
}

interface EditCharModalData {
  nodeId: string;       // the characteristic node’s ID in React-Flow
  currentCharId: string;
  currentType: string;
  currentName: string;
  currentRate: number;
  patientId: string;
  parentId: string;
}

interface EditCharacteristicFormProps {
  allChars: OneChar[];         // list of all characteristics
  editData: EditCharModalData; // the data for the node being edited 
  onCancel: () => void;        // close modal w/o saving
  onSave: () => void;          // called after successful save
}

// 👇 Correct syntax for a React.FC with typed props:
const EditCharacteristicForm: React.FC<EditCharacteristicFormProps> = ({
  allChars,
  editData,
  onCancel,
  onSave,
}) => {
  const { nodeId, patientId, currentCharId, currentType, currentName, currentRate, parentId } = editData;

  // Local state for the dropdown and rate:
  const [selectedCharId, setSelectedCharId] = useState<string>(currentCharId);
  const [selectedType, setSelectedType] = useState<string>(currentType);
  const [selectedName, setSelectedName] = useState<string>(currentName);
  const [rateValue, setRateValue] = useState<number>(currentRate);  

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
      await axios.put(
        `http://localhost:5000/api/characteristics/${currentCharId}`,
        { type: selectedType, name: selectedName },
        config
      );
    }

        const response = await axios.put(
          `http://localhost:5000/api/patients/${patientId}/node/${nodeId}`, 
          { rate: rateValue },
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

      {/* 3) Editable “rate” text field */}
      <TextField
        label="Rate"
        type="number"
        fullWidth
        value={rateValue}
        onChange={(e) => setRateValue(Number(e.target.value))}
      />

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
