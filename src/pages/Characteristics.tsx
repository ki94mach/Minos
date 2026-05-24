import React, { useState, useEffect } from "react";
import { TextField, Button, Typography, Container, Card, CardContent, List, ListItem, ListItemText, IconButton, DialogTitle, Dialog } from "@mui/material";
import { Edit, Delete } from "@mui/icons-material";
import api from "../api";
import BackButton from "../components/BackButton";
import { API_ENDPOINTS } from "../api/endpoints";
import { asApiList } from "../api/parseApiList";

interface Characteristic {
    _id: string;
    type: string;
    name: string;
}

const Characteristics: React.FC = () => {
    const [type, setType] = useState("");
    const [name, setName] = useState("");
    const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
    const [editingId, setEditingId] = useState("");
    const [errors, setErrors] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [editChar, setEditChar] = useState<Characteristic | null>(null);

    useEffect(() => {
        fetchCharacteristics();
    }, []);

    const fetchCharacteristics = async () => {
        try {
            const response = await api.get(API_ENDPOINTS.CHARACTERISTICS);
            setCharacteristics(asApiList<Characteristic>(response.data));
        } catch (error) {
            console.error("Error fetching characteristics:", error);
            setErrors("Error fetching characteristics.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
    
        try {
            if (editingId) {
                await api.put(
                  API_ENDPOINTS.CHARACTERISTIC_DETAIL(editingId),
                  { type, name }
                );
                setEditingId("");
            } else {
                await api.post(API_ENDPOINTS.CHARACTERISTICS, { type, name });
            }
    
            setType("");
            setName("");
            setErrors("");
            fetchCharacteristics();
            alert("Characteristic saved successfully!");
        } catch (error: any) {
            console.error("Submit Error:", error);
        
            const message = error.response?.data?.error || "Error saving characteristic.";
            setErrors(message);
            alert(message);
        }
    };
    
    
    const handleEdit = (char: Characteristic) => {
        setType(char.type);
        setName(char.name);
        setEditingId(char._id);
        setEditChar(char);
    };

    const handleDelete = async (char_id: string) => {
        try {
            await api.delete(API_ENDPOINTS.CHARACTERISTIC_DETAIL(char_id));
            setErrors("");
            fetchCharacteristics();
            alert("Characteristic deleted successfully!");
        } catch (error: any) {
            console.error("Delete Error:", error);
        
            const message = error.response?.data?.error || "Error deleting characteristic.";
            setErrors(message);
            alert(message);
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

            {editChar && (
        <Dialog open onClose={() => setEditChar(null)}>
          <DialogTitle>Edit characteristic</DialogTitle>
          {/* <DialogContent>
            <CharacteristicForm
              initial={editChar}
              onSaved={() => { setEditChar(null); fetchCharacteristics(); }}
            />
          </DialogContent> */}
        </Dialog>
      )}
        </Container>

        
    );
   
};

export default Characteristics;
