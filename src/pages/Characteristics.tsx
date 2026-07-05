import React, { useState, useEffect } from "react";
import {
  TextField,
  Button,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { Save, Add } from "@mui/icons-material";
import api from "../api";
import CatalogPageLayout from "../components/catalog/CatalogPageLayout";
import CatalogListItemWithUsages from "../components/catalog/CatalogListItemWithUsages";
import { catalogEmptyStateSx, catalogFormActionsSx } from "../components/catalog/catalogPageStyles";
import { useCatalogEditSave } from "../components/catalog/useCatalogEditSave";
import { API_ENDPOINTS } from "../api/endpoints";
import { asApiList } from "../api/parseApiList";
import {
  POPULATION_CHAR_TYPE,
  PRIMARY_INDICATION_CHAR_TYPE,
} from "../utils/overviewNodeStyle";

interface Characteristic {
  _id: string;
  type: string;
  name: string;
}

const TYPE_OTHER = "__other__";

type TypeChoice =
  | typeof POPULATION_CHAR_TYPE
  | typeof PRIMARY_INDICATION_CHAR_TYPE
  | typeof TYPE_OTHER;

function resolveTypeChoice(charType: string): {
  typeChoice: TypeChoice;
  customType: string;
} {
  if (charType === POPULATION_CHAR_TYPE) {
    return { typeChoice: POPULATION_CHAR_TYPE, customType: "" };
  }
  if (charType === PRIMARY_INDICATION_CHAR_TYPE) {
    return { typeChoice: PRIMARY_INDICATION_CHAR_TYPE, customType: "" };
  }
  return { typeChoice: TYPE_OTHER, customType: charType };
}

function getEffectiveType(typeChoice: TypeChoice, customType: string): string {
  return typeChoice === TYPE_OTHER ? customType.trim() : typeChoice;
}

const Characteristics: React.FC = () => {
  const [typeChoice, setTypeChoice] = useState<TypeChoice>(POPULATION_CHAR_TYPE);
  const [customType, setCustomType] = useState("");
  const [name, setName] = useState("");
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [editingId, setEditingId] = useState("");
  const [errors, setErrors] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const isEditing = Boolean(editingId);
  const { confirmBeforePut, formatPutSuccess } =
    useCatalogEditSave("characteristic");

  const resetForm = () => {
    setEditingId("");
    setTypeChoice(POPULATION_CHAR_TYPE);
    setCustomType("");
    setName("");
  };

  const cancelEdit = () => {
    resetForm();
  };

  useEffect(() => {
    fetchCharacteristics();
  }, []);

  const fetchCharacteristics = async () => {
    try {
      const response = await api.get(API_ENDPOINTS.CHARACTERISTICS);
      setCharacteristics(asApiList<Characteristic>(response.data));
    } catch (error) {
      console.error("Error fetching characteristics:", error);
      setErrors("Error fetching characteristics.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wasEditing = Boolean(editingId);
    const type = getEffectiveType(typeChoice, customType);

    if (!type) {
      setErrors("Type is required.");
      return;
    }

    try {
      if (editingId) {
        if (!(await confirmBeforePut(editingId))) return;

        const response = await api.put(
          API_ENDPOINTS.CHARACTERISTIC_DETAIL(editingId),
          { type, name }
        );

        resetForm();
        setErrors("");
        fetchCharacteristics();
        alert(
          formatPutSuccess("Characteristic updated successfully!", response.data)
        );
        return;
      }

      await api.post(API_ENDPOINTS.CHARACTERISTICS, { type, name });

      resetForm();
      setErrors("");
      fetchCharacteristics();
      alert(
        wasEditing
          ? "Characteristic updated successfully!"
          : "Characteristic added successfully!"
      );
    } catch (error: any) {
      console.error("Submit Error:", error);
      const message =
        error.response?.data?.error || "Error saving characteristic.";
      setErrors(message);
      alert(message);
    }
  };

  const handleEdit = (char: Characteristic) => {
    const resolved = resolveTypeChoice(char.type);
    setTypeChoice(resolved.typeChoice);
    setCustomType(resolved.customType);
    setName(char.name);
    setEditingId(char._id);
  };

  const handleDelete = async (char_id: string) => {
    try {
      await api.delete(API_ENDPOINTS.CHARACTERISTIC_DETAIL(char_id));
      setErrors("");
      fetchCharacteristics();
      alert("Characteristic deleted successfully!");
    } catch (error: any) {
      console.error("Delete Error:", error);
      const message =
        error.response?.data?.error || "Error deleting characteristic.";
      setErrors(message);
      alert(message);
    }
  };

  const filtered = characteristics.filter(
    (char) =>
      char.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      char.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <CatalogPageLayout
      title="Characteristics"
      formTitle={isEditing ? "Edit characteristic" : "Add characteristic"}
      searchPlaceholder="Search"
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      listLabel="Catalog"
      error={errors || null}
      listEmpty={
        <Typography variant="body2" sx={catalogEmptyStateSx}>
          No characteristics yet.
        </Typography>
      }
      form={
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <FormControl fullWidth required size="small">
              <InputLabel id="char-type-label">Type</InputLabel>
              <Select
                labelId="char-type-label"
                value={typeChoice}
                label="Type"
                onChange={(e) => setTypeChoice(e.target.value as TypeChoice)}>
                <MenuItem value={POPULATION_CHAR_TYPE}>
                  {POPULATION_CHAR_TYPE}
                </MenuItem>
                <MenuItem value={PRIMARY_INDICATION_CHAR_TYPE}>
                  {PRIMARY_INDICATION_CHAR_TYPE}
                </MenuItem>
                <MenuItem value={TYPE_OTHER}>Other</MenuItem>
              </Select>
            </FormControl>
            {typeChoice === TYPE_OTHER && (
              <TextField
                fullWidth
                size="small"
                label="Custom type"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                required
              />
            )}
            {(typeChoice === POPULATION_CHAR_TYPE ||
              typeChoice === PRIMARY_INDICATION_CHAR_TYPE) && (
              <Typography variant="body2" color="text.secondary">
                {typeChoice === POPULATION_CHAR_TYPE
                  ? "Population characteristics are used as patient tree roots."
                  : "Primary Indication characteristics enable measure fields in patient trees."}
              </Typography>
            )}
            <TextField
              fullWidth
              size="small"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={catalogFormActionsSx}>
              {isEditing && (
                <Button variant="outlined" fullWidth onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
              <Button
                variant="contained"
                type="submit"
                fullWidth
                startIcon={isEditing ? <Save /> : <Add />}>
                {isEditing ? "Save changes" : "Add characteristic"}
              </Button>
            </Stack>
          </Stack>
        </form>
      }>
      {filtered.map((char) => (
        <CatalogListItemWithUsages
          key={char._id}
          catalogId={char._id}
          kind="characteristic"
          selected={editingId === char._id}
          primary={char.name}
          secondary={char.type}
          isPopulationCatalogHit={char.type === POPULATION_CHAR_TYPE}
          onEdit={() => handleEdit(char)}
          onDelete={() => handleDelete(char._id)}
        />
      ))}
    </CatalogPageLayout>
  );
};

export default Characteristics;
