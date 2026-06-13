import React, { useState, useEffect, useRef } from "react";
import { Handle, Position, useReactFlow, NodeProps } from "reactflow";
import { Tooltip, useTheme, Chip } from "@mui/material";
import { treeTokens, textOnColor } from "../theme/theme";
import type { TreatmentRegimenDialogData } from "./patientMap/TreatmentRegimenDialog";

const CustomNode = (
  props: NodeProps & {
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onOpenRegimenDetails?: (data: TreatmentRegimenDialogData) => void;
  }
) => {
  const theme = useTheme();
  const { id, data: nodeData, onContextMenu, onOpenRegimenDetails } = props;
  const [label, setLabel] = useState(nodeData.label);
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);

  const [number, setNumber] = useState(() => {
    const num = nodeData?.number;
    return typeof num === "number" || typeof num === "string"
      ? num.toString()
      : "1";
  });

  const borderColor =
    nodeData?.type === "characteristic"
      ? treeTokens.characteristic
      : nodeData?.type === "treatment"
      ? treeTokens.treatment
      : theme.palette.divider;

  const isOverviewMode = nodeData.isOverviewMode === true;
  const canDrillDown = nodeData.canDrillDown === true;
  const showRegimenTag = !isOverviewMode && nodeData.type === "treatment";
  const nodeFill = nodeData.color || theme.palette.background.paper;
  const overviewTextColor =
    isOverviewMode && nodeData.color
      ? textOnColor(nodeData.color)
      : theme.palette.text.primary;

  const baseShadow = treeTokens.nodeShadow;
  const hoverShadow = treeTokens.nodeHoverShadow;
  const isFocused = nodeData.isFocused === true;
  const focusRing = `0 0 0 3px ${theme.palette.primary.main}`;
  const restingShadow = isFocused
    ? `${focusRing}, ${baseShadow}`
    : baseShadow;

  const containerStyle: React.CSSProperties = isOverviewMode
    ? {
        position: "relative",
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        background: nodeFill,
        border: `2px solid color-mix(in srgb, ${borderColor} 70%, white)`,
        boxShadow: isFocused
          ? `${focusRing}, ${baseShadow}, inset 0 0 0 1px rgba(255, 255, 255, 0.1)`
          : `${baseShadow}, inset 0 0 0 1px rgba(255, 255, 255, 0.1)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: canDrillDown ? "pointer" : "default",
        textAlign: "center",
        padding: "4px",
        boxSizing: "border-box",
        overflow: "hidden",
        whiteSpace: "normal",
        wordWrap: "break-word",
        fontSize: "13px",
        color: overviewTextColor,
        fontWeight: 600,
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
      }
    : {
        position: "relative",
        padding: "12px 14px",
        borderRadius: "12px",
        background: theme.palette.background.paper,
        border: `1.5px solid ${borderColor}`,
        boxShadow: restingShadow,
        textAlign: "center",
        minWidth: "150px",
        cursor: canDrillDown ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: theme.palette.text.primary,
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
      };

  const labelInputRef = useRef<HTMLInputElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && labelInputRef.current) {
      labelInputRef.current.focus();
    }
  }, [isEditing]);

  const handleBlur = (event: any) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(event.relatedTarget)
    ) {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === props.id
            ? {
                ...node,
                data: { ...node.data, label, number: Number(number) },
              }
            : node
        )
      );
      setIsEditing(false);
    }
  };

  const handleStyle: React.CSSProperties = {
    opacity: 0,
    width: 1,
    height: 1,
    minWidth: 0,
    minHeight: 0,
    border: "none",
    background: "transparent",
    pointerEvents: "none",
  };

  const inputStyle: React.CSSProperties = {
    width: "80%",
    marginBottom: "5px",
    textAlign: "center",
    background: theme.palette.background.default,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: "6px",
    padding: "4px 6px",
    fontSize: "13px",
  };

  const tooltipContent = (() => {
    if (nodeData.type === "treatment") {
      return nodeData.treatmentCatalogType ?? "Treatment";
    }

    if (nodeData.type === "characteristic") {
      if (nodeData.charType === "Primary Indication") {
        return (
          <div>
            <div>{nodeData.charType}</div>
            {nodeData.measureType && (
              <div style={{ marginTop: 4 }}>
                Measure type: {nodeData.measureType}
              </div>
            )}
            {nodeData.measureYears != null && (
              <div style={{ marginTop: 4 }}>Years: {nodeData.measureYears}</div>
            )}
          </div>
        );
      }
      return nodeData.charType ?? "Characteristic";
    }
    return "";
  })();

  const formattedSize =
    nodeData.size !== undefined ? Number(nodeData.size).toLocaleString() : "";

  const formattedRate =
    nodeData.rate !== undefined
      ? `${(Number(nodeData.rate) * 100).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}%`
      : "";

  const refCount =
    typeof nodeData.refCount === "number" ? nodeData.refCount : 0;
  const hasNotes = nodeData.hasDescription === true || refCount > 0;
  const notesBadgeTitle = [
    nodeData.hasDescription ? "Has description" : null,
    refCount > 0 ? `${refCount} reference${refCount === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const catalogStale = nodeData.catalogStale === true;
  const staleHint =
    "Embedded copy may differ from the catalog master. Edit the catalog entry or re-save the node to sync.";

  const tooltipTitle = catalogStale ? (
    <div>
      <div style={{ marginBottom: 6, fontWeight: 600 }}>{staleHint}</div>
      {tooltipContent}
    </div>
  ) : (
    tooltipContent
  );

  const hasTooltip = Boolean(tooltipTitle);

  const nodeCard = (
    <div
      ref={containerRef}
      onContextMenu={(e) => onContextMenu(e, id)}
      style={containerStyle}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = isFocused
          ? `${focusRing}, ${hoverShadow}`
          : hoverShadow;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = isOverviewMode
          ? isFocused
            ? `${focusRing}, ${baseShadow}, inset 0 0 0 1px rgba(255, 255, 255, 0.1)`
            : `${baseShadow}, inset 0 0 0 1px rgba(255, 255, 255, 0.1)`
          : restingShadow;
      }}
      onClick={() => {
        if (!isEditing && nodeData.onClick) nodeData.onClick();
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        if (nodeData?.depth > 0) setIsEditing(true);
      }}
      onBlur={handleBlur}
      tabIndex={-1}>
      {hasNotes && !isOverviewMode && (
        <span
          title={notesBadgeTitle}
          style={{
            position: "absolute",
            top: isOverviewMode ? 8 : -8,
            right: isOverviewMode ? 8 : -8,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 9,
            background: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            fontSize: "11px",
            fontWeight: 700,
            lineHeight: "18px",
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            pointerEvents: "none",
          }}>
          {refCount > 0 ? refCount : "•"}
        </span>
      )}
      {isEditing ? (
        <>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={inputStyle}
            ref={labelInputRef}
          />
          <input
            type="number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            style={inputStyle}
            ref={numberInputRef}
          />
        </>
      ) : (
        <>
          {nodeData?.label && <strong>{nodeData.label}</strong>}
          {catalogStale && (
            <div
              style={{
                color: theme.palette.warning.main,
                fontSize: "11px",
                marginTop: 4,
                lineHeight: 1.2,
              }}>
              May differ from catalog
            </div>
          )}
          {(formattedRate !== "" || nodeData?.size !== undefined) && (
            <div style={{ marginTop: 4 }}>
              {formattedRate !== "" && (
                <div style={{ color: theme.palette.text.secondary, fontSize: "12px" }}>
                  Rate: {formattedRate}
                </div>
              )}
              {nodeData?.size !== undefined && (
                <div style={{ color: theme.palette.text.secondary, fontSize: "12px", marginTop: 2 }}>
                  Size: {formattedSize}
                </div>
              )}
            </div>
          )}
        </>
      )}
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        style={handleStyle}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        style={handleStyle}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="target-bottom"
        style={handleStyle}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="source-top"
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        style={handleStyle}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        style={handleStyle}
      />
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}>
      {hasTooltip ? (
        <Tooltip title={tooltipTitle} arrow placement="bottom">
          {nodeCard}
        </Tooltip>
      ) : (
        nodeCard
      )}
      {showRegimenTag && (
        <Chip
          label="Regimen details"
          size="small"
          variant="outlined"
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenRegimenDetails?.({
              treatmentName: nodeData.label ?? "Treatment",
              treatmentCatalogType: nodeData.treatmentCatalogType ?? null,
              regimen: nodeData.regimen,
              alternatives: nodeData.alternatives,
            });
          }}
          sx={{
            mt: 0.75,
            height: 22,
            fontSize: "10px",
            cursor: "pointer",
            borderColor: treeTokens.treatment,
            color: treeTokens.treatment,
            "&:hover": {
              bgcolor: "action.hover",
            },
          }}
        />
      )}
    </div>
  );
};

export default CustomNode;
