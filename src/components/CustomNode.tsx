import React, { useState } from "react";
import { Handle, Position, useReactFlow } from "reactflow";

const CustomNode = ({ id, data }: { id: string; data: { label: string; number: number } }) => {
    const { setNodes } = useReactFlow(); // ✅ Get setNodes from React Flow
    const [isEditing, setIsEditing] = useState(false);
    const [label, setLabel] = useState(data.label);
    const [number, setNumber] = useState(data.number.toString()); // Store as string to prevent auto-blur

    // Update node only when editing is finished (onBlur)
    const handleBlur = () => {
        setNodes((nodes) =>
            nodes.map((node) =>
                node.id === id
                    ? { ...node, data: { ...node.data, label, number: Number(number) } }
                    : node
            )
        );
        setIsEditing(false);
    };

    return (
        <div
            style={{
                padding: "10px",
                borderRadius: "5px",
                background: "#fff",
                border: "1px solid #ddd",
                textAlign: "center",
                minWidth: "150px",
                cursor: "pointer",
            }}
            onDoubleClick={() => setIsEditing(true)} // Enable editing on double-click
        >
            {isEditing ? (
                <>
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        onBlur={handleBlur}
                        autoFocus
                        style={{ width: "100%", marginBottom: "5px", textAlign: "center" }}
                    />
                    <input
                        type="number"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)} // Keep as string
                        onBlur={handleBlur}
                        style={{ width: "100%", textAlign: "center" }}
                    />
                </>
            ) : (
                <>
                    <div style={{ fontSize: "12px", color: "#666" }}>{data.label}</div>
                    <div style={{ fontSize: "12px", color: "#666" }}>{data.number}</div> {/* Number under label */}
                </>
            )}

            <Handle type="target" position={Position.Top} />
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
};

export default CustomNode;
