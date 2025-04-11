import React, {useEffect, useState} from "react";
import { TextField, Button, Typography, Container, Card, CardContent, Select, MenuItem, FormControl, InputLabel, Box } from "@mui/material";
import axios from "axios";
import BackButton from "../components/BackButton";

const Drugs: React.FC = () => {
    const [name, setName] = useState("");
    const [strength, setStrength] = useState<number | "">("");
    const [unit, setUnit] = useState("mg");
    const [drugs, setDrugs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDrugs();
    }, []);

    const fetchDrugs = async () => {
        setLoading(true);
        try {
            const response = await axios.get("http://localhost:5000/api/drugs");
            setDrugs(response.data);
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
            await axios.post("http://localhost:5000/api/drugs", {
                name,
                strength: Number(strength),
                unit
            });

            // Clear form
            setName("");
            setStrength("");
            setUnit("mg");

            // Refresh the drug list
            fetchDrugs();

            alert("Drug added successfully!");
        } catch (error: any) {
            console.error("Error adding drug:", error);
            const errorMessage = error.response?.data?.error || "Error adding drug.";
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
                    <Typography variant="h5" gutterBottom>Existing Drugs</Typography>
                    {loading ? (
                        <Typography>Loading drugs...</Typography>
                    ) : drugs.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {drugs.map((drug) => (
                                <Card key={drug.id} variant="outlined" sx={{ p: 2 }}>
                                    <Typography>
                                        {drug.name} - {drug.strength} {drug.unit}
                                    </Typography>
                                </Card>
                            ))}
                        </Box>
                    ) : (
                        <Typography>No drugs found.</Typography>
                    )}
                </CardContent>
            </Card>
        </Container>
    );
};

export default Drugs;
