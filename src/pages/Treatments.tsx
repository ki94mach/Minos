import React, { useState, useEffect } from "react";
import {
    Container,
    Typography,
    Card,
    CardContent,
    TextField,
    Button,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    IconButton,
    List,
    ListItem,
    ListItemText,
    FormHelperText,
    Grid,
    Paper
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import axios from "axios";
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

interface Treatment {
    _id: string;
    name: string;
    type: string;
    regimen?: {
        drugs: DrugWithCon[];
    };
    alternatives?: {
        regimen: {
            drugs: DrugWithCon[];
        };
        ratio: number;
    }[];
}

const Treatments: React.FC = () => {
    // State for drug selection
    const [drugs, setDrugs] = useState<Drug[]>([]);
    const [treatments, setTreatments] = useState<Treatment[]>([]);
    const [loading, setLoading] = useState(false);

    // State for general treatment
    const [treatmentName, setTreatmentName] = useState("");
    const [treatmentType, setTreatmentType] = useState("Treatment");

    // State for regimen
    const [selectedDrugId, setSelectedDrugId] = useState("");
    const [annualPatientCon, setAnnualPatientCon] = useState<number>(0);
    const [regimenDrugs, setRegimenDrugs] = useState<DrugWithCon[]>([]);

    // State for alternatives
    const [alternativeRegimenDrugs, setAlternativeRegimenDrugs] = useState<DrugWithCon[]>([]);
    const [alternativeRatio, setAlternativeRatio] = useState<number>(0);
    const [alternatives, setAlternatives] = useState<{ regimen: { drugs: DrugWithCon[] }, ratio: number }[]>([]);

    // Fetch drugs and treatments on component mount
    useEffect(() => {
        fetchDrugs();
        fetchTreatments();
    }, []);

    const fetchDrugs = async () => {
        try {
            const response = await axios.get("http://localhost:5000/drugs");
            setDrugs(response.data);
        } catch (error) {
            console.error("Error fetching drugs:", error);
            alert("Error loading drugs.");
        }
    };

    const fetchTreatments = async () => {
        setLoading(true);
        try {
            const response = await axios.get("http://localhost:5000/treatments");
            setTreatments(response.data);
        } catch (error) {
            console.error("Error fetching treatments:", error);
            alert("Error loading treatments.");
        } finally {
            setLoading(false);
        }
    };

    // Function to add a drug to the regimen
    const addDrugToRegimen = () => {
        if (!selectedDrugId || annualPatientCon <= 0) {
            alert("Please select a drug and enter a valid annual patient consumption.");
            return;
        }

        const selectedDrug = drugs.find(drug => drug._id === selectedDrugId);
        if (!selectedDrug) return;

        const newDrugWithCon: DrugWithCon = {
            drug: selectedDrug,
            annual_patient_con: annualPatientCon
        };

        setRegimenDrugs([...regimenDrugs, newDrugWithCon]);
        setSelectedDrugId("");
        setAnnualPatientCon(0);
    };

    // Function to add a drug to the alternative regimen
    const addDrugToAlternativeRegimen = () => {
        if (!selectedDrugId || annualPatientCon <= 0) {
            alert("Please select a drug and enter a valid annual patient consumption.");
            return;
        }

        const selectedDrug = drugs.find(drug => drug._id === selectedDrugId);
        if (!selectedDrug) return;

        const newDrugWithCon: DrugWithCon = {
            drug: selectedDrug,
            annual_patient_con: annualPatientCon
        };

        setAlternativeRegimenDrugs([...alternativeRegimenDrugs, newDrugWithCon]);
        setSelectedDrugId("");
        setAnnualPatientCon(0);
    };

    // Function to add an alternative
    const addAlternative = () => {
        if (alternativeRegimenDrugs.length === 0 || alternativeRatio <= 0 || alternativeRatio > 1) {
            alert("Please add drugs to the alternative regimen and provide a valid ratio (0-1).");
            return;
        }

        const newAlternative = {
            regimen: {
                drugs: [...alternativeRegimenDrugs]
            },
            ratio: alternativeRatio
        };

        setAlternatives([...alternatives, newAlternative]);
        setAlternativeRegimenDrugs([]);
        setAlternativeRatio(0);
    };

    // Function to remove a drug from the regimen
    const removeDrugFromRegimen = (index: number) => {
        const updatedDrugs = [...regimenDrugs];
        updatedDrugs.splice(index, 1);
        setRegimenDrugs(updatedDrugs);
    };

    // Function to remove a drug from the alternative regimen
    const removeDrugFromAlternativeRegimen = (index: number) => {
        const updatedDrugs = [...alternativeRegimenDrugs];
        updatedDrugs.splice(index, 1);
        setAlternativeRegimenDrugs(updatedDrugs);
    };

    // Function to remove an alternative
    const removeAlternative = (index: number) => {
        const updatedAlternatives = [...alternatives];
        updatedAlternatives.splice(index, 1);
        setAlternatives(updatedAlternatives);
    };

    // Function to submit the treatment
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!treatmentName || !treatmentType) {
            alert("Please enter a treatment name and select a type.");
            return;
        }

        let payload: any = {
            name: treatmentName,
            type: treatmentType
        };

        if (treatmentType === "Regimen") {
            if (regimenDrugs.length === 0) {
                alert("Please add at least one drug to the regimen.");
                return;
            }
            payload.regimen = {
                drugs: regimenDrugs
            };
        } else if (treatmentType === "Alternative") {
            if (alternatives.length === 0) {
                alert("Please add at least one alternative.");
                return;
            }
            payload.alternatives = alternatives;
        }

        try {
            await axios.post("http://localhost:5000/treatments", payload);

            // Reset form
            setTreatmentName("");
            setTreatmentType("Treatment");
            setRegimenDrugs([]);
            setAlternatives([]);

            // Refresh the treatments list
            fetchTreatments();

            alert("Treatment added successfully!");
        } catch (error: any) {
            console.error("Error adding treatment:", error);
            const errorMessage = error.response?.data?.error || "Error adding treatment.";
            alert(errorMessage);
        }
    };

    return (
        <Container maxWidth="md" sx={{ mt: 5, mb: 5 }}>
            <BackButton />
            <Typography variant="h4" gutterBottom>Treatments Management</Typography>

            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Typography variant="h5" gutterBottom>Add New Treatment</Typography>
                    <form onSubmit={handleSubmit}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={8}>
                                <TextField
                                    fullWidth
                                    label="Treatment Name"
                                    value={treatmentName}
                                    onChange={(e) => setTreatmentName(e.target.value)}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth required>
                                    <InputLabel>Type</InputLabel>
                                    <Select
                                        value={treatmentType}
                                        onChange={(e) => setTreatmentType(e.target.value)}
                                        label="Type"
                                    >
                                        <MenuItem value="Treatment">Treatment</MenuItem>
                                        <MenuItem value="Regimen">Regimen</MenuItem>
                                        <MenuItem value="Alternative">Alternative</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        {treatmentType === "Regimen" && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="h6">Regimen Drugs</Typography>
                                <Grid container spacing={2} sx={{ mb: 2 }}>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth>
                                            <InputLabel>Select Drug</InputLabel>
                                            <Select
                                                value={selectedDrugId}
                                                onChange={(e) => setSelectedDrugId(e.target.value)}
                                                label="Select Drug"
                                            >
                                                {drugs.map((drug) => (
                                                    <MenuItem key={drug._id} value={drug._id}>
                                                        {drug.name} - {drug.strength} {drug.unit}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                        <TextField
                                            fullWidth
                                            type="number"
                                            label="Annual Patient Consumption"
                                            value={annualPatientCon}
                                            onChange={(e) => setAnnualPatientCon(Number(e.target.value))}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={2}>
                                        <Button
                                            variant="contained"
                                            onClick={addDrugToRegimen}
                                            fullWidth
                                            sx={{ height: '100%' }}
                                        >
                                            Add Drug
                                        </Button>
                                    </Grid>
                                </Grid>

                                <List>
                                    {regimenDrugs.map((drugWithCon, index) => (
                                        <ListItem
                                            key={index}
                                            secondaryAction={
                                                <IconButton edge="end" onClick={() => removeDrugFromRegimen(index)}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            }
                                        >
                                            <ListItemText
                                                primary={`${drugWithCon.drug.name} - ${drugWithCon.drug.strength} ${drugWithCon.drug.unit}`}
                                                secondary={`Annual Patient Consumption: ${drugWithCon.annual_patient_con}`}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        )}

                        {treatmentType === "Alternative" && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="h6">Alternative Regimens</Typography>

                                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                                    <Typography variant="subtitle1">Add Alternative Regimen</Typography>
                                    <Grid container spacing={2} sx={{ mb: 2 }}>
                                        <Grid item xs={12} md={6}>
                                            <FormControl fullWidth>
                                                <InputLabel>Select Drug</InputLabel>
                                                <Select
                                                    value={selectedDrugId}
                                                    onChange={(e) => setSelectedDrugId(e.target.value)}
                                                    label="Select Drug"
                                                >
                                                    {drugs.map((drug) => (
                                                        <MenuItem key={drug._id} value={drug._id}>
                                                            {drug.name} - {drug.strength} {drug.unit}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={12} md={4}>
                                            <TextField
                                                fullWidth
                                                type="number"
                                                label="Annual Patient Consumption"
                                                value={annualPatientCon}
                                                onChange={(e) => setAnnualPatientCon(Number(e.target.value))}
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={2}>
                                            <Button
                                                variant="contained"
                                                onClick={addDrugToAlternativeRegimen}
                                                fullWidth
                                                sx={{ height: '100%' }}
                                            >
                                                Add Drug
                                            </Button>
                                        </Grid>
                                    </Grid>

                                    <List>
                                        {alternativeRegimenDrugs.map((drugWithCon, index) => (
                                            <ListItem
                                                key={index}
                                                secondaryAction={
                                                    <IconButton edge="end" onClick={() => removeDrugFromAlternativeRegimen(index)}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                }
                                            >
                                                <ListItemText
                                                    primary={`${drugWithCon.drug.name} - ${drugWithCon.drug.strength} ${drugWithCon.drug.unit}`}
                                                    secondary={`Annual Patient Consumption: ${drugWithCon.annual_patient_con}`}
                                                />
                                            </ListItem>
                                        ))}
                                    </List>

                                    <Grid container spacing={2} sx={{ mt: 2 }}>
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                type="number"
                                                label="Ratio (0-1)"
                                                value={alternativeRatio}
                                                onChange={(e) => setAlternativeRatio(Number(e.target.value))}
                                                inputProps={{ min: 0, max: 1, step: 0.01 }}
                                            />
                                            <FormHelperText>Percentage of patients who will use this alternative</FormHelperText>
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <Button
                                                variant="contained"
                                                onClick={addAlternative}
                                                fullWidth
                                                sx={{ mt: 1 }}
                                            >
                                                Add Alternative
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </Paper>

                                <Typography variant="subtitle1">Added Alternatives:</Typography>
                                {alternatives.length > 0 ? (
                                        alternatives.map((alt, index) => (
                                            <Paper key={index} elevation={1} sx={{ p: 2, mb: 2 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Typography variant="subtitle2">
                                                        Alternative {index + 1} - Ratio: {alt.ratio}
                                                    </Typography>
                                                    <IconButton onClick={() => removeAlternative(index)}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Box>
                                                <Divider sx={{ mb: 2 }} />
                                                <List dense>
                                                    {alt.regimen.drugs.map((drugWithCon, drugIndex) => (
                                                        <ListItem key={drugIndex}>
                                                            <ListItemText
                                                                primary={`${drugWithCon.drug.name} - ${drugWithCon.drug.strength} ${drugWithCon.drug.unit}`}
                                                                secondary={`Annual Patient Consumption: ${drugWithCon.annual_patient_con}`}
                                                            />
                                                        </ListItem>
                                                    ))}
                                                </List>
                                            </Paper>
                                        ))
                                    ) : (
                                    <Typography variant="body2" color="text.secondary">
                                        No alternatives added yet.
                                    </Typography>
                                )}
                            </Box>
                        )}

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                type="submit"
                                variant="contained"
                                color="primary"
                                disabled={loading}
                            >
                                Add Treatment
                            </Button>
                        </Box>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <Typography variant="h5" gutterBottom>Existing Treatments</Typography>
                    {loading ? (
                        <Typography>Loading treatments...</Typography>
                    ) : treatments.length > 0 ? (
                        <List>
                            {treatments.map((treatment) => (
                                <Paper key={treatment._id} sx={{ mb: 2, p: 2 }}>
                                    <Typography variant="h6">{treatment.name}</Typography>
                                    <Typography variant="subtitle1" color="text.secondary">
                                        Type: {treatment.type}
                                    </Typography>

                                    {treatment.type === "Regimen" && treatment.regimen && (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="subtitle2">Drugs:</Typography>
                                            <List dense>
                                                {treatment.regimen.drugs.map((drugWithCon, index) => (
                                                    <ListItem key={index}>
                                                        <ListItemText
                                                            primary={`${drugWithCon.drug.name} - ${drugWithCon.drug.strength} ${drugWithCon.drug.unit}`}
                                                            secondary={`Annual Patient Consumption: ${drugWithCon.annual_patient_con}`}
                                                        />
                                                    </ListItem>
                                                ))}
                                            </List>
                                        </Box>
                                    )}

                                    {treatment.type === "Alternative" && treatment.alternatives && (
                                        <Box sx={{ mt: 2 }}>
                                            <Typography variant="subtitle2">Alternatives:</Typography>
                                            {treatment.alternatives.map((alt, altIndex) => (
                                                <Paper key={altIndex} elevation={0} sx={{ p: 1, mb: 1, bgcolor: 'background.default' }}>
                                                    <Typography variant="body2">Ratio: {alt.ratio}</Typography>
                                                    <List dense>
                                                        {alt.regimen.drugs.map((drugWithCon, drugIndex) => (
                                                            <ListItem key={drugIndex}>
                                                                <ListItemText
                                                                    primary={`${drugWithCon.drug.name} - ${drugWithCon.drug.strength} ${drugWithCon.drug.unit}`}
                                                                    secondary={`Annual Patient Consumption: ${drugWithCon.annual_patient_con}`}
                                                                />
                                                            </ListItem>
                                                        ))}
                                                    </List>
                                                </Paper>
                                            ))}
                                        </Box>
                                    )}
                                </Paper>
                            ))}
                        </List>
                    ) : (
                        <Typography>No treatments found.</Typography>
                    )}
                </CardContent>
            </Card>
        </Container>
    );
};

export default Treatments;