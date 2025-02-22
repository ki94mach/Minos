import React, { useState, useEffect } from "react";
import { fetchPrimaryIndications } from "../api";
import ReactSelect from "react-select";
import {
    Container,
    Typography,
    Card,
    CardContent,
    MenuItem,
    FormControl,
    Select,
    InputLabel,
    Grid,
    TextField
} from "@mui/material";
import axios from "axios";

interface OptionType {
    value: string;
    label: string;
}
const Home: React.FC = () => {
    const [population, setPopulation] = useState("");
    const [primaryIndication, setPrimaryIndication] = useState("");
    const [primaryIndications, setPrimaryIndications] = useState<OptionType[]>([]);

    const [medicalRegimenDrugs, setMedicalRegimenDrugs] = useState<OptionType[]>([]);
    const [drugInputs, setDrugInputs] = useState<{ [key: string]: number }>({});

    const [alternativeTreatments, setAlternativeTreatments] = useState<OptionType[]>([]);
    const [rateInputs, setRateInputs] = useState<{ [key: string]: number }>({});

    const populationOptions = [
        { value: "1", label: "Population 1" },
        { value: "2", label: "Population 2" },
    ];

    useEffect(() => {
        if (population) {
            fetchPrimaryIndications(population).then((data) => {
                const formattedIndications = data.map((ind: { name: string }) => ({
                    value: ind.name,
                    label: ind.name,
                }));
                setPrimaryIndications(formattedIndications);
            });
        }
    }, [population]);

    const handleDrugChange = (selectedOptions: readonly OptionType[] | null) => {
        const newDrugInputs: { [key: string]: number } = {};
        if (selectedOptions) {
            selectedOptions.forEach((drug) => {
                newDrugInputs[drug.value] = 0;
            });
        }
        setMedicalRegimenDrugs(selectedOptions ? [...selectedOptions] : []);
        setDrugInputs(newDrugInputs);
    };

    const handleAlternativeChange = (selectedOptions: readonly OptionType[] | null) => {
        const newRateInputs: { [key: string]: number } = {};
        if (selectedOptions) {
            selectedOptions.forEach((treatment) => {
                newRateInputs[treatment.value] = 1.0; // Default rate set to 1.0
            });
        }
        setAlternativeTreatments(selectedOptions ? [...selectedOptions] : []);
        setRateInputs(newRateInputs);
    };

    const filterPatientGraph = async (patientId: string) => {
        try {
            const response = await axios.get(`/filter_patient/${patientId}`);
            console.log(response.data.message);
        } catch (error) {
            alert("Failed to filter the graph for the selected patient.");
        }
    };

    return (
        <Container maxWidth="sm">
            <Typography variant="h3" align="center" sx={{ my: 4, fontWeight: "bold" }}>
                Minos Project
            </Typography>

            <Card sx={{ p: 3, boxShadow: 3, borderRadius: 2 }}>
                <CardContent>
                    <Grid container spacing={3}>
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

                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Primary Indication</InputLabel>
                                <Select value={primaryIndication} onChange={(e) => setPrimaryIndication(e.target.value)} label="Primary Indication">
                                    {primaryIndications.length === 0 ? (
                                        <MenuItem disabled>No options available</MenuItem>
                                    ) : (
                                        primaryIndications.map((ind) => (
                                            <MenuItem key={ind.value} value={ind.value}>
                                                {ind.label}
                                            </MenuItem>
                                        ))
                                    )}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Medical Regimen Drugs */}
                        <Grid item xs={12}>
                            <Typography variant="h6">Medical Regimen Drugs</Typography>
                            <ReactSelect
                                isMulti
                                placeholder="Select drugs"
                                options={[
                                    { value: "Aspirin|100 mg", label: "Aspirin 100 mg" },
                                    { value: "Ibuprofen|200 mg", label: "Ibuprofen 200 mg" },
                                ]}
                                value={medicalRegimenDrugs}
                                onChange={handleDrugChange}
                            />
                            {Object.entries(drugInputs).map(([drug, value]) => (
                                <TextField
                                    key={drug}
                                    label={`Annual Consumption for ${drug.split("|")[0]}`}
                                    type="number"
                                    value={value}
                                    onChange={(e) => setDrugInputs({ ...drugInputs, [drug]: Number(e.target.value) })}
                                    fullWidth
                                    sx={{ mt: 2 }}
                                />
                            ))}
                        </Grid>

                        {/* Alternative Treatments */}
                        <Grid item xs={12}>
                            <Typography variant="h6">Alternative Treatments</Typography>
                            <ReactSelect
                                isMulti
                                placeholder="Select treatments"
                                options={[
                                    { value: "Treatment A", label: "Treatment A" },
                                    { value: "Treatment B", label: "Treatment B" },
                                ]}
                                value={alternativeTreatments}
                                onChange={handleAlternativeChange}
                            />
                            {Object.entries(rateInputs).map(([treatment, value]) => (
                                <TextField
                                    key={treatment}
                                    label={`Rate for ${treatment}`}
                                    type="number"
                                    value={value}
                                    onChange={(e) => setRateInputs({ ...rateInputs, [treatment]: Number(e.target.value) })}
                                    inputProps={{ step: 0.01, min: 0, max: 1 }}
                                    fullWidth
                                    sx={{ mt: 2 }}
                                />
                            ))}
                        </Grid>

                        {/* Graph Visualization */}
                        <Grid item xs={12}>
                            <Typography variant="h6">Patient Graph</Typography>
                            <iframe
                                src="http://localhost:5000/static/pyvis_graph.html"
                                width="100%"
                                height="600"
                                title="Patient Graph"
                                style={{ border: "1px solid #ddd" }}
                            ></iframe>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </Container>
    );
};

export default Home;
