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
import { useNavigate, useParams } from "react-router-dom";
import { useLocation } from "react-router-dom";

/* -------------------------------------------------------------------------- */
/*                                helpers                                     */
/* -------------------------------------------------------------------------- */
// interface PatientsProps {
//   rootId?: string | null;
// }

interface CustomNodeProps extends NodeProps {
  setNodes?: React.Dispatch<React.SetStateAction<any[]>>;
}

const nodeTypes: NodeTypes = {
  custom: (props: NodeProps) => <CustomNode {...props} />,
};

function findNodeById(node: any, id: string): any | null {
  const nodeId = node.characteristic_data?.name || node._id?.$oid || node._id;
  if (nodeId === id) return node;
  if (!node.children) return null;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*                               component                                    */
/* -------------------------------------------------------------------------- */
// const Patients: React.FC<PatientsProps> = ({ rootId = null }) => {
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
  // const [selectedRootId, setSelectedRootId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { rootId } = useParams<{ rootId?: string }>();
  const selectedRootId = rootId ?? null;
  const isOverview = selectedRootId === null;
  const COLORS = ["#FFD700", "#87CEEB", "#90EE90", "#FFB6C1", "#D3D3D3"];
  const location = useLocation();
  const mapColor = location.state?.color || "#ffffff"; // default to white

  /* ----------------------------- effects ---------------------------------- */

  useEffect(() => {
      // each time the URL’s :rootId changes we re-draw
       drawPatientNodes();
    }, [selectedRootId]);
  
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

  const onNodeClick = (_: any, node: any) => {
    if (!rootId) {
      navigate(`/patients/${node.id}`, {
        state: { color: node.data.color },
      });
    }
  };

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
  // const drawPatientNodes = async (rootId: string | null = null, depthLimit: number = Infinity) => {
  const drawPatientNodes = async (depthLimit: number = (selectedRootId ? Infinity : 1)) => {
    try {
      const { data } = await axios.get("http://localhost:5000/api/patients");
      const parsedPatients = data.map((item: string) => JSON.parse(item));

      const roots = selectedRootId
      ? parsedPatients
          .map((p:any) => findNodeById(p.tree, selectedRootId))
          .filter((n: any) => n != null)
      : parsedPatients.map((p:any) => p.tree);



      /* -------------------------------------------------------------
       * Global registries for this draw call – one per _run_.
       * ----------------------------------------------------------- */
      const isOverview = selectedRootId === null;
      const CENTER_X = 400;
      const CENTER_Y = 250;
      const OVERVIEW_RADIUS = 400;
      const H_SPACING = 200;
      const V_SPACING = 150;
  
      // dedupe & accumulate
      const nodesById = new Map<string, any>();
      const edges: Edge[] = [];
      let nextRootX = 0;
      /* -------------------------------------------------------------
       * recursive DFS that respects the global registries
       * ----------------------------------------------------------- */
      
      const buildFlowNodes = (
        node: any,
        depth: number,
        index: number,
        parentId: string | null = null,
        parentSize: number,
        siblingsCount: number,
        inheritedColor: string
      ) => {        
        
        if (depth > depthLimit) return;
        
        const nodeId = node.characteristic_data?.name || node._id?.$oid || node._id;
        const nodeRate = node.rate ?? 1;
        const nodeSize =
          typeof node.size === "number"
            ? node.size
            : parentSize * nodeRate;

          // Skip if we’re showing a subtree and this node isn't under the selected root
      if (rootId && depth === 0 && nodeId !== rootId) return;
      /* 1️⃣  Add a node only the first time we meet its _id */
      if (!nodesById.has(nodeId)) {
        nodesById.set(nodeId, {
          id: nodeId,
          position: { x: 0, y: 0 },
          type: "custom",
          data: {
            label:
              node.characteristic_data?.name ||
              node.treatment_data?.name ||
              "Node",
            type: node.node_type,
            size: nodeSize,
            rate: nodeRate,
            drugs:
              node.treatment_data?.regimen?.drugs?.map((d: any) => d.drug) || [],
            alternatives:
              node.treatment_data?.alternatives || [],
            color: inheritedColor,
            onClick: () => navigate(`/patients/${nodeId}`),
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

       // 3️⃣ figure out position
       const record = nodesById.get(nodeId)!;
       let { x, y } = record.position;      
 
      if (depth === 0) {
        // ── ROOT LAYOUT ───────────────────────────────
        if (isOverview) {
          // place each root on a circle
          const step = (2 * Math.PI) / roots.length;
          const angle = Math.PI + (step * index)/4 ; // start at 180° (left)
          x = CENTER_X + OVERVIEW_RADIUS * Math.cos(angle);
          y = CENTER_Y + OVERVIEW_RADIUS * Math.sin(angle);
        } else {
          // drilled‐in: simple row
          x = nextRootX;
          y = 100;
          nextRootX += H_SPACING;
        }
      } else {
        // ── CHILD LAYOUT ──────────────────────────────
      if (!parentId) return; 
      if (isOverview) {
        const parent = nodesById.get(parentId!)!;
        const step = (2 * Math.PI) / siblingsCount;
        const angle = step * index;
        x = parent.position.x + OVERVIEW_RADIUS * Math.cos(angle);
        y = parent.position.y + OVERVIEW_RADIUS * Math.sin(angle);
      } else {
        // drilled‐in: top-down tree
        const parent = nodesById.get(parentId!)!;
        y = parent.position.y + V_SPACING;
        x =
          parent.position.x +
          (index - (siblingsCount - 1) / 2) * H_SPACING;
      }
    }
    record.position = { x, y };

        /* 3️⃣ Recurse over children */
    const kids = node.children || [];
    kids.forEach((child: any, i: number) =>
      buildFlowNodes(
          child,
          depth + 1,
          i,
          nodeId,
          nodeSize,
          kids.length,
          inheritedColor   
      )
  );
};

  roots.forEach((rootNode: any, idx: number) =>
    buildFlowNodes(
      rootNode,
      0,                // depth
      idx,              // index among roots
      null,             // no parent
      (typeof rootNode.size === "number" && rootNode.size > 0 ? rootNode.size : 100),
      (rootNode.children || []).length,
      COLORS[idx % COLORS.length]
    )
  );

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

      {rootId && (
        <Button
          variant="contained"
          onClick={() => navigate("/patients")}
          sx={{ mb: 2 }}
        >
          Back to All Roots
        </Button>
      )}

      {/* -------------------- draw/refresh button ---------------------- */}
      {/* <Button
        variant="contained"
        color="secondary"
        fullWidth
        className="my-4"
        onClick={() => navigate("/patients")}
      >
        Draw Patients Map
      </Button> */}

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
      <div style={{ height: 500, width: "100%", border: "1px solid #ddd", backgroundColor: mapColor, transition: "background-color 0.5s ease", }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
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
