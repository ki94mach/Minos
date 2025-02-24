import React, {useCallback, useEffect, useState} from "react";
import ReactFlow, {
    addEdge,
    MiniMap,
    Controls,
    Background,
    useEdgesState,
    useNodesState,
    Connection,
    Edge
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
    MenuItem, TextField,
} from "@mui/material";
import axios from "axios";
import BackButton from "../components/BackButton";

const Patients: React.FC = () => {
    const initialNodes = [
        { id: "1", position: { x: 250, y: 5 }, data: { label: "Patient A" } },
        { id: "2", position: { x: 100, y: 100 }, data: { label: "Treatment X" } },
        { id: "3", position: { x: 400, y: 100 }, data: { label: "Drug Y" } }
    ];
    const initialEdges = [{ id: "e1-2", source: "1", target: "2", label: "Treated With" }];

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect = useCallback(
        (connection: Edge | Connection) => setEdges((eds) => addEdge(connection, eds)),
        [setEdges]
    );
    const populations = {
        "Iran Population": 90000000,
        "Tehran Population": 9000000,
        "Mashhad Population": 3000000,
        "Shiraz Population": 2000000,
        "Tabriz Population": 1600000,
        "Custom Population": null
    };
    const [selectedPopulations, setSelectedPopulations] = useState<string>("");
    const [customPopulationNumber, setCustomPopulationNumber] = useState<string>("");
    const [primaryIndications, setPrimaryIndications] = useState<string[]>([]);
    const [charTypes, setCharTypes] = useState<string[]>([]);
    const [charNames, setCharNames] = useState<string[]>([]);

    const [selectedPopulation, setSelectedPopulation] = useState<string>("");
    const [selectedPrimaryIndication, setSelectedPrimaryIndication] = useState<string>("");
    const [selectedCharType, setSelectedCharType] = useState<string>("");
    const [selectedCharName, setSelectedCharName] = useState<string>("");

    useEffect(() => {
        const fetchCharacteristics = async () => {
            try {
                const response = await axios.get("http://localhost:5000/api/characteristics");
                setPrimaryIndications(response.data.primary_indication || []);
                setCharTypes(response.data.other_characteristics_type || []);
                setCharNames(response.data.other_characteristics_name || []);
            } catch (error) {
                console.error("Error fetching patient characteristics:", error);
            }
        };
        fetchCharacteristics();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        let finalPopulation = selectedPopulation;
        let populationNumber = populations[selectedPopulation as keyof typeof populations];
        if (selectedPopulation === "Custom Population") {
            if (!customPopulationNumber) {
                alert("Please enter a custom population number.");
                return;
            }
            populationNumber = Number(customPopulationNumber);
        }

        // alert(`Population Selected: ${finalPopulation}`);

        try {
            await axios.post("http://localhost:3000/patients", {
                population: populationNumber,
                primary_indication: selectedPrimaryIndication,
                char_type: selectedCharType,
                char_name: selectedCharName,
            });
            alert("Search completed and patient map updated!");
        } catch (error) {
            console.error("Error during patient search:", error);
            alert("Failed to fetch patient data.");
        }
    };

    return (
        <Container maxWidth="md" sx={{mt: 5}}>
            <BackButton/>
            <Typography variant="h3" align="center" sx={{mb: 4}}>
                Patient Map Management
            </Typography>

            <Card sx={{mb: 4}}>
                <CardContent>
                    <Typography variant="h5" gutterBottom>Search Patients</Typography>
                    <form onSubmit={handleSubmit}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Population</InputLabel>
                                    <Select
                                        value={selectedPopulation}
                                        onChange={(e) => setSelectedPopulation(e.target.value)}
                                        label="Population"
                                    >
                                        {Object.keys(populations).map((pop) => (
                                            <MenuItem key={pop} value={pop}>{pop}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {selectedPopulation === "Custom Population" && (
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Enter Custom Population Number"
                                        type="number"
                                        value={customPopulationNumber}
                                        onChange={(e) => setCustomPopulationNumber(e.target.value)}
                                        inputProps={{ min: "1" }}
                                        required
                                    />
                                </Grid>
                            )}

                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Primary Indication</InputLabel>
                                    <Select
                                        value={selectedPrimaryIndication}
                                        onChange={(e) => setSelectedPrimaryIndication(e.target.value)}
                                        label="Primary Indication"
                                    >
                                        {primaryIndications.map((pi) => (
                                            <MenuItem key={pi} value={pi}>{pi}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

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
                                        onChange={(e) => setSelectedCharName(e.target.value)}
                                        label="Characteristic Name"
                                    >
                                        {charNames.map((cname) => (
                                            <MenuItem key={cname} value={cname}>{cname}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12}>
                                <Button type="submit" variant="contained" fullWidth>
                                    Search
                                </Button>
                            </Grid>
                        </Grid>
                    </form>
                </CardContent>
            </Card>

            <div style={{height: "500px", width: "100%", border: "1px solid #ddd"}}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    fitView
                >
                    {/*<MiniMap/>*/}
                    {/*<Controls/>*/}
                    <Background gap={12} size={1}/>
                </ReactFlow>
            </div>
            {/*<Card>*/}
            {/*    <CardContent>*/}
            {/*        <Typography variant="h5" gutterBottom>Patient Map Visualization</Typography>*/}
            {/*        <iframe*/}
            {/*            src="http://localhost:5000/static/pyvis_graph.html"*/}
            {/*            width="100%"*/}
            {/*            height="600"*/}
            {/*            style={{ border: "none" }}*/}
            {/*            title="Patient Graph"*/}
            {/*        ></iframe>*/}
            {/*    </CardContent>*/}
            {/*</Card>*/}
        </Container>
    );
};

export default Patients;
