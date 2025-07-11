import React, { useState, useEffect } from "react";
import {
    Container, Typography, Card, CardContent, TextField, Button, Divider,
    FormControl, InputLabel, Select, MenuItem, Box, IconButton, List,
    ListItem, ListItemText, FormHelperText, Grid, Paper, Autocomplete
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import api from "../api";
import BackButton from "../components/BackButton";
import { Edit, Delete } from "@mui/icons-material";
import Cookies from "js-cookie";
import { API_ENDPOINTS } from "../api/endpoints";

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

    const [name, setName] = useState("");
    const [treatmentType, setTreatmentType] = useState("Treatment");

    const [selectedDrugId, setSelectedDrugId] = useState("");
    const [annualConsumption, setAnnualConsumption] = useState<number>(0);
    const [regimenDrugs, setRegimenDrugs] = useState<DrugWithCon[]>([]);

    const [alternativeRegimenDrugs, setAlternativeRegimenDrugs] = useState<DrugWithCon[]>([]);
    const [alternativeRatio, setAlternativeRatio] = useState<number>(0);
    const [alternatives, setAlternatives] = useState<Alternative[]>([]);
    const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null);
    const regimenOptions = treatments.filter(t => t.type === "Regimen");
    const [selectedRegimenId, setSelectedRegimenId] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [errors, setErrors] = useState<string>("");


    useEffect(() => {
        fetchDrugs();
        fetchTreatments();
    }, []);

    const fetchDrugs = async () => {
        try {
            const response = await api.get(API_ENDPOINTS.DRUGS);
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
            const response = await api.get(API_ENDPOINTS.TREATMENTS);
            const parsedTreatments = response.data.map((item: string) => {
                const obj = JSON.parse(item);
                return { ...obj, _id: obj._id.$oid };
              });
            setTreatments(parsedTreatments);
        } catch (error) {
            console.error("Error fetching treatments:", error);
        }
    };

    const addDrug = (toAlternative = false) => {
        if (!selectedDrugId || annualConsumption <= 0) {
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
            annual_patient_con: annualConsumption
          };
        
        toAlternative ? setAlternativeRegimenDrugs([...alternativeRegimenDrugs, drugWithCon])
            : setRegimenDrugs([...regimenDrugs, drugWithCon]);

        setSelectedDrugId("");
        setAnnualConsumption(0);
    };

    const addAlternative = () => {
        if (!selectedRegimenId || alternativeRatio <= 0 || alternativeRatio > 1) {
          alert("Select a regimen and a valid ratio (0-1).");
          return;
        }
      
        const selectedRegimen = regimenOptions.find(r => r._id === selectedRegimenId);
        if (!selectedRegimen || !selectedRegimen.regimen) {
          alert("Selected regimen not found.");
          return;
        }
      
        const newAlt: Alternative = {
          _id: selectedRegimen._id,
          // name: selectedRegimen.name,
          name: treatments.find(t => t._id === selectedRegimen._id)?.name || selectedRegimen.name, 
          ratio: alternativeRatio,
          regimen: selectedRegimen.regimen,
          // regimen: {
          //   drugs: selectedRegimen.regimen.drugs.map(item => ({
          //     drug: {
          //       ...item.drug,
          //       _id: typeof item.drug._id === "object" && "$oid" in item.drug._id
          //         ? (item.drug._id as any)["$oid"]
          //         : item.drug._id,
          //     },
          //     annual_patient_con: item.annual_patient_con,
          //   }))
          // }
        };
      
        setAlternatives(prev => [...prev, newAlt]);
        setSelectedRegimenId("");
        setAlternativeRatio(0);
      };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
      
        const payload: any = {
          name: name,
          type: treatmentType,
        };
      
        if (treatmentType === "Regimen") {
          if (regimenDrugs.length === 0) return alert("Add at least one drug to the regimen.");
          payload.regimen = {
            drugs: regimenDrugs.map((item) => ({
              drug: {
                ...item.drug,
                _id: item.drug._id, 
              },
              annual_patient_con: item.annual_patient_con,
            })),
          };
        } else if (treatmentType === "Alternative") {
          if (alternatives.length === 0) return alert("Add at least one alternative.");
          payload.alternatives = alternatives.map((alt) => ({
            _id: typeof alt._id === "object" && "$oid" in alt._id
            ? alt._id["$oid"]
            : alt._id,
            name: alt.name,
            ratio: alt.ratio,
            regimen: {
                drugs: alt.regimen.drugs.map((item) => ({
                    drug: {
                        _id: typeof item.drug._id === "object" && "$oid" in item.drug._id
                          ? item.drug._id["$oid"]
                          : item.drug._id,
                        name: item.drug.name,
                        strength: item.drug.strength,
                        unit: item.drug.unit
                      },
                  annual_patient_con: item.annual_patient_con,
                })),
              },
            }));
            // delete payload.regimen; 
        }
        console.log("Submitting Payload: ", JSON.stringify(payload, null, 2));

        try {
            const csrfToken = Cookies.get("csrf_token");
    
            const config = {
                withCredentials: true,
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken || "", 
                },
            };
    
          console.log("Submitting payload:", JSON.stringify(payload, null, 2));

          if (editingTreatmentId) {
            await api.put(
              API_ENDPOINTS.TREATMENT_DETAIL(editingTreatmentId),
              payload,
              config
            );
            alert("Treatment updated.");
          } else {
            await api.post(API_ENDPOINTS.TREATMENTS, payload, config);
            alert("Treatment added.");
          }
          setErrors("");
          fetchTreatments();
          resetForm();
          setEditingTreatmentId(null); 
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || "Error submitting treatment";
          setErrors(errorMessage); 
          alert(errorMessage); 
        }
      };
      
      
    const resetForm = () => {
        setName("");
        setRegimenDrugs([]);
        setAlternatives([]);
    };

    const handleEdit = (treatment: Treatment) => {
        setEditingTreatmentId(treatment._id);
        setName(treatment.name);
        setTreatmentType(treatment.type);
      
        const extractId = (id: any): string =>
          typeof id === "object" && id !== null && "$oid" in id
            ? (id.$oid as string)
            : (id as string);
      
        if (treatment.type === "Regimen" && treatment.regimen) {
          const sanitizedDrugs = treatment.regimen.drugs.map((item) => ({
            drug: {
              ...item.drug,
              _id: extractId(item.drug._id),
            },
            annual_patient_con: item.annual_patient_con,
          }));
          setRegimenDrugs(sanitizedDrugs);
        } else if (treatment.type === "Alternative" && treatment.alternatives) {
          const sanitizedAlternatives = treatment.alternatives.map((alt) => ({
            ...alt,
            regimen: {
              drugs: alt.regimen.drugs.map((item) => ({
                drug: {
                  ...item.drug,
                  _id: extractId(item.drug._id),
                },
                annual_patient_con: item.annual_patient_con,
              })),
            },
          }));
          setAlternatives(sanitizedAlternatives);
        }
      };
      
      
      
      const handleDelete = async (treatmentId: string) => {
        if (!window.confirm("Are you sure you want to delete this treatment?")) return;
          
        try{
            const csrfToken = Cookies.get("csrf_token");

          await api.delete(API_ENDPOINTS.TREATMENT_DETAIL(treatmentId), {
            withCredentials: true,
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": csrfToken || "",
            },
          });
          setErrors("");
          fetchTreatments();
          alert("Treatment deleted.");
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || "Error deleting treatment";
          setErrors(errorMessage); 
          alert(errorMessage);
        }
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
                                <TextField fullWidth label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
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
                                    <Autocomplete
                                        fullWidth
                                        options={drugs}
                                        getOptionLabel={(option) => `${option.name} - ${option.strength} ${option.unit}`}
                                        value={drugs.find(d => d._id === selectedDrugId) || null}
                                        onChange={(event, newValue) => setSelectedDrugId(newValue ? newValue._id : "")}
                                        renderInput={(params) => (
                                          <TextField {...params} label="Search Drug" variant="outlined" />
                                        )}
                                      />
                                    </Grid>
                                    <Grid item xs={4}>
                                        <TextField type="number" fullWidth label="Annual Consumption" value={annualConsumption} onChange={(e) => setAnnualConsumption(Number(e.target.value))} />
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
                                <Autocomplete
                                  fullWidth
                                  options={regimenOptions}
                                  getOptionLabel={(option) => option.name}
                                  value={regimenOptions.find(r => r._id === selectedRegimenId) || null}
                                  onChange={(event, newValue) => setSelectedRegimenId(newValue ? newValue._id : "")}
                                  renderInput={(params) => (
                                    <TextField {...params} label="Search Regimen" variant="outlined" />
                                  )}
                                  sx={{ mb: 2 }}
                                />
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
                                        <Grid container spacing={1} alignItems="center">
                                          <Grid item xs={8}>
                                            <Typography variant="body2"><strong>{alt.name}</strong></Typography>
                                          </Grid>
                                          <Grid item xs={4}>
                                            <TextField
                                              fullWidth
                                              type="number"
                                              label="Ratio"
                                              value={alt.ratio}
                                              onChange={(e) => {
                                                const updated = [...alternatives];
                                                let val = parseFloat(e.target.value);
                                                if (isNaN(val)) val = 0;
                                                if (val > 1) val = 1;
                                                if (val < 0) val = 0;
                                                updated[i].ratio = val;
                                                setAlternatives(updated);
                                              }}
                                              inputProps={{ min: 0, max: 1, step: 0.01 }}
                                              size="small"
                                            />
                                          </Grid>
                                        </Grid>

                                    
                                        <Button size="small" color="error" onClick={() => setAlternatives(alternatives.filter((_, idx) => idx !== i))}>Remove</Button>
                                    </Paper>
                                ))}
                            </Box>
                        )}

                        <Box sx={{ mt: 3, textAlign: "right" }}>
                            <Button type="submit" variant="contained">Submit</Button>
                        </Box>
                    </form>
                    {errors && (
                      <Typography color="error" sx={{ mt: 2 }}>
                        {errors}
                      </Typography>
                    )}
                </CardContent>
            </Card>
            {treatments.length > 0 && (
                <Card sx={{ mb: 4 }}>
                    <CardContent>
                    <TextField
                        fullWidth
                        label="Search Treatment"
                        variant="outlined"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <Typography variant="h6" gutterBottom>Available Treatments</Typography>
                    <List>
                        {treatments
                          .filter((treatment) =>
                            treatment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            treatment.type.toLowerCase().includes(searchTerm.toLowerCase())
                          )
                          .map((treatment) => (
                        <ListItem
                        key={treatment._id}
                        secondaryAction={
                          <Box>
                            <IconButton edge="end" aria-label="edit" onClick={() => handleEdit(treatment)}>
                                        <Edit />
                                    </IconButton>
                                    <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(treatment._id)}>
                                        <Delete />
                                    </IconButton>
                          </Box>
                        }
                        sx={{ borderBottom: "1px solid #eee" }}
                      >
                        <ListItemText
                          primary={`${treatment.name} (${treatment.type})`}
                          secondary={
                            treatment.regimen
                              ? `Drugs: ${treatment.regimen.drugs.map(d => d.drug.name).join(", ")}`
                              : treatment.alternatives
                              ? `Alternatives: ${treatment.alternatives.map(a => a.name).join(", ")}`
                              : "Basic treatment"
                          }
                        />
                      </ListItem>
                        
                        ))}
                    </List>
                    </CardContent>
                </Card>
                )}
        </Container>
    );
};

export default Treatments;