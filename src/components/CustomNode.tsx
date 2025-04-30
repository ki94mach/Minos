import React, { useState, useEffect, useRef } from "react";
import { Handle, Position, useReactFlow } from "reactflow";

const CustomNode = ({ id, data }: { id: string; data: any  }) => {
    const { setNodes, getNodes } = useReactFlow();
    const [isEditing, setIsEditing] = useState(false);
    const [label, setLabel] = useState(data.label);
    const [number, setNumber] = useState(() => {
        const num = data?.number;
        return typeof num === "number" || typeof num === "string" ? num.toString() : "1";
    });

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
        <div
            ref={containerRef}
            style={{
                padding: "10px",
                borderRadius: "5px",
                background: "#fff",
                border: "1px solid #ddd",
                textAlign: "center",
                minWidth: "150px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center"
            }}
            onDoubleClick={(e) => {
                e.preventDefault();
                setIsEditing(true);
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
                    <style>{`
                        /* Remove spinner elements for Webkit browsers */
                        input[type="number"]::-webkit-outer-spin-button,
                        input[type="number"]::-webkit-inner-spin-button {
                            -webkit-appearance: none;
                            margin: 0;
                        }

                        /* Remove spinner elements for Firefox */
                        input[type="number"] {
                            -moz-appearance: textfield;
                        }
                    `}</style>
                </>
            ) : (
                <>
                    {data?.label && <strong>{data.label}</strong>}
                    {data?.number && <div>{data.number}</div>}
                    {isTreatment && Array.isArray(data?.drugs) && (
                        <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
                            {data.drugs.map((d: any, i: number) => (
                                <li key={i} style={{ marginTop: "4px" }}>
                                    {d.name} - {d.strength} {d.unit}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            <Handle type="target" position={Position.Top} />
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
};

export default CustomNode;
