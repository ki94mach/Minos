import React, { useState, useEffect, useMemo } from "react";
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
import CatalogListItemWithUsages from "../components/catalog/CatalogListItemWithUsages";
import CatalogFormListRow from "../components/catalog/CatalogFormListRow";
import {
  catalogEmptyStateSx,
  catalogFormActionsSx,
  catalogFormSectionTitleSx,
  catalogNestedListSx,
} from "../components/catalog/catalogPageStyles";
import Cookies from "js-cookie";
import { useCatalogEditSave } from "../components/catalog/useCatalogEditSave";
import { formatDrugLabel, formatDrugStrengthUnit } from "../utils/drugFormat";
import { API_ENDPOINTS } from "../api/endpoints";
import { asApiList } from "../api/parseApiList";

interface Drug {
    _id: string;
    name: string;
    strength?: number | null;
    unit?: string | null;
}

interface DrugWithCon {
    drug: Drug;
    annual_patient_con?: number | null;
}

interface Alternative {
    _id?: string;
    name: string;
    ratio: number;
    priority: number;
    evidence_level?: string;
    regimen?: {
        drugs: DrugWithCon[];
    };
}

interface Treatment {
    _id: string;
    name: string;
    type: string;
    priority?: number;
    evidence_level?: string;
    regimen?: { drugs: DrugWithCon[] };
    alternatives?: Alternative[];
}

