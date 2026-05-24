import React, { useState, useEffect, useRef } from "react";
import { Handle, Position, useReactFlow, NodeProps } from "reactflow";
import { Tooltip, useTheme } from "@mui/material";
import { treeTokens, textOnColor } from "../theme/theme";

const CustomNode = (
  props: NodeProps & {
    onContextMenu: (e: React.MouseEvent, id: string) => void;
  }
) => {
  const theme = useTheme();
  const { id, data: nodeData, onContextMenu } = props;
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
  const nodeFill = nodeData.color || theme.palette.background.paper;
  const overviewTextColor =
    isOverviewMode && nodeData.color
      ? textOnColor(nodeData.color)
      : theme.palette.text.primary;

  const baseShadow = treeTokens.nodeShadow;
  const hoverShadow = treeTokens.nodeHoverShadow;

  const containerStyle: React.CSSProperties = isOverviewMode
    ? {
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        background: nodeFill,
        border: `2px solid color-mix(in srgb, ${borderColor} 70%, white)`,
        boxShadow: `${baseShadow}, inset 0 0 0 1px rgba(255, 255, 255, 0.1)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
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
        padding: "12px 14px",
        borderRadius: "12px",
        background: theme.palette.background.paper,
        border: `1.5px solid ${borderColor}`,
        boxShadow: baseShadow,
        textAlign: "center",
        minWidth: "150px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: theme.palette.text.primary,
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
      };

  const labelInputRef = useRef<HTMLInputElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { fitView } = useReactFlow();
  useEffect(() => {
    setTimeout(() => {
      fitView();
    }, 300);
  }, [isOverviewMode, fitView]);

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
      if (nodeData.alternatives?.length) {
        return (
          <div>
            {nodeData.alternatives.map((alt: any, i: number) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <strong>
                  {alt.name} (Ratio: {alt.ratio})
                </strong>
                {!!alt.regimen?.drugs?.length && (
                  <ul style={{ paddingLeft: 16, marginTop: 4 }}>
                    {alt.regimen.drugs.map((d: any, j: number) => (
                      <li key={j}>
                        {d.drug.name} – {d.drug.strength} {d.drug.unit}
                        (Consumption: {d.annual_patient_con})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        );
      }

      if (nodeData.regimen?.drugs?.length) {
        return (
          <div>
            {nodeData.regimen.drugs.map((d: any, i: number) => (
              <div key={i}>
                {d.drug.name} – {d.drug.strength} {d.drug.unit}
                (Consumption: {d.annual_patient_con})
              </div>
            ))}
          </div>
        );
      }
      return "No drug info available";
    }

    if (nodeData.type === "characteristic") {
      return nodeData.charType ?? "Characteristic";
    }
    return "";
  })();

  const formattedSize =
    nodeData.size !== undefined ? Number(nodeData.size).toLocaleString() : "";

  return (
    <Tooltip title={tooltipContent} arrow placement="bottom">
      <div
        ref={containerRef}
        onContextMenu={(e) => onContextMenu(e, id)}
        style={containerStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = hoverShadow;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = baseShadow;
        }}
        onClick={() => {
          if (!isEditing) nodeData.onClick?.();
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          if (nodeData?.depth > 0) setIsEditing(true);
        }}
        onBlur={handleBlur}
        tabIndex={-1}>
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
            {nodeData?.size !== undefined && (
              <div style={{ color: theme.palette.text.secondary, fontSize: "12px", marginTop: 4 }}>
                Size: {formattedSize}
              </div>
            )}
          </>
        )}
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: borderColor, border: "none", width: 8, height: 8 }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: borderColor, border: "none", width: 8, height: 8 }}
        />
      </div>
    </Tooltip>
  );
};

export default CustomNode;
