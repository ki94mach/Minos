import React, { useEffect, useState } from "react";
import {
  TextField,
  Button,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Stack,
} from "@mui/material";
import api from "../api";
import Cookies from "js-cookie";
import { Save, Add } from "@mui/icons-material";
import CatalogPageLayout from "../components/catalog/CatalogPageLayout";
import CatalogListItemWithUsages from "../components/catalog/CatalogListItemWithUsages";
import { catalogEmptyStateSx, catalogFormActionsSx } from "../components/catalog/catalogPageStyles";
import { useCatalogEditSave } from "../components/catalog/useCatalogEditSave";
import { formatDrugStrengthUnit } from "../utils/drugFormat";
import { API_ENDPOINTS } from "../api/endpoints";
import { asApiList } from "../api/parseApiList";

interface Drug {
  _id: string;
  name: string;
  strength?: number | null;
  unit?: string | null;
}

const DRUG_UNIT_OPTIONS = ["mg", "g", "ng", "mcg", "ml", "IU", "%"] as const;

const Drugs: React.FC = () => {
  const [name, setName] = useState("");
  const [strength, setStrength] = useState<number | "">("");
  const [unit, setUnit] = useState("");
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [errors, setErrors] = useState("");
  const isEditing = Boolean(editingId);
  const { confirmBeforePut, formatPutSuccess } = useCatalogEditSave("drug");

  const cancelEdit = () => {
    setEditingId("");
    setName("");
    setStrength("");
    setUnit("");
  };

  useEffect(() => {
    fetchDrugs();
  }, []);

  const fetchDrugs = async () => {
    setLoading(true);
    try {
      const response = await api.get(API_ENDPOINTS.DRUGS);
      setDrugs(asApiList<Drug>(response.data));
    } catch (error) {
      console.error("Error fetching drugs:", error);
      alert("Error loading drugs.");
    } finally {
      setLoading(false);
    }
  };

  const buildDrugPayload = () => ({
    name,
    strength: strength === "" ? null : Number(strength),
    unit: unit.trim() === "" ? null : unit.trim(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const csrfToken = Cookies.get("csrf_token");
      const config = {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken || "",
        },
      };

      if (editingId) {
        if (!(await confirmBeforePut(editingId))) return;

        const response = await api.put(
          API_ENDPOINTS.DRUG_DETAIL(editingId),
          buildDrugPayload(),
          config
        );
        setEditingId("");
        alert(formatPutSuccess("Drug updated successfully!", response.data));
      } else {
        await api.post(API_ENDPOINTS.DRUGS, buildDrugPayload(), config);
        alert("Drug added successfully!");
      }

      setName("");
      setStrength("");
      setUnit("");
      setErrors("");
      fetchDrugs();
    } catch (error: any) {
      console.error("Error adding drug:", error);
      const errorMessage = error.response?.data?.error || "Error adding drug.";
      setErrors(errorMessage);
      alert(errorMessage);
    }
  };

  const handleEdit = (drug: Drug) => {
    setEditingId(drug._id);
    setName(drug.name);
    setStrength(drug.strength ?? "");
    setUnit(drug.unit ?? "");
  };

  const handleDelete = async (id: string) => {
    try {
      const csrfToken = Cookies.get("csrf_token");
      await api.delete(API_ENDPOINTS.DRUG_DETAIL(id), {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken || "",
        },
      });
      setErrors("");
      fetchDrugs();
      alert("Drug deleted successfully!");
    } catch (error: any) {
      console.error("Error deleting drug:", error);
      const errorMessage = error.response?.data?.error || "Error deleting drug.";
      setErrors(errorMessage);
      alert(errorMessage);
    }
  };

  const filtered = drugs.filter((drug) =>
    drug.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDrugSecondary = (drug: Drug) => {
    const detail = formatDrugStrengthUnit(drug.strength, drug.unit);
    return detail || undefined;
  };

  return (
    <CatalogPageLayout
      title="Drugs"
      formTitle={isEditing ? "Edit drug" : "Add drug"}
      searchPlaceholder="Search drugs"
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      listLabel="Catalog"
      error={errors || null}
      listEmpty={
        <Typography variant="body2" sx={catalogEmptyStateSx}>
          {loading ? "Loading…" : "No drugs yet."}
        </Typography>
      }
      form={
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              fullWidth
              size="small"
              label="Drug name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="Strength"
                type="number"
                value={strength}
                onChange={(e) =>
                  setStrength(e.target.value ? Number(e.target.value) : "")
                }
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="unit-label">Unit</InputLabel>
                <Select
                  labelId="unit-label"
                  value={unit}
                  label="Unit"
                  displayEmpty
                  onChange={(e) => setUnit(e.target.value)}>
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {DRUG_UNIT_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                  {unit &&
                    !DRUG_UNIT_OPTIONS.includes(
                      unit as (typeof DRUG_UNIT_OPTIONS)[number]
                    ) && (
                      <MenuItem value={unit}>{unit}</MenuItem>
                    )}
                </Select>
              </FormControl>
            </Box>
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
                {isEditing ? "Save changes" : "Add drug"}
              </Button>
            </Stack>
          </Stack>
        </form>
      }>
      {filtered.map((drug) => (
        <CatalogListItemWithUsages
          key={drug._id}
          catalogId={drug._id}
          kind="drug"
          selected={editingId === drug._id}
          primary={drug.name}
          secondary={formatDrugSecondary(drug)}
          onEdit={() => handleEdit(drug)}
          onDelete={() => handleDelete(drug._id)}
        />
      ))}
    </CatalogPageLayout>
  );
};

export default Drugs;
