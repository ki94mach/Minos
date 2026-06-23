import React, { useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate } from "react-router-dom";
import { fetchCatalogReferences } from "../catalog/catalogEditSave";
import { navigatePatientMapSearchResult } from "../../utils/catalogNavigation";
import {
  buildSearchOptions,
  filterSearchOptions,
  flattenCatalogUsageGroups,
  type PatientMapSearchOption,
  type PatientMapUsageEntry,
} from "../../utils/patientMapSearchUtils";
import PatientMapUsagePickerDialog from "./PatientMapUsagePickerDialog";

type Props = {
  disabled?: boolean;
  disabledReason?: string;
  characteristics: Array<{ _id: string; type: string; name: string }>;
  drugs: Array<{ _id: string; name: string }>;
  treatments: Array<{ _id: string; name: string; type?: string }>;
};

export default function PatientMapSearch({
  disabled = false,
  disabledReason,
  characteristics,
  drugs,
  treatments,
}: Props) {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [helperText, setHelperText] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTitle, setPickerTitle] = useState("");
  const [pickerEntries, setPickerEntries] = useState<PatientMapUsageEntry[]>(
    []
  );
  const [pendingSelection, setPendingSelection] =
    useState<PatientMapSearchOption | null>(null);

  const allOptions = useMemo(
    () => buildSearchOptions(characteristics, drugs, treatments),
    [characteristics, drugs, treatments]
  );

  const filteredOptions = useMemo(
    () => filterSearchOptions(allOptions, inputValue),
    [allOptions, inputValue]
  );

  const navigateSelection = (
    selection: PatientMapSearchOption,
    entry: PatientMapUsageEntry
  ) => {
    navigatePatientMapSearchResult(
      navigate,
      selection,
      entry.group,
      entry.usage
    );
    setInputValue("");
    setHelperText(null);
    setPendingSelection(null);
  };

  const handleOptionSelect = async (option: PatientMapSearchOption | null) => {
    if (!option) return;

    setLoading(true);
    setHelperText(null);
    setPendingSelection(option);

    try {
      const refs = await fetchCatalogReferences(option.kind, option.id);
      const entries = flattenCatalogUsageGroups(refs.groups);

      if (entries.length === 0) {
        setHelperText("Not used in any patient tree.");
        setPendingSelection(null);
        return;
      }

      if (entries.length === 1) {
        navigateSelection(option, entries[0]);
        return;
      }

      setPickerTitle(`Choose a location for "${option.label}"`);
      setPickerEntries(entries);
      setPickerOpen(true);
    } catch {
      setHelperText("Could not load patient tree usages.");
      setPendingSelection(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePickerSelect = (entry: PatientMapUsageEntry) => {
    if (!pendingSelection) return;
    setPickerOpen(false);
    navigateSelection(pendingSelection, entry);
  };

  const handlePickerClose = () => {
    setPickerOpen(false);
    setPendingSelection(null);
  };

  const displayHelperText = helperText ?? (disabled ? disabledReason : undefined);
  const isErrorHelper =
    Boolean(helperText) && helperText !== "Not used in any patient tree.";

  return (
    <Box sx={{ flex: "1 1 280px", minWidth: 0 }}>
      <Autocomplete
        disabled={disabled || loading}
        options={filteredOptions}
        groupBy={(option) => option.group}
        getOptionLabel={(option) => option.label}
        inputValue={inputValue}
        onInputChange={(_, value, reason) => {
          if (reason === "input") {
            setInputValue(value);
            if (helperText) setHelperText(null);
          }
        }}
        onChange={(_, value) => {
          void handleOptionSelect(value);
        }}
        filterOptions={(options) => options}
        isOptionEqualToValue={(option, value) =>
          option.kind === value.kind && option.id === value.id
        }
        renderOption={(props, option) => (
          <li {...props} key={`${option.kind}:${option.id}`}>
            <Box>
              <Typography variant="body2">{option.label}</Typography>
              {option.characteristicType && (
                <Typography variant="caption" color="text.secondary">
                  {option.characteristicType}
                </Typography>
              )}
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            placeholder="Search characteristics, drugs, or treatments…"
            helperText={displayHelperText ?? undefined}
            error={isErrorHelper}
            FormHelperTextProps={
              helperText === "Not used in any patient tree."
                ? { sx: { color: "text.secondary" } }
                : undefined
            }
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              ),
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress color="inherit" size={18} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />

      <PatientMapUsagePickerDialog
        open={pickerOpen}
        title={pickerTitle}
        entries={pickerEntries}
        onSelect={handlePickerSelect}
        onClose={handlePickerClose}
      />
    </Box>
  );
}
