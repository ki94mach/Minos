import React, { useEffect, useState } from "react";
import {
  Box,
  CircularProgress,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import type { CatalogReferences, CatalogUsageGroup } from "../../api/catalog";
import type { CatalogEntityKind } from "./catalogEditSave";
import {
  fetchCharacteristicReferences,
  fetchDrugReferences,
  fetchTreatmentReferences,
} from "../../api/catalog";
import { navigateToCatalogUsage } from "../../utils/catalogNavigation";

const FETCH_REFERENCES: Record<
  CatalogEntityKind,
  (id: string) => Promise<CatalogReferences>
> = {
  characteristic: fetchCharacteristicReferences,
  drug: fetchDrugReferences,
  treatment: fetchTreatmentReferences,
};

type Props = {
  catalogId: string;
  kind: CatalogEntityKind;
  isPopulationCatalogHit?: boolean;
};

function groupPrimaryLabel(group: CatalogUsageGroup): string {
  return group.pi_name || group.population_name || "Patient tree";
}

function groupSecondaryLabel(group: CatalogUsageGroup): string {
  if (group.usage_count === 1) {
    return group.usages[0]?.path_label || "";
  }
  const label = group.usage_count === 1 ? "usage" : "usages";
  return `${group.usage_count} ${label}`;
}

export default function CatalogUsagePanel({
  catalogId,
  kind,
  isPopulationCatalogHit = false,
}: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<CatalogUsageGroup[]>([]);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuGroup, setMenuGroup] = useState<CatalogUsageGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    FETCH_REFERENCES[kind](catalogId)
      .then((refs) => {
        if (cancelled) return;
        setGroups(refs.groups ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load patient tree usages.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [catalogId, kind]);

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuGroup(null);
  };

  const handleGroupClick = (
    event: React.MouseEvent<HTMLElement>,
    group: CatalogUsageGroup
  ) => {
    if (group.usage_count > 1) {
      setMenuAnchor(event.currentTarget);
      setMenuGroup(group);
      return;
    }
    const usage = group.usages[0];
    if (!usage) return;
    navigateToCatalogUsage(navigate, group, usage, { isPopulationCatalogHit });
  };

  const handleUsagePick = (usage: CatalogUsageGroup["usages"][number]) => {
    if (!menuGroup) return;
    navigateToCatalogUsage(navigate, menuGroup, usage, {
      isPopulationCatalogHit,
    });
    closeMenu();
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1, pl: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">
          Loading usages…
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="caption" color="error" sx={{ display: "block", py: 1, pl: 2 }}>
        {error}
      </Typography>
    );
  }

  if (groups.length === 0) {
    return (
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", py: 1, pl: 2 }}>
        Not used in any patient tree.
      </Typography>
    );
  }

  return (
    <Box sx={{ pl: 1, pr: 1, pb: 1 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", px: 1, pt: 0.5, pb: 0.5, fontWeight: 600 }}>
        Used in patient trees
      </Typography>
      {groups.map((group) => (
        <ListItemButton
          key={`${group.patient_id}:${group.pi_catalog_id ?? "no-pi"}`}
          dense
          onClick={(event) => handleGroupClick(event, group)}
          sx={{ borderRadius: 1, py: 0.5 }}>
          <ListItemText
            primary={groupPrimaryLabel(group)}
            secondary={groupSecondaryLabel(group)}
            primaryTypographyProps={{ variant: "body2" }}
            secondaryTypographyProps={{ variant: "caption" }}
          />
        </ListItemButton>
      ))}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        {(menuGroup?.usages ?? []).map((usage) => (
          <MenuItem
            key={usage.node_id}
            onClick={() => handleUsagePick(usage)}>
            {usage.path_label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
