import React, {useEffect, useState} from "react";
import { TextField, Button, Typography, Container, Card, CardContent, Select, MenuItem, FormControl, InputLabel, Box, Grid, TableContainer, TableCell, Table, TableHead, TableRow, TableBody, Paper } from "@mui/material";
import axios from "axios";
import BackButton from "../components/BackButton";

const FollowUps: React.FC = () => {
    const [followups, setFollowups] = useState<any[]>([]);
    const [name, setName] = useState("");
    const [overallSurvival, setOverallSurvival] = useState("");
    const [patientId, setPatientId] = useState("");
    const [parentId, setParentId] = useState("");

    useEffect(() => {
        fetchFollowups();
    }, []);

    const fetchFollowups = async () => {
        try {
            const response = await axios.get("http://localhost:5000/api/followups");
            setFollowups(response.data);
        } catch (error) {
            console.error("Error fetching followups:", error);
        }
    };

    const handleCreateFollowup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await axios.post("http://localhost:5000/api/followups", {
                name,
                overall_survival: parseFloat(overallSurvival),
                patient_id: patientId,
                parent_id: parentId
            });
            alert("Follow-up created successfully!");
            fetchFollowups();
        } catch (error) {
            console.error("Error creating follow-up:", error);
            alert("Failed to create follow-up.");
        }
    };

    const handleDeleteFollowup = async (id: string) => {
        try {
            await axios.delete(`http://localhost:5000/api/followups/${id}`);
            alert("Follow-up deleted successfully!");
            fetchFollowups();
        } catch (error) {
            console.error("Error deleting follow-up:", error);
            alert("Failed to delete follow-up.");
        }
    };

    return (
        <Container maxWidth="md" sx={{ mt: 5 }}>
            <BackButton />
            <Typography variant="h3" align="center" sx={{ mb: 4 }}>
                Follow-ups Management
            </Typography>

            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Typography variant="h5" gutterBottom>Create Follow-up</Typography>
                    <form onSubmit={handleCreateFollowup}>
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Follow-up Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Overall Survival"
                                    type="number"
                                    value={overallSurvival}
                                    onChange={(e) => setOverallSurvival(e.target.value)}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Patient ID"
                                    value={patientId}
                                    onChange={(e) => setPatientId(e.target.value)}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Parent ID"
                                    value={parentId}
                                    onChange={(e) => setParentId(e.target.value)}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Button type="submit" variant="contained" fullWidth>
                                    Create Follow-up
                                </Button>
                            </Grid>
                        </Grid>
                    </form>
                </CardContent>
            </Card>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Overall Survival</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {followups.map((followup) => (
                            <TableRow key={followup._id}>
                                <TableCell>{followup.name}</TableCell>
                                <TableCell>{followup.overall_survival}</TableCell>
                                <TableCell>
                                    <Button
                                        variant="outlined"
                                        color="secondary"
                                        onClick={() => handleDeleteFollowup(followup._id)}
                                    >
                                        Delete
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Container>
    );
};


export default FollowUps;
