import React, { useState, useEffect, useRef } from "react";
import { Handle, Position, useReactFlow } from "reactflow";
import { useNavigate } from "react-router-dom";
import { Tooltip } from "@mui/material";
import { NodeProps } from "reactflow";


const CustomNode = (
  props: NodeProps & {
    onContextMenu: (e: React.MouseEvent, id: string) => void;
  }
) => {
  const { id, data: nodeData, onContextMenu } = props;
  const [label, setLabel] = useState(nodeData.label);
  const navigate = useNavigate();
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);

  const [number, setNumber] = useState(() => {
    const num = nodeData?.number;
    return typeof num === "number" || typeof num === "string"
      ? num.toString()
      : "1";
  });

  // Choose border color by type:
  const borderColor =
    nodeData?.type === "characteristic"
      ? "#2196f3" // Blue for characteristic
      : nodeData?.type === "treatment"
      ? "#4caf50" // Green for treatment
      : "#ddd";

  // For overview nodes: fixed square dimensions so 50% borderRadius = circle
  // For drilled‐in nodes: keep them as rounded rectangles (8px radius)
  const isOverview = nodeData.isOverview === true;
  const containerStyle: React.CSSProperties = isOverview
    ? {
        // FORCE a square:
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        background: nodeData.color || "#ffffff",
        border: `2px solid ${borderColor}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        textAlign: "center",
        padding: "0", // no extra top/bottom padding
      }
    : {
        // Drilled‐in style: keep your existing rounded‐rectangle look
        padding: "10px",
        borderRadius: "8px",
        background: "#ffffff",
        border: `2px solid ${borderColor}`,
        textAlign: "center",
        minWidth: "150px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      };

  const labelInputRef = useRef<HTMLInputElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { fitView } = useReactFlow();
  useEffect(() => {
    setTimeout(() => {
      fitView();
    }, 300);
  }, [isOverview]);
  

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

  return (
    <Tooltip
      title={
        nodeData.type === "treatment" ? (
          nodeData.alternatives && nodeData.alternatives.length > 0 ? (
            <div>
              {nodeData.alternatives.map((alt: any, i: number) => (
                <div key={i} style={{ marginBottom: "8px" }}>
                  <strong>
                    {alt.name} (Ratio: {alt.ratio})
                  </strong>
                  {alt.regimen?.drugs && Array.isArray(alt.regimen.drugs) && (
                    <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                      {alt.regimen.drugs.map((d: any, j: number) => (
                        <li key={j}>
                          {d.drug.name} – {d.drug.strength} {d.drug.unit} (Consumption:{" "}
                          {d.annual_patient_con})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : Array.isArray(nodeData.regimen?.drugs) &&
            nodeData.regimen.drugs.length > 0 ? (
            <div>
              {nodeData.regimen.drugs.map((d: any, i: number) => (
                <div key={i}>
                  {d.drug.name} – {d.drug.strength} {d.drug.unit} (Consumption:{" "}
                  {d.annual_patient_con})
                </div>
              ))}
            </div>
          ) : (
            "No drug info available"
          )
        ) : (
          ""
        )
      }
      arrow
      placement="bottom"
    >
      <div
        ref={containerRef}
        onContextMenu={(e) => onContextMenu(e, id)}
        style={containerStyle}
        onClick={() => {
          if (!isEditing) nodeData.onClick?.();
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          if (nodeData?.depth > 0) setIsEditing(true);
        }}
        onBlur={handleBlur}
        tabIndex={-1}
      >
        {isEditing ? (
          <>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={{
                width: "80%",
                marginBottom: "5px",
                textAlign: "center",
              }}
              ref={labelInputRef}
            />
            <input
              type="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              style={{
                width: "80%",
                textAlign: "center",
                WebkitAppearance: "none",
                appearance: "none",
                MozAppearance: "textfield",
              }}
              ref={numberInputRef}
            />
          </>
        ) : (
          <>
            {nodeData?.label && <strong>{nodeData.label}</strong>}
            {nodeData?.size !== undefined && <div>Size: {nodeData.size}</div>}
          </>
        )}
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
      </div>
    </Tooltip>
  );
};

export default CustomNode;
