import React, { useState } from "react";
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
    MenuItem
} from "@mui/material";
import BackButton from "../components/BackButton";

const Treatments: React.FC = () => {
    const [generalTreatment, setGeneralTreatment] = useState("");

    const [medicalRegimenName, setMedicalRegimenName] = useState("");
    const [selectedDrugs, setSelectedDrugs] = useState<string[]>([]);

    const [alternativeTreatmentName, setAlternativeTreatmentName] = useState("");
    const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);

    const drugOptions = ["Aspirin", "Ibuprofen", "Paracetamol"];
    const treatmentOptions = ["Treatment A", "Treatment B", "Treatment C"];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log({
            generalTreatment,
            medicalRegimenName,
            selectedDrugs,
            alternativeTreatmentName,
            selectedTreatments
        });
        alert("Treatments submitted successfully!");
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 5 }}>
                    <BackButton />
            <Card>
                <CardContent>
                    <Typography variant="h4" gutterBottom>
                        Treatments
                    </Typography>

                    <form onSubmit={handleSubmit}>
                        <Typography variant="h6" sx={{ mt: 3 }}>
                            General Treatment
                        </Typography>
                        <TextField
                            fullWidth
                            label="Name"
                            value={generalTreatment}
                            onChange={(e) => setGeneralTreatment(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        <Button variant="contained" type="button" sx={{ mb: 2 }}>
                            Add Treatment
                        </Button>

                        <Divider sx={{ my: 3 }} />

                        <Typography variant="h6">Medical Regimen</Typography>
                        <TextField
                            fullWidth
                            label="Name"
                            value={medicalRegimenName}
                            onChange={(e) => setMedicalRegimenName(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Drugs</InputLabel>
                            <Select
                                multiple
                                value={selectedDrugs}
                                onChange={(e) => setSelectedDrugs(e.target.value as string[])}
                                label="Drugs"
                            >
                                {drugOptions.map((drug) => (
                                    <MenuItem key={drug} value={drug}>
                                        {drug}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button variant="contained" type="button" sx={{ mb: 2 }}>
                            Add Regimen
                        </Button>

                        <Divider sx={{ my: 3 }} />

                        {/* Alternative Treatment Section */}
                        <Typography variant="h6">Alternative Treatment</Typography>
                        <TextField
                            fullWidth
                            label="Name"
                            value={alternativeTreatmentName}
                            onChange={(e) => setAlternativeTreatmentName(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Treatments</InputLabel>
                            <Select
                                multiple
                                value={selectedTreatments}
                                onChange={(e) => setSelectedTreatments(e.target.value as string[])}
                                label="Treatments"
                            >
                                {treatmentOptions.map((treatment) => (
                                    <MenuItem key={treatment} value={treatment}>
                                        {treatment}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button variant="contained" type="button">
                            Add Alternative
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </Container>
    );
};

export default Treatments;
