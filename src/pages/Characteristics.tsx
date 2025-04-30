import React, { useState, useEffect } from "react";
import { TextField, Button, Typography, Container, Card, CardContent, List, ListItem, ListItemText, IconButton } from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";
import axios from "axios";
import BackButton from "../components/BackButton";
import Cookies from "js-cookie";

interface Characteristic {
    _id: string;
    type: string;
    name: string;
}

const Characteristics: React.FC = () => {
    const [type, setType] = useState("");
    const [name, setName] = useState("");
    const [characteristics, setCharacteristics] = useState([]);
    const [editingId, setEditingId] = useState("");
    const [errors, setErrors] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchCharacteristics();
    }, []);

    const fetchCharacteristics = async () => {
        try {
            const response = await axios.get("http://localhost:5000/api/characteristics");
            const parsed = response.data.map((item: string) => {
                const obj = JSON.parse(item);
                return { ...obj, _id: obj._id.$oid };
              });

    setCharacteristics(parsed);
        } catch (error) {
            console.error("Error fetching characteristics:", error);
            setErrors("Error fetching characteristics.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
    
        try {
            const csrfToken = Cookies.get("csrf_token");
    
            const config = {
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken || "", 
                },
                withCredentials: true, 
            };
    
            if (editingId) {
                await axios.put(
                    `http://localhost:5000/api/characteristics/${editingId}`,
                    { type, name },
                    config
                );
                setEditingId("");
            } else {
                await axios.post(
                    "http://localhost:5000/api/characteristics",
                    { type, name },
                    config
                );
            }
    
            setType("");
            setName("");
            fetchCharacteristics();
            alert("Characteristic saved successfully!");
        } catch (error) {
            console.error(error);
            alert("Error saving characteristic.");
        }
    };
    
    
    const handleEdit = (char: Characteristic) => {
        setType(char.type);
        setName(char.name);
        setEditingId(char._id);
    };

    const handleDelete = async (char_id: string) => {
        try {
            const csrfToken = Cookies.get("csrf_token");

            await axios.delete(`http://localhost:5000/api/characteristics/${char_id}`, {
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken || "",
            },
            withCredentials: true,
        });
            fetchCharacteristics();
            alert("Characteristic deleted successfully!");
        } catch (error) {
            console.error("Error deleting characteristic:", error);
            alert("Error deleting characteristic.");
        }
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 5 }}>
            <BackButton />
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
                    {errors && <Typography color="error">{errors}</Typography>}
                    <List sx={{ backgroundColor: "#f0f0f0"}}>
                        <TextField
                            fullWidth
                            label="Search Characteristics"
                            variant="outlined"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        {characteristics
                            .filter((char: Characteristic) =>
                                char.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                char.type.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                        .map((char: Characteristic) => (
                            <ListItem key={char._id} sx={{ borderBottom: '1px solid #ccc', py: 1 }} secondaryAction={
                                <>
                                    
                                    <IconButton edge="end" aria-label="edit" onClick={() => handleEdit(char)}>
                                        <Edit />
                                    </IconButton>
                                    <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(char._id)}>
                                        <Delete />
                                    </IconButton>
                                </>
                            }>
                                <ListItemText
                                    primary={<Typography sx={{ color: "#000" }}>{char.name}</Typography>}
                                    secondary={<Typography sx={{ color: "#555" }}>{char.type}</Typography>}
                                />
                            </ListItem>
                        ))}
                    </List>
                </CardContent>
            </Card>
        </Container>
    );
};

export default Characteristics;