function formatCatalogMetadata(treatment: Treatment): string | null {
    const parts: string[] = [];
    if (treatment.priority != null) {
        parts.push(`P${treatment.priority}`);
    }
    if (treatment.evidence_level?.trim()) {
        parts.push(`Evidence ${treatment.evidence_level.trim()}`);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
}

function appendCatalogMetadata(
    payload: Record<string, unknown>,
    priority: number,
    evidenceLevel: string
) {
    if (Number.isInteger(priority) && priority >= 1) {
        payload.priority = priority;
    }
    const trimmedEvidence = evidenceLevel.trim();
    if (trimmedEvidence) {
        payload.evidence_level = trimmedEvidence;
    }
}

function compareAlternatives(a: Alternative, b: Alternative): number {
    return a.priority - b.priority || a.name.localeCompare(b.name);
}

function nextAlternativePriority(alternatives: Alternative[]): number {
    if (alternatives.length === 0) return 1;
    return Math.max(...alternatives.map((alt) => alt.priority)) + 1;
}

const extractId = (id: unknown): string =>
    typeof id === "object" && id !== null && "$oid" in id
        ? (id as { $oid: string }).$oid
        : String(id);

const Treatments: React.FC = () => {
    const [drugs, setDrugs] = useState<Drug[]>([]);
    const [treatments, setTreatments] = useState<Treatment[]>([]);

    const [name, setName] = useState("");
    const [treatmentType, setTreatmentType] = useState("Treatment");
    const [catalogPriority, setCatalogPriority] = useState<number>(1);
    const [catalogEvidenceLevel, setCatalogEvidenceLevel] = useState("");

    const [selectedDrugId, setSelectedDrugId] = useState("");
    const [annualConsumption, setAnnualConsumption] = useState<number | "">("");
    const [regimenDrugs, setRegimenDrugs] = useState<DrugWithCon[]>([]);

    const [alternativeRegimenDrugs, setAlternativeRegimenDrugs] = useState<DrugWithCon[]>([]);
    const [alternativeRatio, setAlternativeRatio] = useState<number>(0);
    const [alternativePriority, setAlternativePriority] = useState<number>(1);
    const [alternativeEvidenceLevel, setAlternativeEvidenceLevel] = useState("");
    const [alternatives, setAlternatives] = useState<Alternative[]>([]);
    const [draggedAlternativeIndex, setDraggedAlternativeIndex] = useState<number | null>(null);
    const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null);
    const alternativeRefOptions = treatments.filter(
        (t) => t.type === "Regimen" || t.type === "Treatment"
    );
    const [selectedAlternativeRefId, setSelectedAlternativeRefId] = useState<string>("");
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
        if (!selectedDrugId) {
            alert("Please select a drug.");
            return;
        }
        const selectedDrug = drugs.find(d => d._id === selectedDrugId);
        if (!selectedDrug) return;

        const drugWithCon: DrugWithCon = {
            drug: {
              ...selectedDrug,
              _id: selectedDrug._id 
            },
            annual_patient_con:
              annualConsumption === "" ? null : Number(annualConsumption),
          };
        
        toAlternative ? setAlternativeRegimenDrugs([...alternativeRegimenDrugs, drugWithCon])
            : setRegimenDrugs([...regimenDrugs, drugWithCon]);

        setSelectedDrugId("");
        setAnnualConsumption("");
    };

    const sortedAlternatives = useMemo(
        () => [...alternatives].sort(compareAlternatives),
        [alternatives]
    );

    useEffect(() => {
        if (!selectedAlternativeRefId) {
            setAlternativePriority(nextAlternativePriority(alternatives));
        }
    }, [alternatives, selectedAlternativeRefId]);

    const addAlternative = () => {
        if (!selectedAlternativeRefId || alternativeRatio <= 0 || alternativeRatio > 1) {
          alert("Select a treatment/regimen and a valid ratio (0-1).");
          return;
        }
        if (!Number.isInteger(alternativePriority) || alternativePriority < 1) {
          alert("Priority must be a positive integer.");
          return;
        }

        const selectedRef = alternativeRefOptions.find(
            (r) => r._id === selectedAlternativeRefId
        );
        if (!selectedRef) {
          alert("Selected treatment not found.");
          return;
        }
        if (selectedRef.type === "Regimen" && !selectedRef.regimen) {
          alert("Selected regimen has no drug data.");
          return;
        }

        const newAlt: Alternative = {
          _id: selectedRef._id,
          name: selectedRef.name,
          ratio: alternativeRatio,
          priority: alternativePriority,
        };
        const trimmedEvidence = alternativeEvidenceLevel.trim();
        if (trimmedEvidence) {
          newAlt.evidence_level = trimmedEvidence;
        }
        if (selectedRef.regimen) {
          newAlt.regimen = selectedRef.regimen;
        }

        setAlternatives((prev) => [...prev, newAlt]);
        setSelectedAlternativeRefId("");
        setAlternativeRatio(0);
        setAlternativeEvidenceLevel("");
      };

    const updateAlternativePriority = (altId: string | undefined, value: number) => {
        if (!Number.isInteger(value) || value < 1) return;
        setAlternatives((prev) =>
            prev.map((alt) =>
                alt._id === altId ? { ...alt, priority: value } : alt
            )
        );
    };

    const updateAlternativeEvidenceLevel = (
        altId: string | undefined,
        value: string
    ) => {
        const trimmed = value.trim();
        setAlternatives((prev) =>
            prev.map((alt) => {
                if (alt._id !== altId) return alt;
                if (!trimmed) {
                    const { evidence_level: _removed, ...rest } = alt;
                    return rest;
                }
                return { ...alt, evidence_level: trimmed };
            })
        );
    };

    const handleAlternativeDrop = (targetIndex: number) => {
        if (draggedAlternativeIndex === null || draggedAlternativeIndex === targetIndex) {
            setDraggedAlternativeIndex(null);
            return;
        }
        const reordered = [...sortedAlternatives];
        const [moved] = reordered.splice(draggedAlternativeIndex, 1);
        reordered.splice(targetIndex, 0, moved);
        setAlternatives(
            reordered.map((alt, index) => ({ ...alt, priority: index + 1 }))
        );
        setDraggedAlternativeIndex(null);
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
          appendCatalogMetadata(payload, catalogPriority, catalogEvidenceLevel);
        } else if (treatmentType === "Treatment") {
          appendCatalogMetadata(payload, catalogPriority, catalogEvidenceLevel);
        } else if (treatmentType === "Alternative") {
          if (alternatives.length === 0) return alert("Add at least one alternative.");
          payload.alternatives = alternatives.map((alt) => {
            const entry: Record<string, unknown> = {
              _id: extractId(alt._id),
              name: alt.name,
              ratio: alt.ratio,
              priority: alt.priority,
            };
            if (alt.evidence_level?.trim()) {
              entry.evidence_level = alt.evidence_level.trim();
            }
            if (alt.regimen?.drugs?.length) {
              entry.regimen = {
                drugs: alt.regimen.drugs.map((item) => ({
                  drug: {
                    _id: extractId(item.drug._id),
                    name: item.drug.name,
                    strength: item.drug.strength,
                    unit: item.drug.unit,
                  },
                  annual_patient_con: item.annual_patient_con,
                })),
              };
            }
            return entry;
          });
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
        setCatalogPriority(1);
        setCatalogEvidenceLevel("");
        setRegimenDrugs([]);
        setAlternatives([]);
        setAlternativeRegimenDrugs([]);
        setSelectedDrugId("");
        setSelectedAlternativeRefId("");
        setAlternativeRatio(0);
        setAlternativePriority(1);
        setAlternativeEvidenceLevel("");
        setDraggedAlternativeIndex(null);
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
        setCatalogPriority(treatment.priority ?? 1);
        setCatalogEvidenceLevel(treatment.evidence_level?.trim() ?? "");
      
        const extractDrugId = (id: unknown): string => extractId(id);

        if (treatment.type === "Regimen" && treatment.regimen) {
          const sanitizedDrugs = treatment.regimen.drugs.map((item) => ({
            drug: {
              ...item.drug,
              _id: extractDrugId(item.drug._id),
            },
            annual_patient_con: item.annual_patient_con,
          }));
          setRegimenDrugs(sanitizedDrugs);
        } else if (treatment.type === "Alternative" && treatment.alternatives) {
          const sanitizedAlternatives = treatment.alternatives.map((alt, index) => {
            const sanitized: Alternative = {
              _id: extractId(alt._id),
              name: alt.name,
              ratio: alt.ratio,
              priority: alt.priority ?? index + 1,
            };
            if (alt.evidence_level?.trim()) {
              sanitized.evidence_level = alt.evidence_level.trim();
            }
            if (alt.regimen?.drugs?.length) {
              sanitized.regimen = {
                drugs: alt.regimen.drugs.map((item) => ({
                  drug: {
                    ...item.drug,
                    _id: extractDrugId(item.drug._id),
                  },
                  annual_patient_con: item.annual_patient_con,
                })),
              };
            }
            return sanitized;
          });
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
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Basic treatment — no regimen or alternatives required.
                </Typography>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                  <TextField
                    type="number"
                    size="small"
                    label="Priority"
                    value={catalogPriority}
                    onChange={(e) => setCatalogPriority(Number(e.target.value))}
                    inputProps={{ min: 1, step: 1 }}
                    sx={{ minWidth: 120, flex: 1 }}
                  />
                  <TextField
                    size="small"
                    label="Evidence Level"
                    value={catalogEvidenceLevel}
                    onChange={(e) => setCatalogEvidenceLevel(e.target.value)}
                    inputProps={{ maxLength: 32 }}
                    sx={{ minWidth: 140, flex: 1 }}
                  />
                </Box>
              </Box>
            )}

            {treatmentType === "Regimen" && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={catalogFormSectionTitleSx}>
                  Regimen options
                </Typography>
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
                  <TextField
                    type="number"
                    size="small"
                    label="Priority"
                    value={catalogPriority}
                    onChange={(e) => setCatalogPriority(Number(e.target.value))}
                    inputProps={{ min: 1, step: 1 }}
                    sx={{ minWidth: 120, flex: 1 }}
                  />
                  <TextField
                    size="small"
                    label="Evidence Level"
                    value={catalogEvidenceLevel}
                    onChange={(e) => setCatalogEvidenceLevel(e.target.value)}
                    inputProps={{ maxLength: 32 }}
                    sx={{ minWidth: 140, flex: 1 }}
                  />
                </Box>
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
                        formatDrugLabel(option.name, option.strength, option.unit)
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
                        setAnnualConsumption(
                          e.target.value ? Number(e.target.value) : ""
                        )
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
                        primary={`${item.drug.name} — ${formatDrugStrengthUnit(item.drug.strength, item.drug.unit)}`}
                        secondary={
                          item.annual_patient_con != null
                            ? `Annual consumption: ${item.annual_patient_con}`
                            : undefined
                        }
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
                    options={alternativeRefOptions}
                    getOptionLabel={(option) => `${option.name} (${option.type})`}
                    value={
                      alternativeRefOptions.find(
                        (r) => r._id === selectedAlternativeRefId
                      ) || null
                    }
                    onChange={(_event, newValue) => {
                      setSelectedAlternativeRefId(newValue ? newValue._id : "");
                      if (newValue?.priority != null) {
                        setAlternativePriority(newValue.priority);
                      } else {
                        setAlternativePriority(nextAlternativePriority(alternatives));
                      }
                      setAlternativeEvidenceLevel(
                        newValue?.evidence_level?.trim() ?? ""
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Treatment or Regimen"
                        size="small"
                      />
                    )}
                  />
                  <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    <TextField
                      type="number"
                      size="small"
                      label="Priority"
                      value={alternativePriority}
                      onChange={(e) =>
                        setAlternativePriority(Number(e.target.value))
                      }
                      inputProps={{ min: 1, step: 1 }}
                      sx={{ minWidth: 120, flex: 1 }}
                    />
                    <TextField
                      size="small"
                      label="Evidence Level"
                      value={alternativeEvidenceLevel}
                      onChange={(e) => setAlternativeEvidenceLevel(e.target.value)}
                      inputProps={{ maxLength: 32 }}
                      sx={{ minWidth: 140, flex: 1 }}
                    />
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
                {sortedAlternatives.length > 0 && (
                  <List disablePadding sx={catalogNestedListSx}>
                    {sortedAlternatives.map((alt, i) => (
                      <CatalogFormListRow
                        key={extractId(alt._id)}
                        sortable
                        primary={alt.name}
                        secondary={[
                          `Priority ${alt.priority}`,
                          alt.evidence_level
                            ? `Evidence ${alt.evidence_level}`
                            : null,
                          `Ratio ${alt.ratio}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        onDragStart={() => setDraggedAlternativeIndex(i)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleAlternativeDrop(i)}
                        onDragEnd={() => setDraggedAlternativeIndex(null)}
                        trailing={
                          <Box sx={{ display: "flex", gap: 1 }}>
                            <TextField
                              type="number"
                              size="small"
                              label="Priority"
                              value={alt.priority}
                              onChange={(e) =>
                                updateAlternativePriority(
                                  alt._id,
                                  Number(e.target.value)
                                )
                              }
                              inputProps={{ min: 1, step: 1 }}
                              sx={{ width: 96 }}
                            />
                            <TextField
                              size="small"
                              label="Evidence"
                              value={alt.evidence_level ?? ""}
                              onChange={(e) =>
                                updateAlternativeEvidenceLevel(
                                  alt._id,
                                  e.target.value
                                )
                              }
                              inputProps={{ maxLength: 32 }}
                              sx={{ width: 96 }}
                            />
                          </Box>
                        }
                        onRemove={() =>
                          setAlternatives(
                            alternatives.filter((item) => item._id !== alt._id)
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
          <CatalogListItemWithUsages
            key={treatment._id}
            catalogId={treatment._id}
            kind="treatment"
            selected={editingTreatmentId === treatment._id}
            primary={`${treatment.name} (${treatment.type})`}
            secondary={
              treatment.regimen
                ? [
                    `Drugs: ${treatment.regimen.drugs
                      .map((d) => d.drug.name)
                      .join(", ")}`,
                    formatCatalogMetadata(treatment),
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : treatment.alternatives
                ? `Alternatives: ${[...treatment.alternatives]
                    .sort(compareAlternatives)
                    .map((a) => {
                      const evidence = a.evidence_level ? `, ${a.evidence_level}` : "";
                      return `${a.name} (P${a.priority ?? "?"}${evidence})`;
                    })
                    .join(", ")}`
                : formatCatalogMetadata(treatment) ?? "Basic treatment"
            }
            onEdit={() => handleEdit(treatment)}
            onDelete={() => handleDelete(treatment._id)}
          />
        ))}
      </CatalogPageLayout>
    );
};

export default Treatments;