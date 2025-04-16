import React, { useState, useEffect } from "react";
import {
    Container, Typography, Card, CardContent, TextField, Button, Divider,
    FormControl, InputLabel, Select, MenuItem, Box, IconButton, List,
    ListItem, ListItemText, FormHelperText, Grid, Paper
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import axios from "axios";
import { v4 as uuidv4 } from "uuid"; // ✅ Used for temporary _id for alternatives
import BackButton from "../components/BackButton";

interface Drug {
    _id: string;
    name: string;
    strength: number;
    unit: string;
}

interface DrugWithCon {
    drug: Drug;
    annual_patient_con: number;
}

interface Alternative {
    _id?: string;
    name: string;
    ratio: number;
    regimen: {
        drugs: DrugWithCon[];
    };
}

interface Treatment {
    _id: string;
    name: string;
    type: string;
    regimen?: { drugs: DrugWithCon[] };
    alternatives?: Alternative[];
}

const Treatments: React.FC = () => {
    const [drugs, setDrugs] = useState<Drug[]>([]);
    const [treatments, setTreatments] = useState<Treatment[]>([]);

    const [treatmentName, setTreatmentName] = useState("");
    const [treatmentType, setTreatmentType] = useState("Treatment");

    const [selectedDrugId, setSelectedDrugId] = useState("");
    const [annualPatientCon, setAnnualPatientCon] = useState<number>(0);
    const [regimenDrugs, setRegimenDrugs] = useState<DrugWithCon[]>([]);

    const [alternativeRegimenDrugs, setAlternativeRegimenDrugs] = useState<DrugWithCon[]>([]);
    const [alternativeRatio, setAlternativeRatio] = useState<number>(0);
    const [alternativeName, setAlternativeName] = useState<string>("");
    const [alternatives, setAlternatives] = useState<Alternative[]>([]);

    useEffect(() => {
        fetchDrugs();
        fetchTreatments();
    }, []);

    const fetchDrugs = async () => {
        try {
            const response = await axios.get("http://localhost:5000/api/drugs");
            const parsedDrugs = response.data.map((item: string) => {
                const obj = JSON.parse(item);
                return {
                  ...obj,
                  _id: obj._id.$oid 
                };
              });
            setDrugs(parsedDrugs);
        } catch (error) {
            console.error("Error fetching drugs:", error);
        }
    };

    const fetchTreatments = async () => {
        try {
            const response = await axios.get("http://localhost:5000/api/treatments");
            const parsedTreatments = response.data.map((item: string) => JSON.parse(item));
            setTreatments(parsedTreatments);
        } catch (error) {
            console.error("Error fetching treatments:", error);
        }
    };

    const addDrug = (toAlternative = false) => {
        if (!selectedDrugId || annualPatientCon <= 0) {
            alert("Please select a drug and provide valid annual patient consumption.");
            return;
        }
        const selectedDrug = drugs.find(d => d._id === selectedDrugId);
        if (!selectedDrug) return;

        const drugWithCon: DrugWithCon = {
            drug: {
              ...selectedDrug,
              _id: selectedDrug._id 
            },
            annual_patient_con: annualPatientCon
          };
        
        toAlternative ? setAlternativeRegimenDrugs([...alternativeRegimenDrugs, drugWithCon])
            : setRegimenDrugs([...regimenDrugs, drugWithCon]);

        setSelectedDrugId("");
        setAnnualPatientCon(0);
    };

    const addAlternative = () => {
        if (!alternativeName || alternativeRatio <= 0 || alternativeRatio > 1) {
            alert("Add a name, valid ratio (0-1), and at least one drug to the alternative.");
            return;
        }
        const newAlt: Alternative = {
            _id: uuidv4(),
            name: alternativeName,
            ratio: alternativeRatio,
            regimen: {
                drugs: alternativeRegimenDrugs.map((item) => ({
                  drug: {
                    ...item.drug,
                    _id: item.drug._id, 
                  },
                  annual_patient_con: item.annual_patient_con,
                }))
              }
        };
        setAlternatives([...alternatives, newAlt]);
        setAlternativeRegimenDrugs([]);
        setAlternativeRatio(0);
        setAlternativeName("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload: any = {
            name: treatmentName,
            type: treatmentType
        };
        if (treatmentType === "Regimen") {
            if (regimenDrugs.length === 0) return alert("Add at least one drug to the regimen.");
            payload.regimen = { drugs: regimenDrugs };
        } else if (treatmentType === "Alternative") {
            if (alternatives.length === 0) return alert("Add at least one alternative.");
            payload.alternatives = alternatives;
        }
        try {
            await axios.post("http://localhost:5000/api/treatments", payload);
            fetchTreatments();
            resetForm();
            alert("Treatment added.");
        } catch (error: any) {
            alert(error.response?.data?.error || "Error adding treatment");
        }
    };

    const resetForm = () => {
        setTreatmentName("");
        setRegimenDrugs([]);
        setAlternatives([]);
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
            <BackButton />
            <Typography variant="h4" gutterBottom>Treatments</Typography>

            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Typography variant="h6">Add Treatment</Typography>
                    <form onSubmit={handleSubmit}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={8}>
                                <TextField fullWidth label="Treatment Name" value={treatmentName} onChange={(e) => setTreatmentName(e.target.value)} required />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <FormControl fullWidth required>
                                    <InputLabel>Type</InputLabel>
                                    <Select value={treatmentType} onChange={(e) => setTreatmentType(e.target.value)} label="Type">
                                        <MenuItem value="Treatment">Treatment</MenuItem>
                                        <MenuItem value="Regimen">Regimen</MenuItem>
                                        <MenuItem value="Alternative">Alternative</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        {treatmentType === "Treatment" && (
                        <Box mt={3}>
                            <Typography variant="body1" color="textSecondary">
                            Basic treatment. No regimen or alternatives required.
                            </Typography>
                        </Box>
                        )}

                        {/* Regimen Section */}
                        {treatmentType === "Regimen" && (
                            <Box mt={3}>
                                <Typography variant="subtitle1">Regimen Drugs</Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <FormControl fullWidth>
                                            <InputLabel>Select Drug</InputLabel>
                                            <Select value={selectedDrugId} onChange={(e) => setSelectedDrugId(e.target.value)} label="Select Drug">
                                                {drugs.map(drug => (
                                                    <MenuItem key={drug._id} value={drug._id}>{drug.name} - {drug.strength} {drug.unit}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={4}>
                                        <TextField type="number" fullWidth label="Annual Patient Con" value={annualPatientCon} onChange={(e) => setAnnualPatientCon(Number(e.target.value))} />
                                    </Grid>
                                    <Grid item xs={2}>
                                        <Button variant="contained" onClick={() => addDrug(false)} fullWidth>Add</Button>
                                    </Grid>
                                </Grid>
                                <List>
                                    {regimenDrugs.map((item, i) => (
                                        <ListItem key={i} secondaryAction={<IconButton onClick={() => setRegimenDrugs(regimenDrugs.filter((_, idx) => idx !== i))}><DeleteIcon /></IconButton>}>
                                            <ListItemText primary={`${item.drug.name} - ${item.drug.strength} ${item.drug.unit}`} secondary={`Annual Con: ${item.annual_patient_con}`} />
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        )}

                        {/* Alternative Section */}
                        {treatmentType === "Alternative" && (
                            <Box mt={3}>
                                <Typography variant="subtitle1">Add Alternative Regimen</Typography>
                                <TextField label="Alternative Name" value={alternativeName} onChange={(e) => setAlternativeName(e.target.value)} fullWidth sx={{ mb: 2 }} />
                                <Grid container spacing={2}>
                                    
                                    
                                    
                                </Grid>
                                <List>
                                    {alternativeRegimenDrugs.map((item, i) => (
                                        <ListItem key={i} secondaryAction={<IconButton onClick={() => setAlternativeRegimenDrugs(alternativeRegimenDrugs.filter((_, idx) => idx !== i))}><DeleteIcon /></IconButton>}>
                                            <ListItemText primary={`${item.drug.name} - ${item.drug.strength} ${item.drug.unit}`} secondary={`Annual Con: ${item.annual_patient_con}`} />
                                        </ListItem>
                                    ))}
                                </List>
                                <TextField type="number" fullWidth label="Ratio (0-1)" value={alternativeRatio} onChange={(e) => setAlternativeRatio(Number(e.target.value))} inputProps={{ min: 0, max: 1, step: 0.01 }} sx={{ mt: 2 }} />
                                <Button variant="outlined" onClick={addAlternative} sx={{ mt: 2 }}>Add Alternative</Button>
                                <Divider sx={{ mt: 3, mb: 1 }} />
                                <Typography variant="subtitle2">Current Alternatives:</Typography>
                                {alternatives.map((alt, i) => (
                                    <Paper key={i} sx={{ p: 2, mb: 2 }}>
                                        <Typography variant="body2"><strong>{alt.name}</strong> (Ratio: {alt.ratio})</Typography>
                                    
                                        <Button size="small" color="error" onClick={() => setAlternatives(alternatives.filter((_, idx) => idx !== i))}>Remove</Button>
                                    </Paper>
                                ))}
                            </Box>
                        )}

                        <Box sx={{ mt: 3, textAlign: "right" }}>
                            <Button type="submit" variant="contained">Submit</Button>
                        </Box>
                    </form>
                </CardContent>
            </Card>
        </Container>
    );
};

export default Treatments;