import React, { useState, useEffect } from "react";
import { fetchPrimaryIndications } from "../api";
import { Container, Typography, Card, CardContent, MenuItem, FormControl, Select, InputLabel, Grid } from "@mui/material";

const Home: React.FC = () => {
    const [population, setPopulation] = useState("");
    const [primaryIndication, setPrimaryIndication] = useState("");
    const [primaryIndications, setPrimaryIndications] = useState<string[]>([]);

    const populationOptions = [
        { value: "1", label: "Population 1" },
        { value: "2", label: "Population 2" },
    ];

    useEffect(() => {
        if (population) {
            fetchPrimaryIndications(population).then((data) => {
                setPrimaryIndications(data.map((ind: { name: string }) => ind.name));
            });
        }
    }, [population]);

    return (
        <Container maxWidth="sm">
            <Typography variant="h3" align="center" sx={{ my: 4, fontWeight: "bold" }}>
                Minos Project UI
            </Typography>

            <Card sx={{ p: 3, boxShadow: 3, borderRadius: 2 }}>
                <CardContent>
                    <Grid container spacing={3}>
                        {/* Population Dropdown */}
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Population</InputLabel>
                                <Select value={population} onChange={(e) => setPopulation(e.target.value)} label="Population">
                                    {populationOptions.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Primary Indication Dropdown */}
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Primary Indication</InputLabel>
                                <Select value={primaryIndication} onChange={(e) => setPrimaryIndication(e.target.value)} label="Primary Indication">
                                    {primaryIndications.length === 0 ? (
                                        <MenuItem disabled>No options available</MenuItem>
                                    ) : (
                                        primaryIndications.map((ind) => (
                                            <MenuItem key={ind} value={ind}>
                                                {ind}
                                            </MenuItem>
                                        ))
                                    )}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </Container>
    );
};

export default Home;
