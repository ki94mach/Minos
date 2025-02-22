import React, { useState } from "react";
import { TextField, Button, Typography, Container, Card, CardContent } from "@mui/material";
import axios from "axios";

const Characteristics: React.FC = () => {
    const [type, setType] = useState("");
    const [name, setName] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post("http://localhost:5000/chars", { type, name });
            setType("");
            setName("");
            alert("Characteristic added successfully!");
        } catch (error) {
            console.error(error);
            alert("Error adding characteristic.");
        }
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 5 }}>
            <Card>
                <CardContent>
                    <Typography variant="h4" gutterBottom>Characteristics</Typography>
                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            label="Type"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            required
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            sx={{ mb: 2 }}
                        />
                        <Button variant="contained" type="submit" fullWidth>Add Characteristic</Button>
                    </form>
                </CardContent>
            </Card>
        </Container>
    );
};

export default Characteristics;
