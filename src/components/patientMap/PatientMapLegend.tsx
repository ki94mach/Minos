import React from "react";
import { Box, Chip } from "@mui/material";
import { treeTokens } from "../../theme/theme";
import {
  OVERVIEW_PI_BORDER_RADIUS,
  OVERVIEW_SEGMENT_SIZE,
  overviewPrimaryIndicationRing,
} from "../../utils/overviewNodeStyle";

const legendPanelSx = {
  position: "absolute" as const,
  bottom: 12,
  left: 12,
  zIndex: 10,
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 1,
  px: 1.5,
  py: 1,
  borderRadius: 2,
  bgcolor: "rgba(26, 35, 50, 0.85)",
  border: 1,
  borderColor: "divider",
  backdropFilter: "blur(8px)",
  maxWidth: "calc(100% - 24px)",
};

type LegendSwatchProps = {
  size?: number;
  width?: number;
  height?: number;
  borderRadius: string | number;
  border: string;
  boxShadow?: string;
  bgcolor?: string;
};

function LegendSwatch({
  size,
  width,
  height,
  borderRadius,
  border,
  boxShadow,
  bgcolor = "rgba(148, 163, 184, 0.2)",
}: LegendSwatchProps) {
  const w = width ?? size ?? 16;
  const h = height ?? size ?? 16;

  return (
    <Box
      aria-hidden
      sx={{
        width: w,
        height: h,
        borderRadius,
        border,
        boxShadow,
        bgcolor,
        flexShrink: 0,
      }}
    />
  );
}

type LegendChipProps = {
  label: string;
  swatch: React.ReactNode;
  labelColor?: string;
};

function LegendChip({ label, swatch, labelColor }: LegendChipProps) {
  return (
    <Chip
      size="small"
      label={
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          {swatch}
          <span>{label}</span>
        </Box>
      }
      sx={{
        bgcolor: "transparent",
        border: "1px solid",
        borderColor: "divider",
        color: labelColor ?? "text.secondary",
        "& .MuiChip-label": { px: 1 },
      }}
    />
  );
}

type PatientMapLegendProps = {
  isOverview: boolean;
};

const DRILL_CARD_BG = "rgba(26, 35, 50, 0.95)";

function OverviewLegend() {
  const characteristicBorder = `2px solid ${treeTokens.characteristic}`;
  const piBorder = `2px solid ${treeTokens.primaryIndication}`;
  const piRing = overviewPrimaryIndicationRing(treeTokens.primaryIndication);
  const piSwatchRadius = `${Math.round(
    (OVERVIEW_PI_BORDER_RADIUS / OVERVIEW_SEGMENT_SIZE) * 16
  )}px`;

  return (
    <>
      <LegendChip
        label="Population"
        labelColor={treeTokens.characteristic}
        swatch={
          <LegendSwatch
            size={18}
            borderRadius="50%"
            border={characteristicBorder}
          />
        }
      />
      <LegendChip
        label="Characteristic"
        labelColor={treeTokens.characteristic}
        swatch={
          <LegendSwatch
            size={16}
            borderRadius="50%"
            border={characteristicBorder}
          />
        }
      />
      <LegendChip
        label="Primary Indication"
        labelColor={treeTokens.primaryIndication}
        swatch={
          <LegendSwatch
            size={16}
            borderRadius={piSwatchRadius}
            border={piBorder}
            boxShadow={piRing}
          />
        }
      />
    </>
  );
}

function DrillDownLegend() {
  const characteristicBorder = `1.5px solid ${treeTokens.characteristic}`;
  const treatmentBorder = `1.5px solid ${treeTokens.treatment}`;

  return (
    <>
      <LegendChip
        label="Characteristic"
        labelColor={treeTokens.characteristic}
        swatch={
          <LegendSwatch
            width={22}
            height={14}
            borderRadius="6px"
            border={characteristicBorder}
            bgcolor={DRILL_CARD_BG}
          />
        }
      />
      <LegendChip
        label="Treatment"
        labelColor={treeTokens.treatment}
        swatch={
          <LegendSwatch
            width={22}
            height={14}
            borderRadius="6px"
            border={treatmentBorder}
            bgcolor={DRILL_CARD_BG}
          />
        }
      />
    </>
  );
}

export default function PatientMapLegend({ isOverview }: PatientMapLegendProps) {
  return (
    <Box sx={legendPanelSx}>
      {isOverview ? <OverviewLegend /> : <DrillDownLegend />}
    </Box>
  );
}
