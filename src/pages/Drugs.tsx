import React, { useState } from "react";
import { TextField, Button, Typography, Container, Card, CardContent } from "@mui/material";
import axios from "axios";

const Drugs: React.FC = () => {
    const [name, setName] = useState("");
    const [strength, setStrength] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post("http://localhost:5000/drugs", { name, strength });
            setName("");
            setStrength("");
            alert("Drug added successfully!");
        } catch (error) {
            console.error(error);
            alert("Error adding drug.");
        }
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 5 }}>
            <Card>
                <CardContent>
                    <Typography variant="h4" gutterBottom>Drugs</Typography>
                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Drug Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Strength"
                            value={strength}
                            onChange={(e) => setStrength(e.target.value)}
                            required
                            sx={{ mb: 2 }}
                        />
                        <Button variant="contained" type="submit" fullWidth>Add Drug</Button>
                    </form>
                </CardContent>
            </Card>
        </Container>
    );
};

export default Drugs;
