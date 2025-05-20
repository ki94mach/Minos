import React, { useState, useEffect, useRef } from "react";
import { Handle, Position, useReactFlow } from "reactflow";
import { useNavigate } from "react-router-dom";
import { Tooltip } from "@mui/material";

const CustomNode = ({ id, data }: { id: string; data: any  }) => {
    const navigate = useNavigate();
    const { setNodes, getNodes } = useReactFlow();
    const [isEditing, setIsEditing] = useState(false);
    const [label, setLabel] = useState(data.label);
    const [number, setNumber] = useState(() => {
        const num = data?.number;
        return typeof num === "number" || typeof num === "string" ? num.toString() : "1";
    });

    const borderColor =
    data?.type === "characteristic"
      ? "#2196f3" // Blue for characteristic
      : data?.type === "treatment"
      ? "#4caf50" // Green for treatment
      : "#ddd";   // Default    

    const labelInputRef = useRef<HTMLInputElement>(null);
    const numberInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const isTreatment = data?.type === "treatment";

    useEffect(() => {
        if (isEditing) {
            if (labelInputRef.current) {
                labelInputRef.current.focus();
            }
        }
    }, [isEditing]);

    const handleBlur = (event: any) => {
        if (
            containerRef.current &&
            !containerRef.current.contains(event.relatedTarget)
        ) {
            setNodes((nodes) =>
                nodes.map((node) =>
                    node.id === id
                        ? { ...node, data: { ...node.data, label, number: Number(number) } }
                        : node
                )
            );
            setIsEditing(false);
        }
    };

    // useEffect(() => {
    //     const nodes = getNodes();
    //     console.log("Number of nodes:", nodes.length);
    // }, [getNodes]);

    return (
            <Tooltip
            title={
                isTreatment ? (
                  data.alternatives && data.alternatives.length > 0 ? (
                    <div>
                      {data.alternatives.map((alt: any, i: number) => (
                        <div key={i} style={{ marginBottom: "8px" }}>
                          <strong>{alt.name}</strong>
                          {alt.regimen?.drugs && Array.isArray(alt.regimen.drugs) && (
                            <ul style={{ paddingLeft: "16px", marginTop: "4px" }}>
                              {alt.regimen.drugs.map((d: any, j: number) => (
                                <li key={j}>
                                  {d.drug.name} – {d.drug.strength} {d.drug.unit}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // fallback if no alternatives
                    Array.isArray(data?.drugs) && data.drugs.length > 0 ? (
                      <div>
                        {data.drugs.map((d: any, i: number) => (
                          <div key={i}>
                            {d.name} – {d.strength} {d.unit}
                          </div>
                        ))}
                      </div>
                    ) : (
                      "No drug info available"
                    )
                  )
                ) : ""
              }
              arrow
              placement="bottom"
            >
              <div
                ref={containerRef}
                style={{
                  padding: "10px",
                  borderRadius: "5px",
                  background: "#fff",
                  border: `2px solid ${borderColor}`,
                  textAlign: "center",
                  minWidth: "150px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}
                onClick={() => {
                  if (!isEditing) data.onClick?.();
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  if (data?.depth > 0) setIsEditing(true);
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
                      style={{ width: "80%", marginBottom: "5px", textAlign: "center" }}
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
                        MozAppearance: "textfield"
                      }}
                      ref={numberInputRef}
                    />
                  </>
                ) : (
                  <>
                    {data?.label && <strong>{data.label}</strong>}
                    {data?.size !== undefined && <div>Size: {data.size}</div>}
                  </>
                )}
                <Handle type="target" position={Position.Top} />
                <Handle type="source" position={Position.Bottom} />
              </div>
            </Tooltip>
          );
};

export default CustomNode;
