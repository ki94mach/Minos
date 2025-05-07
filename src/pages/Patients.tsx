import React, { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
  NodeProps,
  NodeTypes,
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
  TextField,
  Box,
} from "@mui/material";
import axios from "axios";
import BackButton from "../components/BackButton";
import CustomNode from "../components/CustomNode";
import Cookies from "js-cookie";

/* -------------------------------------------------------------------------- */
/*                                helpers                                     */
/* -------------------------------------------------------------------------- */
interface CustomNodeProps extends NodeProps {
  setNodes?: React.Dispatch<React.SetStateAction<any[]>>;
}

const nodeTypes: NodeTypes = {
  custom: (props: NodeProps) => <CustomNode {...props} />,
};

/* -------------------------------------------------------------------------- */
/*                               component                                    */
/* -------------------------------------------------------------------------- */
const Patients: React.FC = () => {
  /* ------------------------------ state ----------------------------------- */
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [selectedPopulation, setSelectedPopulation] = useState("");
  const [customPopulationNumber, setCustomPopulationNumber] = useState("");

  const [charTypes, setCharTypes] = useState<string[]>([]);
  const [charNames, setCharNames] = useState<string[]>([]);
  const [allCharacteristics, setAllCharacteristics] = useState<
    { _id: string; type: string; name: string }[]
  >([]);
  const [selectedCharType, setSelectedCharType] = useState<string>("");
  const [selectedCharName, setSelectedCharName] = useState<string>("");
  const [selectedCharObj, setSelectedCharObj] = useState<
    | { _id: string; type: string; name: string }
    | null
  >(null);

  /* ----------------------------- effects ---------------------------------- */
  // fetch patients list for the list‑view (grid at top of page)
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const { data } = await axios.get("http://localhost:5000/api/patients");
        const parsedPatients = data.map((item: string) => JSON.parse(item));

        const formattedNodes = parsedPatients.map((patient: any, index: number) => {
          const nodeType = patient.node.node_type;
          const base = {
            id: patient._id?.$oid || patient._id,
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
                drugs,
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
      } catch (err) {
        console.error("Error fetching patients:", err);
      }
    };

    const fetchCharacteristics = async () => {
      try {
        const { data } = await axios.get(
          "http://localhost:5000/api/characteristics"
        );
        const parsed = data.map((item: string) => {
          const obj = JSON.parse(item);
          return { ...obj, _id: obj._id.$oid };
        });

        setAllCharacteristics(parsed);
        const uniqueTypes = Array.from(
            new Set<string>(parsed.map((char: any) => char.type))
          );
          setCharTypes(uniqueTypes);
          if (uniqueTypes.length > 0) setSelectedCharType(uniqueTypes[0]);
      } catch (err) {
        console.error("Error fetching characteristics:", err);
      }
    };

    fetchPatients();
    fetchCharacteristics();
  }, []);

  // update names list when the type changes
  useEffect(() => {
    if (!selectedCharType) return;
    const filteredNames = allCharacteristics
      .filter((c) => c.type === selectedCharType)
      .map((c) => c.name);
    setCharNames(filteredNames);
    setSelectedCharName("");
  }, [selectedCharType, allCharacteristics]);

  /* --------------------- react‑flow edge connect -------------------------- */
  const onConnect = useCallback(
    (connection: Edge | Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  /* -------------------------- form submit -------------------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      selectedPopulation === "Custom Population" &&
      customPopulationNumber.trim() === ""
    ) {
      alert("Please enter a valid population number.");
      return;
    }

    const populationNumber =
      selectedPopulation === "Custom Population"
        ? Number(customPopulationNumber)
        : null;

    try {
      const csrfToken = Cookies.get("csrf_token");
      const config = {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken || "",
        },
      };

      const { data } = await axios.post(
        "http://localhost:5000/api/patients",
        {
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
        },
        config
      );

      /* After creating a patient, re‑draw the entire map */
      await drawPatientNodes();
      alert("Patient tree created and displayed!");
    } catch (err) {
      console.error("Error during patient creation:", err);
      alert("Failed to create patient tree.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /*   Build the merged graph of *all* patient trees without duplicates     */
  /* ---------------------------------------------------------------------- */
  const drawPatientNodes = async () => {
    try {
      const { data } = await axios.get("http://localhost:5000/api/patients");
      const parsedPatients = data.map((item: string) => JSON.parse(item));

      /* -------------------------------------------------------------
       * Global registries for this draw call – one per _run_.
       * ----------------------------------------------------------- */
      const nodesById = new Map<string, any>(); // deduplication map
      const edges: Edge[] = [];
      const rootPositions = new Map<string, { x: number; y: number }>();

      let nextRootX = 0; // running horizontal offset for new root nodes

      /* -------------------------------------------------------------
       * recursive DFS that respects the global registries
       * ----------------------------------------------------------- */
      const buildFlowNodes = (
        node: any,
        depth: number,
        index: number,
        parentId: string | null = null,
        parentX = 0
      ) => {
        const nodeId = node._id?.$oid || node._id;

        /* 1️⃣  Add a node only the first time we meet its _id */
        if (!nodesById.has(nodeId)) {
          // decide position
          let position: { x: number; y: number };
          if (depth === 0) {
            if (rootPositions.has(nodeId)) {
              position = rootPositions.get(nodeId)!;
            } else {
              position = { x: nextRootX, y: 0 };
              rootPositions.set(nodeId, position);
              nextRootX += 300; // space between root trees
            }
          } else {
            position = { x: parentX + index * 200, y: depth * 180 };
          }

          nodesById.set(nodeId, {
            id: nodeId,
            position,
            type: "custom",
            data: {
              label:
                node.characteristic_data?.name ||
                node.treatment_data?.name ||
                "Node",
              type: node.node_type,
              size: node.size,
              rate: node.rate,
              drugs:
                node.treatment_data?.regimen?.drugs?.map((d: any) => d.drug) || [],
            },
          });
        }

        /* 2️⃣  Edge creation – many edges can point to the same node */
        if (parentId) {
          edges.push({
            id: `${parentId}->${nodeId}`,
            source: parentId,
            target: nodeId,
          });
        }

        /* 3️⃣  Recurse over children */
        (node.children || []).forEach((child: any, i: number) =>
          buildFlowNodes(child, depth + 1, i, nodeId, nodesById.get(nodeId)!.position.x)
        );
      };

      /* walk every patient's tree */
      parsedPatients.forEach((p: any) => {
        if (p.tree) buildFlowNodes(p.tree, 0, 0);
      });

      setNodes(Array.from(nodesById.values()));
      setEdges(edges);
    } catch (err) {
      console.error("Error drawing patients:", err);
      alert("Failed to draw patients.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /*                                  UI                                    */
  /* ---------------------------------------------------------------------- */
  return (
    <Container maxWidth="md" className="py-8">
      <BackButton />
      <Typography variant="h3" align="center" className="mb-8">
        Patient Map Management
      </Typography>

      {/* ---------------------- new patient form ----------------------- */}
      <Card className="mb-8">
        <CardContent>
          <Typography variant="h5" gutterBottom>
            New Patient Tree
          </Typography>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Characteristic Type</InputLabel>
                  <Select
                    value={selectedCharType}
                    label="Characteristic Type"
                    onChange={(e) => setSelectedCharType(e.target.value)}
                  >
                    {charTypes.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth disabled={!selectedCharType}>
                  <InputLabel>Characteristic Name</InputLabel>
                  <Select
                    value={selectedCharName}
                    label="Characteristic Name"
                    onChange={(e) => {
                      const name = e.target.value;
                      setSelectedCharName(name);
                      const found = allCharacteristics.find(
                        (c) => c.name === name && c.type === selectedCharType
                      );
                      setSelectedCharObj(found || null);
                    }}
                  >
                    {charNames.map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Population</InputLabel>
                  <Select
                    value={selectedPopulation}
                    label="Population"
                    onChange={(e) => setSelectedPopulation(e.target.value)}
                  >
                    <MenuItem value="Custom Population">Custom Population</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {selectedPopulation === "Custom Population" && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    type="number"
                    label="Enter Population Number"
                    inputProps={{ min: 1 }}
                    value={customPopulationNumber}
                    onChange={(e) => setCustomPopulationNumber(e.target.value)}
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

      {/* -------------------- draw/refresh button ---------------------- */}
      <Button
        variant="contained"
        color="secondary"
        fullWidth
        className="my-4"
        onClick={drawPatientNodes}
      >
        Draw Patients Map
      </Button>

      {/* ------------------------- legend ----------------------------- */}
      <Box display="flex" gap={2} alignItems="center" mb={1}>
        <Box display="flex" alignItems="center">
          <Box width={16} height={16} bgcolor="#2196f3" borderRadius={1} mr={1} />
          <Typography variant="body2">Characteristic</Typography>
        </Box>
        <Box display="flex" alignItems="center">
          <Box width={16} height={16} bgcolor="#4caf50" borderRadius={1} mr={1} />
          <Typography variant="body2">Treatment</Typography>
        </Box>
      </Box>

      {/* ----------------------- react‑flow --------------------------- */}
      <div style={{ height: 500, width: "100%", border: "1px solid #ddd" }}>
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
