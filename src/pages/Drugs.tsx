import React, {useEffect, useState} from "react";
import { TextField, Button, Typography, Container, Card, CardContent, Select, MenuItem, FormControl, InputLabel, Box, IconButton } from "@mui/material";
import api from "../api";
import BackButton from "../components/BackButton";
import Cookies from "js-cookie";
import { Edit, Delete } from "@mui/icons-material";
import { API_ENDPOINTS } from "../api/endpoints";
import { asApiList } from "../api/parseApiList";


interface Drug {
    _id: string;
    name: string;
    strength: number;
    unit: string;
}

const Drugs: React.FC = () => {
    const [name, setName] = useState("");
    const [strength, setStrength] = useState<number | "">("");
    const [unit, setUnit] = useState("mg");
    const [drugs, setDrugs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [errors, setErrors] = useState("");


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
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (strength === "") {
            alert("Please enter a valid strength value");
            return;
        }
    
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
                await api.put(
                  API_ENDPOINTS.DRUG_DETAIL(editingId),
                  { name, strength: Number(strength), unit },
                  config
                );
                setEditingId("");
                alert("Drug updated successfully!");
              } else {
                await api.post(
                  API_ENDPOINTS.DRUGS,
                  { name, strength: Number(strength), unit },
                  config
                );
                alert("Drug added successfully!");
              }

            setName("");
            setStrength("");
            setUnit("mg");
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
        setStrength(drug.strength);
        setUnit(drug.unit);
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

    return (
        <Container maxWidth="md" sx={{ mt: 5 }}>
            <BackButton />
            <Typography variant="h4" gutterBottom>Drugs Management</Typography>

            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Typography variant="h5" gutterBottom>Add New Drug</Typography>
                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Drug Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            sx={{ mb: 2 }}
                        />
                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                            <TextField
                                fullWidth
                                label="Strength"
                                type="number"
                                value={strength}
                                onChange={(e) => setStrength(e.target.value ? Number(e.target.value) : "")}
                                required
                            />
                            <FormControl sx={{ minWidth: 120 }}>
                                <InputLabel id="unit-label">Unit</InputLabel>
                                <Select
                                    labelId="unit-label"
                                    value={unit}
                                    label="Unit"
                                    onChange={(e) => setUnit(e.target.value)}
                                >
                                    <MenuItem value="mg">mg</MenuItem>
                                    <MenuItem value="g">g</MenuItem>
                                    <MenuItem value="ml">ml</MenuItem>
                                    <MenuItem value="mcg">mcg</MenuItem>
                                    <MenuItem value="%">%</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                        <Button variant="contained" type="submit" fullWidth>Add Drug</Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
        <CardContent>
          <TextField
              fullWidth
              label="Search Drugs"
              variant="outlined"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ mb: 2 }}
          />
          <Typography variant="h5" gutterBottom>
            Existing Drugs
          </Typography>
          {loading ? (
            <Typography>Loading drugs...</Typography>
          ) : drugs.length > 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {drugs
                .filter((drug) =>
                  drug.name.toLowerCase().includes(searchTerm.toLowerCase())
                )
              .map((drug) => (
                <Card
                  key={drug._id}
                  variant="outlined"
                  sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <Typography>
                    {drug.name} - {drug.strength} {drug.unit}
                  </Typography>
                  <Box>
                    <IconButton onClick={() => handleEdit(drug)}>
                      <Edit />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(drug._id)}>
                      <Delete />
                    </IconButton>
                  </Box>
                </Card>
              ))}
            </Box>
          ) : (
            <Typography>No drugs found.</Typography>
          )}
        </CardContent>
      </Card>
      {/* {errors && (
      <Typography color="error" sx={{ mt: 2 }}>
          {errors}
      </Typography>
  )} */}
        </Container>
    );
    
  
};

export default Drugs;
