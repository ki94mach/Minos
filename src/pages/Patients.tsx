import React, { useCallback, useEffect, useState } from "react";
import ReactFlow, {
    addEdge,
    Background,
    useEdgesState,
    useNodesState,
    Connection,
    Edge,
    NodeProps,
    NodeTypes
} from "reactflow";
import "reactflow/dist/style.css";
import {
    Container,
    Typography,
    Card,
    CardContent,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField
} from "@mui/material";
import axios from "axios";
import BackButton from "../components/BackButton";
import CustomNode from "../components/CustomNode";
import Cookies from "js-cookie";

interface CustomNodeProps extends NodeProps {
    setNodes?: React.Dispatch<React.SetStateAction<any[]>>;
}

const nodeTypes: NodeTypes = {
    custom: (props: NodeProps) => <CustomNode {...props} />
};

const Patients: React.FC = () => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedPopulation, setSelectedPopulation] = useState("");
    const [customPopulationNumber, setCustomPopulationNumber] = useState("");
    const [charTypes, setCharTypes] = useState<string[]>([]);
    const [charNames, setCharNames] = useState<string[]>([]);
    const [selectedCharObj, setSelectedCharObj] = useState<{ _id: string; type: string; name: string } | null>(null);
    const [selectedCharType, setSelectedCharType] = useState("");
    const [selectedCharName, setSelectedCharName] = useState("");
    const [allCharacteristics, setAllCharacteristics] = useState<{ _id: string; type: string; name: string }[]>([]);
    const [nodeType, setNodeType] = useState("characteristic");
    const [selectedTreatmentId, setSelectedTreatmentId] = useState("");
    const [treatments, setTreatments] = useState<any[]>([]);


    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const response = await axios.get("http://localhost:5000/api/patients");
                const parsedPatients = response.data.map((item: string) => JSON.parse(item));
                const formattedNodes = parsedPatients.map((patient: any, index: number) => {
                    const nodeType = patient.node.node_type;
                    const base = {
                        id: patient._id,
                        position: { x: index * 200, y: 100 },
                        type: "custom" as const,
                    };
                
                    if (nodeType === "treatment") {
                        const treatment = patient.node.treatment_data;
                        const drugs = treatment.regimen?.drugs?.map((d: any) => d.drug) || [];
                        return {
                            ...base,
                            data: {
                                label: treatment.name,
                                number: index + 1,
                                type: nodeType,
                                drugs: drugs,
                            },
                        };
                    }
                
                    return {
                        ...base,
                        data: {
                            label: patient.node.characteristic_data.name,
                            number: index + 1,
                            type: nodeType,
                        },
                    };
                });
                setNodes(formattedNodes);
            } catch (error) {
                console.error("Error fetching patients:", error);
            }
        };

        const fetchCharacteristics = async () => {
            try {
                const response = await axios.get("http://localhost:5000/api/characteristics");
                const parsed = response.data.map((item: string) => {
                    const obj = JSON.parse(item);
                    return { ...obj, _id: obj._id.$oid };
                });

                setAllCharacteristics(parsed);
    
                const uniqueTypes = Array.from(new Set(parsed.map((char: any) => char.type)));
                setCharTypes(uniqueTypes as string[]);
    
                // Optionally, pre-populate names for the first type
                if (uniqueTypes.length > 0) {
                    // const names = parsed
                    //     .filter((char: any) => char.type === uniqueTypes[0])
                    //     .map((char: any) => char.name);
                    setSelectedCharType(uniqueTypes[0] as string);
                    // setCharNames(names);
                }
            } catch (error) {
                console.error("Error fetching characteristics:", error);
            }
        };
    
        fetchPatients();
        fetchCharacteristics();
    }, []);

    useEffect(() => {
        if (selectedCharType) {
            const filteredNames = allCharacteristics
                .filter((char) => char.type === selectedCharType)
                .map((char) => char.name);
            setCharNames(filteredNames);
            setSelectedCharName("");
        }
    }, [selectedCharType, allCharacteristics]);
    

    const onConnect = useCallback(
        (connection: Edge | Connection) => setEdges((eds) => addEdge(connection, eds)),
        [setEdges]
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPopulation === "Custom Population" && customPopulationNumber === "") {
            alert("Please enter a valid population number.");
            return;
        }
    
        const populationNumber = selectedPopulation === "Custom Population"
            ? Number(customPopulationNumber)
            : null;
    
        try {
            // await axios.get("http://localhost:5000/auth/register", {
            //     withCredentials: true,
            //   });

            const csrfToken = Cookies.get("csrf_token");
    
            const config = {
                withCredentials: true,
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken || "",
                },
            };
    
            const response = await axios.post("http://localhost:5000/api/patients", {
                node: {
                    node_type: "characteristic",
                    rate: 1.0,
                    size: populationNumber,
                    characteristic_data: {
                        _id: selectedCharObj?._id,
                        char_type: selectedCharType,
                        name: selectedCharName,
                    },
                },
            }, config);
    
            const newPatientId = response.data.id;
    
            const fullTreeResponse = await axios.get(`http://localhost:5000/api/patients`);
            const fullTreeParsedPatients = fullTreeResponse.data.map((item: string) => JSON.parse(item));

            const newPatient = fullTreeParsedPatients.find((p: any) =>
                (p._id?.$oid || p._id) === response.data.id
              );
            if (!newPatient) throw new Error("Patient not found in list.");
    
            const buildFlowNodes = (node: any, depth: number, index: number, parentId: string | null = null):  { nodes: any[]; edges: any[] } => {
                const nodeId = node._id?.$oid || node._id || `${Math.random()}`;
                const thisNode = {
                    id: nodeId,
                    position: { x: index * 250, y: depth * 180 },
                    type: "custom",
                    data: {
                    label: node.characteristic_data?.name || node.treatment_data?.name || "Node",
                    type: node.node_type,
                    rate: node.rate,
                    size: node.size,
                    drugs: node.treatment_data?.regimen?.drugs?.map((d: any) => d.drug) || [],
                    },
                };

                const edge = parentId
                    ? [{ id: `${parentId}->${nodeId}`, source: parentId, target: nodeId }]
                    : [];

                const children = node.children || [];
                const childResults = children.map((child: any, i: number) =>
                    buildFlowNodes(child, depth + 1, i, nodeId)
                );

                return {
                    nodes: [thisNode, ...childResults.flatMap((res: any) => res.nodes)],
                    edges: [...edge, ...childResults.flatMap((res: any) => res.edges)],
                };
            };
    
            const { nodes: treeNodes, edges: treeEdges }  = buildFlowNodes(newPatient.tree, 0, 0);
            setNodes(treeNodes);
            setEdges(treeEdges);
            console.log("Final treeNodes:", treeNodes);
            console.log("Final treeEdges:", treeEdges);

            alert("Patient tree created and displayed!");
        } catch (error) {
            console.error("Error during patient creation:", error);
            alert("Failed to create patient tree.");
        }
    };
    

    return (
        <Container maxWidth="md" sx={{ mt: 5 }}>
            <BackButton />
            <Typography variant="h3" align="center" sx={{ mb: 4 }}>
                Patient Map Management
            </Typography>

            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Typography variant="h5" gutterBottom>New Patient Tree</Typography>
                    <form onSubmit={handleSubmit}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Characteristic Type</InputLabel>
                                    <Select
                                        value={selectedCharType}
                                        onChange={(e) => setSelectedCharType(e.target.value)}
                                        label="Characteristic Type"
                                    >
                                        {charTypes.map((ctype) => (
                                            <MenuItem key={ctype} value={ctype}>{ctype}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Characteristic Name</InputLabel>
                                    <Select
                                        value={selectedCharName}
                                        onChange={(e) => {
                                            const selectedName = e.target.value;
                                            setSelectedCharName(selectedName);
                                            const found = allCharacteristics.find((char) => char.name === selectedName && char.type === selectedCharType);
                                            setSelectedCharObj(found || null);
                                        }}
                                        label="Characteristic Name"
                                        disabled={!selectedCharType}
                                    >
                                        {charNames.map((cname) => (
                                            <MenuItem key={cname} value={cname}>{cname}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Population</InputLabel>
                                    <Select
                                        value={selectedPopulation}
                                        onChange={(e) => setSelectedPopulation(e.target.value)}
                                        label="Population"
                                    >
                                        <MenuItem value="Custom Population">Custom Population</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            {selectedPopulation === "Custom Population" && (
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Enter Population Number"
                                        type="number"
                                        value={customPopulationNumber}
                                        onChange={(e) => setCustomPopulationNumber(e.target.value)}
                                        inputProps={{ min: "1" }}
                                        required
                                    />
                                </Grid>
                            )}

                            <Grid item xs={12}>
                                <Button type="submit" variant="contained" fullWidth>
                                    Create Patient Tree
                                </Button>
                            </Grid>
                        </Grid>
                    </form>
                </CardContent>
            </Card>

            <div style={{ height: "500px", width: "100%", border: "1px solid #ddd" }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    fitView
                    nodeTypes={nodeTypes}
                >
                    <Background gap={12} size={1} />
                </ReactFlow>
            </div>
        </Container>
    );
};

export default Patients;
