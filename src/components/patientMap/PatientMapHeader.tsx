import React from "react";
import {
  Box,
  Breadcrumbs,
  Button,
  Link,
  Typography,
} from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { Link as RouterLink } from "react-router-dom";

type Props = {
  isOverview: boolean;
  treeLabel?: string | null;
  nodeCount?: number;
  onCreateTree?: () => void;
  toolbar?: React.ReactNode;
};

export default function PatientMapHeader({
  isOverview,
  treeLabel,
  nodeCount,
  onCreateTree,
  toolbar,
}: Props) {
  return (
    <Box sx={{ mb: 3 }}>
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        sx={{ mb: 2, "& .MuiBreadcrumbs-li": { typography: "body2" } }}>
        <Link
          component={RouterLink}
          to="/home"
          underline="hover"
          color="text.secondary">
          Home
        </Link>
        {isOverview ? (
          <Typography color="text.primary">Patient Map</Typography>
        ) : (
          <>
            <Link
              component={RouterLink}
              to="/patients"
              underline="hover"
              color="text.secondary">
              Patient Map
            </Link>
            <Typography color="text.primary">{treeLabel ?? "Tree"}</Typography>
          </>
        )}
      </Breadcrumbs>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 2,
          mb: toolbar ? 2.5 : 0,
        }}>
        <Box>
          <Typography variant="h3">Patient Map</Typography>
          {!isOverview && treeLabel && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Viewing{" "}
              <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
                {treeLabel}
              </Box>
              {nodeCount != null && nodeCount > 0 ? ` · ${nodeCount} nodes` : ""}
            </Typography>
          )}
        </Box>
        {isOverview && onCreateTree && (
          <Button variant="contained" onClick={onCreateTree}>
            Create patient tree
          </Button>
        )}
      </Box>

      {toolbar}
    </Box>
  );
}
