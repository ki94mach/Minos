import React, { useEffect, useState } from "react";
import {
    Container,
    Typography,
    Card,
    CardContent,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from "@mui/material";
import axios from "axios";
import BackButton from "../components/BackButton";

const Patients: React.FC = () => {
    const [populations, setPopulations] = useState<string[]>([]);
    const [primaryIndications, setPrimaryIndications] = useState<string[]>([]);
    const [charTypes, setCharTypes] = useState<string[]>([]);
    const [charNames, setCharNames] = useState<string[]>([]);

    const [selectedPopulation, setSelectedPopulation] = useState<string>("");
    const [selectedPrimaryIndication, setSelectedPrimaryIndication] = useState<string>("");
    const [selectedCharType, setSelectedCharType] = useState<string>("");
    const [selectedCharName, setSelectedCharName] = useState<string>("");

    // Fetch patient characteristics from backend
    useEffect(() => {
        const fetchCharacteristics = async () => {
            try {
                const response = await axios.get("http://localhost:5000/api/characteristics");
                setPopulations(response.data.population || []);
                setPrimaryIndications(response.data.primary_indication || []);
                setCharTypes(response.data.other_characteristics_type || []);
                setCharNames(response.data.other_characteristics_name || []);
            } catch (error) {
                console.error("Error fetching patient characteristics:", error);
            }
        };
        fetchCharacteristics();
    }, []);

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post("http://localhost:5000/patients", {
                population: selectedPopulation,
                primary_indication: selectedPrimaryIndication,
                char_type: selectedCharType,
                char_name: selectedCharName,
            });
            alert("Search completed and patient map updated!");
        } catch (error) {
            console.error("Error during patient search:", error);
            alert("Failed to fetch patient data.");
        }
    };

    return (
        <Container maxWidth="md" sx={{ mt: 5 }}>
            <BackButton />
            <Typography variant="h3" align="center" sx={{ mb: 4 }}>
                Patient Map Management
            </Typography>

            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Typography variant="h5" gutterBottom>Search Patients</Typography>
                    <form onSubmit={handleSubmit}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Population</InputLabel>
                                    <Select
                                        value={selectedPopulation}
                                        onChange={(e) => setSelectedPopulation(e.target.value)}
                                        label="Population"
                                    >
                                        {populations.map((pop) => (
                                            <MenuItem key={pop} value={pop}>{pop}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Primary Indication</InputLabel>
                                    <Select
                                        value={selectedPrimaryIndication}
                                        onChange={(e) => setSelectedPrimaryIndication(e.target.value)}
                                        label="Primary Indication"
                                    >
                                        {primaryIndications.map((pi) => (
                                            <MenuItem key={pi} value={pi}>{pi}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Characteristic Type</InputLabel>
                                    <Select
                                        value={selectedCharType}
                                        onChange={(e) => setSelectedCharType(e.target.value)}
                                        label="Characteristic Type"
                                    >
                                        {charTypes.map((ctype) => (
                                            <MenuItem key={ctype} value={ctype}>{ctype}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Characteristic Name</InputLabel>
                                    <Select
                                        value={selectedCharName}
                                        onChange={(e) => setSelectedCharName(e.target.value)}
                                        label="Characteristic Name"
                                    >
                                        {charNames.map((cname) => (
                                            <MenuItem key={cname} value={cname}>{cname}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12}>
                                <Button type="submit" variant="contained" fullWidth>
                                    Search
                                </Button>
                            </Grid>
                        </Grid>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <Typography variant="h5" gutterBottom>Patient Map Visualization</Typography>
                    <iframe
                        src="http://localhost:5000/static/pyvis_graph.html"
                        width="100%"
                        height="600"
                        style={{ border: "none" }}
                        title="Patient Graph"
                    ></iframe>
                </CardContent>
            </Card>
        </Container>
    );
};

export default Patients;
