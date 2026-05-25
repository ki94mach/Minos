import React, { useState, useEffect } from "react";
import {
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  List,
  Grid,
  Autocomplete,
  Stack,
} from "@mui/material";
import api from "../api";
import { Save, Add } from "@mui/icons-material";
import CatalogPageLayout from "../components/catalog/CatalogPageLayout";
import CatalogListItem from "../components/catalog/CatalogListItem";
import CatalogFormListRow from "../components/catalog/CatalogFormListRow";
import {
  catalogEmptyStateSx,
  catalogFormActionsSx,
  catalogFormSectionTitleSx,
  catalogNestedListSx,
} from "../components/catalog/catalogPageStyles";
import Cookies from "js-cookie";
import { useCatalogEditSave } from "../components/catalog/useCatalogEditSave";
import { API_ENDPOINTS } from "../api/endpoints";
import { asApiList } from "../api/parseApiList";

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
    const { confirmBeforePut, formatPutSuccess } = useCatalogEditSave("treatment");

    useEffect(() => {
        fetchDrugs();
        fetchTreatments();
    }, []);

    const fetchDrugs = async () => {
        try {
            const response = await api.get(API_ENDPOINTS.DRUGS);
            setDrugs(asApiList(response.data));
        } catch (error) {
            console.error("Error fetching drugs:", error);
        }
    };

    const fetchTreatments = async () => {
        try {
            const response = await api.get(API_ENDPOINTS.TREATMENTS);
            setTreatments(asApiList(response.data));
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
            if (!(await confirmBeforePut(editingTreatmentId))) return;

            const response = await api.put(
              API_ENDPOINTS.TREATMENT_DETAIL(editingTreatmentId),
              payload,
              config
            );
            alert(formatPutSuccess("Treatment updated.", response.data));
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
        setTreatmentType("Treatment");
        setRegimenDrugs([]);
        setAlternatives([]);
        setAlternativeRegimenDrugs([]);
        setSelectedDrugId("");
        setSelectedRegimenId("");
    };

    const isEditing = Boolean(editingTreatmentId);

    const cancelEdit = () => {
        setEditingTreatmentId(null);
        resetForm();
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
      

    const filteredTreatments = treatments.filter(
      (treatment) =>
        treatment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        treatment.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <CatalogPageLayout
        title="Treatments"
        formTitle={isEditing ? "Edit treatment" : "Add treatment"}
        searchPlaceholder="Search treatments"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        listLabel="Catalog"
        error={errors || null}
        listEmpty={
          <Typography variant="body2" sx={catalogEmptyStateSx}>
            No treatments yet.
          </Typography>
        }
        form={
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  size="small"
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth required size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={treatmentType}
                    onChange={(e) => setTreatmentType(e.target.value)}
                    label="Type">
                    <MenuItem value="Treatment">Treatment</MenuItem>
                    <MenuItem value="Regimen">Regimen</MenuItem>
                    <MenuItem value="Alternative">Alternative</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {treatmentType === "Treatment" && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Basic treatment — no regimen or alternatives required.
              </Typography>
            )}

            {treatmentType === "Regimen" && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={catalogFormSectionTitleSx}>
                  Regimen drugs
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <Autocomplete
                      size="small"
                      fullWidth
                      options={drugs}
                      getOptionLabel={(option) =>
                        `${option.name} - ${option.strength} ${option.unit}`
                      }
                      value={
                        drugs.find((d) => d._id === selectedDrugId) || null
                      }
                      onChange={(_event, newValue) =>
                        setSelectedDrugId(newValue ? newValue._id : "")
                      }
                      renderInput={(params) => (
                        <TextField {...params} label="Drug" size="small" />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      type="number"
                      fullWidth
                      size="small"
                      label="Annual consumption"
                      value={annualConsumption}
                      onChange={(e) =>
                        setAnnualConsumption(Number(e.target.value))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => addDrug(false)}
                      fullWidth>
                      Add drug
                    </Button>
                  </Grid>
                </Grid>
                {regimenDrugs.length > 0 && (
                  <List disablePadding sx={catalogNestedListSx}>
                    {regimenDrugs.map((item, i) => (
                      <CatalogFormListRow
                        key={i}
                        primary={`${item.drug.name} — ${item.drug.strength} ${item.drug.unit}`}
                        secondary={`Annual consumption: ${item.annual_patient_con}`}
                        onRemove={() =>
                          setRegimenDrugs(
                            regimenDrugs.filter((_, idx) => idx !== i)
                          )
                        }
                      />
                    ))}
                  </List>
                )}
              </Box>
            )}

            {treatmentType === "Alternative" && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={catalogFormSectionTitleSx}>
                  Alternatives
                </Typography>
                <Stack spacing={2}>
                  <Autocomplete
                    size="small"
                    fullWidth
                    options={regimenOptions}
                    getOptionLabel={(option) => option.name}
                    value={
                      regimenOptions.find((r) => r._id === selectedRegimenId) ||
                      null
                    }
                    onChange={(_event, newValue) =>
                      setSelectedRegimenId(newValue ? newValue._id : "")
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Regimen" size="small" />
                    )}
                  />
                  <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    <TextField
                      type="number"
                      size="small"
                      label="Ratio (0–1)"
                      value={alternativeRatio}
                      onChange={(e) =>
                        setAlternativeRatio(Number(e.target.value))
                      }
                      inputProps={{ min: 0, max: 1, step: "any" }}
                      sx={{ minWidth: 140, flex: 1 }}
                    />
                    <Button variant="outlined" size="small" onClick={addAlternative}>
                      Add alternative
                    </Button>
                  </Box>
                </Stack>
                {alternatives.length > 0 && (
                  <List disablePadding sx={catalogNestedListSx}>
                    {alternatives.map((alt, i) => (
                      <CatalogFormListRow
                        key={i}
                        primary={alt.name}
                        secondary={`Ratio: ${alt.ratio}`}
                        onRemove={() =>
                          setAlternatives(
                            alternatives.filter((_, idx) => idx !== i)
                          )
                        }
                      />
                    ))}
                  </List>
                )}
              </Box>
            )}

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ ...catalogFormActionsSx, justifyContent: "flex-end" }}>
              {isEditing && (
                <Button variant="outlined" onClick={cancelEdit}>
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                variant="contained"
                startIcon={isEditing ? <Save /> : <Add />}>
                {isEditing ? "Save changes" : "Add treatment"}
              </Button>
            </Stack>
          </form>
        }>
        {filteredTreatments.map((treatment) => (
          <CatalogListItem
            key={treatment._id}
            selected={editingTreatmentId === treatment._id}
            primary={`${treatment.name} (${treatment.type})`}
            secondary={
              treatment.regimen
                ? `Drugs: ${treatment.regimen.drugs
                    .map((d) => d.drug.name)
                    .join(", ")}`
                : treatment.alternatives
                ? `Alternatives: ${treatment.alternatives
                    .map((a) => a.name)
                    .join(", ")}`
                : "Basic treatment"
            }
            onEdit={() => handleEdit(treatment)}
            onDelete={() => handleDelete(treatment._id)}
          />
        ))}
      </CatalogPageLayout>
    );
};

export default Treatments;