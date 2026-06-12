import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Link,
  Divider,
  Stack,
  CircularProgress,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import LinkIcon from "@mui/icons-material/Link";
import DescriptionIcon from "@mui/icons-material/Description";
import axios from "axios";
import {
  addNodeFileReference,
  addNodeLinkReference,
  deleteNodeReference,
  downloadNodeReference,
  updateNodeDescription,
  type NodeReference,
} from "../../api/patients";

/** Extract the server-provided error message ({ "error": "..." }) when present. */
function serverErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: string; details?: string[] }
      | undefined;
    if (data?.error) {
      return data.details?.length
        ? `${data.error} (${data.details.join("; ")})`
        : data.error;
    }
  }
  return fallback;
}

const MAX_DESCRIPTION_LENGTH = 5000;
const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx";

export type NodeDetailsModalData = {
  patientId: string;
  nodeId: string;
  nodeLabel: string;
  description: string;
  references: NodeReference[];
};

type NodeDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  data: NodeDetailsModalData;
  /** When true, hide all editing controls (view-only). */
  readOnly?: boolean;
  container?: HTMLElement | (() => HTMLElement | null) | null;
};

function formatBytes(size?: number | null): string {
  if (!size || size <= 0) return "";
  const units = ["B", "KB", "MB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

export default function NodeDetailsDialog({
  open,
  onClose,
  onSaved,
  data,
  readOnly = false,
  container,
}: NodeDetailsDialogProps) {
  const { patientId, nodeId, nodeLabel } = data;

  const [description, setDescription] = useState<string>(data.description || "");
  const [references, setReferences] = useState<NodeReference[]>(
    data.references || []
  );
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [fileTitle, setFileTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [savingDescription, setSavingDescription] = useState(false);
  const [busyRef, setBusyRef] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveDescription = async () => {
    setError(null);
    setSavingDescription(true);
    try {
      await updateNodeDescription(patientId, nodeId, description);
      onSaved();
    } catch (e) {
      console.error("Failed to save description:", e);
      setError("Could not save the description.");
    } finally {
      setSavingDescription(false);
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) return;
    setError(null);
    setBusyRef(true);
    try {
      const created = await addNodeFileReference(
        patientId,
        nodeId,
        selectedFile,
        fileTitle
      );
      setReferences((prev) => [...prev, created]);
      setSelectedFile(null);
      setFileTitle("");
      onSaved();
    } catch (e) {
      console.error("Failed to upload reference file:", e);
      setError(
        serverErrorMessage(
          e,
          "Could not upload the file. Allowed types: PDF, DOC, DOCX (max 10MB)."
        )
      );
    } finally {
      setBusyRef(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return;
    setError(null);
    setBusyRef(true);
    try {
      const created = await addNodeLinkReference(
        patientId,
        nodeId,
        linkUrl,
        linkTitle
      );
      setReferences((prev) => [...prev, created]);
      setLinkUrl("");
      setLinkTitle("");
      onSaved();
    } catch (e) {
      console.error("Failed to add reference link:", e);
      setError(
        serverErrorMessage(
          e,
          "Could not add the link. URLs must start with http:// or https://."
        )
      );
    } finally {
      setBusyRef(false);
    }
  };

  const handleDeleteReference = async (reference: NodeReference) => {
    setError(null);
    setBusyRef(true);
    try {
      await deleteNodeReference(patientId, nodeId, reference._id);
      setReferences((prev) => prev.filter((r) => r._id !== reference._id));
      onSaved();
    } catch (e) {
      console.error("Failed to delete reference:", e);
      setError("Could not delete the reference.");
    } finally {
      setBusyRef(false);
    }
  };

  const handleDownload = async (reference: NodeReference) => {
    setError(null);
    try {
      await downloadNodeReference(patientId, nodeId, reference);
    } catch (e) {
      console.error("Failed to download reference:", e);
      setError("Could not download the file.");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      container={container}
    >
      <DialogTitle>Node details — {nodeLabel}</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Description
        </Typography>
        {readOnly ? (
          description.trim() ? (
            <Typography
              variant="body2"
              sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {description}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No description.
            </Typography>
          )
        ) : (
          <>
            <TextField
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={3}
              maxRows={10}
              fullWidth
              placeholder="Add notes for other users…"
              inputProps={{ maxLength: MAX_DESCRIPTION_LENGTH }}
              helperText={`${description.length}/${MAX_DESCRIPTION_LENGTH}`}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleSaveDescription}
                disabled={savingDescription}
                startIcon={
                  savingDescription ? <CircularProgress size={16} /> : undefined
                }
              >
                Save description
              </Button>
            </Box>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          References
        </Typography>
        {references.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No references yet.
          </Typography>
        ) : (
          <List dense>
            {references.map((reference) => (
              <ListItem
                key={reference._id}
                secondaryAction={
                  <Stack direction="row" spacing={0.5}>
                    {reference.kind === "file" && (
                      <IconButton
                        edge="end"
                        aria-label="download"
                        onClick={() => handleDownload(reference)}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    )}
                    {!readOnly && (
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        color="error"
                        disabled={busyRef}
                        onClick={() => handleDeleteReference(reference)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                }
              >
                {reference.kind === "file" ? (
                  <DescriptionIcon fontSize="small" sx={{ mr: 1 }} />
                ) : (
                  <LinkIcon fontSize="small" sx={{ mr: 1 }} />
                )}
                <ListItemText
                  primary={
                    reference.kind === "link" && reference.url ? (
                      <Link
                        href={reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {reference.title || reference.url}
                      </Link>
                    ) : (
                      reference.title ||
                      reference.original_name ||
                      "Untitled reference"
                    )
                  }
                  secondary={
                    reference.kind === "file"
                      ? [reference.original_name, formatBytes(reference.size_bytes)]
                          .filter(Boolean)
                          .join(" · ")
                      : reference.title
                      ? reference.url
                      : undefined
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        {!readOnly && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Upload a file (PDF, DOC, DOCX)
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
            <Button variant="outlined" component="label" size="small">
              {selectedFile ? selectedFile.name : "Choose file"}
              <input
                type="file"
                hidden
                accept={ACCEPTED_FILE_TYPES}
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </Button>
            <TextField
              size="small"
              placeholder="Title (optional)"
              value={fileTitle}
              onChange={(e) => setFileTitle(e.target.value)}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleUploadFile}
              disabled={!selectedFile || busyRef}
            >
              Upload
            </Button>
          </Stack>

          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Add an external link (URL / DOI)
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              size="small"
              placeholder="https://…"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              placeholder="Title (optional)"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleAddLink}
              disabled={!linkUrl.trim() || busyRef}
            >
              Add link
            </Button>
          </Stack>
        </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
