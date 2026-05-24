import React, { useState, useEffect } from "react";
import { TextField, Button, Stack, Typography } from "@mui/material";
import { Save, Add } from "@mui/icons-material";
import api from "../api";
import CatalogPageLayout from "../components/catalog/CatalogPageLayout";
import CatalogListItem from "../components/catalog/CatalogListItem";
import { catalogEmptyStateSx, catalogFormActionsSx } from "../components/catalog/catalogPageStyles";
import { API_ENDPOINTS } from "../api/endpoints";
import { asApiList } from "../api/parseApiList";

interface Characteristic {
  _id: string;
  type: string;
  name: string;
}

const Characteristics: React.FC = () => {
  const [type, setType] = useState("");
  const [name, setName] = useState("");
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [editingId, setEditingId] = useState("");
  const [errors, setErrors] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const isEditing = Boolean(editingId);

  const cancelEdit = () => {
    setEditingId("");
    setType("");
    setName("");
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

    try {
      if (editingId) {
        await api.put(API_ENDPOINTS.CHARACTERISTIC_DETAIL(editingId), {
          type,
          name,
        });
      } else {
        await api.post(API_ENDPOINTS.CHARACTERISTICS, { type, name });
      }

      setEditingId("");
      setType("");
      setName("");
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
    setType(char.type);
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
            <TextField
              fullWidth
              size="small"
              label="Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              required
            />
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
        <CatalogListItem
          key={char._id}
          selected={editingId === char._id}
          primary={char.name}
          secondary={char.type}
          onEdit={() => handleEdit(char)}
          onDelete={() => handleDelete(char._id)}
        />
      ))}
    </CatalogPageLayout>
  );
};

export default Characteristics;
