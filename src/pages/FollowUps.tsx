import React, { useState, useEffect } from "react";
import {
    Container,
    Typography,
    Card,
    CardContent,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from "@mui/material";
import axios from "axios";

const FollowUps: React.FC = () => {
    const [patients, setPatients] = useState<{ id: string }[]>([]);
    const [selectedPatient, setSelectedPatient] = useState("");
    const [overallSurvival, setOverallSurvival] = useState<number | "">("");

    // Fetch the list of patients from the backend
    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const response = await axios.get("http://localhost:5000/api/characteristics");
                // Assuming the response includes patient data; adjust if needed
                if (response.data && response.data.population) {
                    setPatients(response.data.population.map((id: string) => ({ id })));
                }
            } catch (error) {
                console.error("Failed to fetch patients:", error);
            }
        };

        fetchPatients();
    }, []);

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post("http://localhost:5000/followups", {
                patient_id: selectedPatient,
                os_rate: overallSurvival,
            });

            // Reset form after successful submission
            setSelectedPatient("");
            setOverallSurvival("");
            alert("Follow-up added successfully!");
        } catch (error) {
            console.error("Error adding follow-up:", error);
            alert("Failed to add follow-up.");
        }
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 5 }}>
            <Card>
                <CardContent>
                    <Typography variant="h4" gutterBottom>
                        Follow-Up Management
                    </Typography>
                    <form onSubmit={handleSubmit}>
                        {/* Select Patient Dropdown */}
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Select Patient</InputLabel>
                            <Select
                                value={selectedPatient}
                                onChange={(e) => setSelectedPatient(e.target.value)}
                                required
                            >
                                {patients.map((patient) => (
                                    <MenuItem key={patient.id} value={patient.id}>
                                        {patient.id}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Overall Survival Input */}
                        <TextField
                            fullWidth
                            type="number"
                            label="Overall Survival"
                            value={overallSurvival}
                            onChange={(e) => setOverallSurvival(Number(e.target.value))}
                            inputProps={{ step: "0.01", min: "0", max: "1" }}
                            required
                            sx={{ mb: 2 }}
                        />

                        {/* Submit Button */}
                        <Button variant="contained" type="submit" fullWidth>
                            Add Follow-Up
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </Container>
    );
};

export default FollowUps;
