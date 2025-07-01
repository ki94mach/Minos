import React, { useCallback, useEffect, useState, useMemo } from "react";
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
  Button,
  MenuItem,
  Box,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import axios from "axios";
import BackButton from "../components/BackButton";
import CustomNode from "../components/CustomNode";
import Cookies from "js-cookie";
import { useNavigate, useParams } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { mul, format } from "../components/math";
import Decimal from "decimal.js";
import CharacteristicForm from "../components/CharacteristicForm";
import EditCharacteristicForm from "../components/EditCharacteristicForm";
import TreatmentForm      from "../components/TreatmentForm";
import { CharacteristicItem } from "../api/characteristics";
import { TreatmentOption } from "../components/TreatmentForm";
import FollowupForm from "../components/FollowupForm";
// import { FollowupItem as Followup } from "../components/FollowupForm";
import { log } from "console";
import { logDOM } from "@testing-library/dom";
import EditTreatmentForm from "../components/EditTreatmentForm";
import dagre from 'dagre';


/* -------------------------------------------------------------------------- */
/*                                helpers                                     */
/* -------------------------------------------------------------------------- */
// interface PatientsProps {
//   rootId?: string | null;
// }


interface CustomNodeProps extends NodeProps {
  setNodes?: React.Dispatch<React.SetStateAction<any[]>>;
}

function getUniqueCharId(node: any): string {
  return (
    node.characteristic_data?._id?.$oid ||
    node.treatment_data?._id?.$oid ||
    node._id?.$oid ||
    node._id
  );
}

interface EditCharModalData {
  nodeId: string;             
  currentCharId: string;      
  currentType: string;       
  currentName: string;        
  currentRate: number;
  patientId: string;
  parentId: string;
}

interface EditTreatModalData {
  nodeId: string;           
  currentTreatId: string;
  currentRate: number;
  patientId: string;
}


function findNodeById(node: any, id: string): any | null {
  const thisId = getUniqueCharId(node);
  if (thisId === id) return node;
  // 1) Check if this node is a “characteristic” and if so, compare its characteristic_data._id
  const charId = node.characteristic_data?._id?.$oid || node.characteristic_data?._id;
  // 2) Otherwise, if it’s a “treatment,” compare its treatment_data._id
  const treatId = node.treatment_data?._id?.$oid || node.treatment_data?._id;
  // 3) Finally, compare the node’s own document _id
  const nodeDocId = node._id?.$oid || node._id;

  if (id === charId || id === treatId || id === nodeDocId) {
    return node;
  }
   // 4) If no match yet, recurse into children (if any)
   if (!node.children) return null;
   for (const child of node.children) {
     const found = findNodeById(child, id);
     if (found) return found;
   }
 
   // 5) No match in this subtree
   return null;
}

function addNodeApi() {

}
/* -------------------------------------------------------------------------- */
/*                               component                                    */
/* -------------------------------------------------------------------------- */
// const Patients: React.FC<PatientsProps> = ({ rootId = null }) => {
const Patients: React.FC = () => {
    // ─────────────── Suppress ResizeObserver warning ───────────────
    // useEffect(() => {
    //   const observerErrorHandler = () => {
    //     // Suppress ResizeObserver loop errors
    //     const resizeObserverErr = document.querySelector(
    //       "#webpack-dev-server-client-overlay"
    //     );
    //     if (resizeObserverErr) {
    //       resizeObserverErr.remove();
    //     }
    //   };
    
    //   window.addEventListener("error", observerErrorHandler);
    //   return () => {
    //     window.removeEventListener("error", observerErrorHandler);
    //   };
    // }, []);
    

    
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

  const [debouncedNodes, setDebouncedNodes] = useState<any[]>([]);
  const [debouncedEdges, setDebouncedEdges] = useState<any[]>([]);

  const [editCharModalData, setEditCharModalData] = useState<EditCharModalData | null>(null);
  const [allTreatments, setAllTreatments] = useState<TreatmentOption[]>([]);
  const [editTreatModalData, setEditTreatModalData] = useState<EditTreatModalData|null>(null);
  const [rawPatients, setRawPatients] = useState<any[]>([]);

  
  const NODE_WIDTH = 180
const NODE_HEIGHT = 60

function applyDagreLayout(nodes: any[], edges: any[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 50, nodesep: 20 })

  // 1) register nodes & edges
  nodes.forEach((n) =>
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  )
  edges.forEach((e) => g.setEdge(e.source, e.target))

  // 2) run layout
  dagre.layout(g)

  // 3) read back positions
  return nodes.map((n) => {
    const { x, y } = g.node(n.id)
    return {
      ...n,
      position: {
        x: x - NODE_WIDTH / 2,
        y: y - NODE_HEIGHT / 2,
      },
    }
  })
}

  const handleNodeContext = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    setCtx({ x: e.clientX + 2, y: e.clientY - 6, nodeId });
  }, []);  
  
  const nodeTypes = useMemo(() => ({  
    custom: (p: any) => <CustomNode {...p} onContextMenu={handleNodeContext} />,
  }), [handleNodeContext]);
  
  // const [selectedRootId, setSelectedRootId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { rootId } = useParams<{ rootId?: string }>();
  const selectedRootId = rootId ?? null;
  const isOverview = selectedRootId === null;
  // const COLORS = [
  //   "#f8d9de", 
  //   "#E3FFE8", 
  //   "#d1f0f6", 
  //   "#fff2cc", // pastel pink
  //   "#D1C4E9", // pastel purple
  //   "#FFE0B2", // pastel orange
  //   "#FFCDD2", // pastel red
  //   "#C8E6C9", // pastel green
  // ];

  const [ctx, setCtx] = useState<              // null = closed
  | { x: number; y: number; nodeId: string }
  | null
>(null);

// ─── “Add Node” state: open dialog under a specific parent ───
const [addingParentId, setAddingParentId] = useState<string | null>(null);
const [isChoosingType, setIsChoosingType] = useState(false);
const [newNodeType, setNewNodeType] = useState< "characteristic" | "treatment" | "followup" | null >(null);

const [editChar, setEditChar]   = useState<CharacteristicItem | null>(null);
const [editTrt,  setEditTrt ]   = useState<TreatmentOption | null>(null);
// const [editFollowup, setEditFollowup] = useState<Followup | null>(null);

  const location = useLocation();
  const patientId = location.state?.treeId || "";
  const patientTreeId = location.state?.treeId as string; 
  // console.log("patientTreeId", patientTreeId);
  
  const mapColor = location.state?.color || "#ffffff"; // default to white

  const parentNode = nodes.find(n => n.id === addingParentId);
  const parentType = parentNode?.data.type; // e.g. "characteristic" | "treatment" | "followup"

  function editNode(uniqueCharOrTreatId: string) {
    // Find the clicked node in React‐Flow state (nodes[])
    const n = nodes.find((x: any) => x.id === uniqueCharOrTreatId);
    if (!n) return;
  
    // common: we still need to know the patientTreeId for any update
    // if (!patientTreeId) {
    //   alert("Error: missing patientTreeId.");
    //   return;
    // }
  
    // (A) First, fetch the whole PatientTree document from the server
    axios
    .get("http://localhost:5000/api/patients")
    .then((res) => {
      // 'res.data' is an array of strings (each string is JSON of one patient).
      const parsedList = res.data.map((item: string) => JSON.parse(item));
      // Find the one whose _id (or _id.$oid) matches patientTreeId:
      let patientDoc = parsedList.find((p: any) => {
        const pid = p._id?.$oid || p._id;
        return pid === patientTreeId;
      });
      if (!patientDoc) {
        for (const p of parsedList) {
          // p.tree is the root of this patient’s embedded‐tree
          const maybeMatch = findNodeById(p.tree, uniqueCharOrTreatId);
          if (maybeMatch) {
            patientDoc = p;
            break;
          }
        }
      }
  
      if (!patientDoc) {
        alert("Could not find that patient in the list.");
        return;
      }

      const realPatientId: string = patientDoc._id?.$oid || patientDoc._id;
  
      // Now you have the full tree object:
      const treeObj = patientDoc.tree;
      const foundNode = findNodeById(treeObj, uniqueCharOrTreatId);
      if (!foundNode) {
        alert("Node not found inside this patient’s tree.");
        return;
      }
  
        // (C) Extract the actual Mongo‐stored node._id (string) for the update URL
        const realNodeId: string = foundNode._id?.$oid || foundNode._id;

        const existingParentId: string = 
        foundNode.parent_id?._id?.$oid || foundNode.parent_id;
        
        // (D) Now check if this is a characteristic‐node or a treatment‐node,
        // and open the appropriate modal with its data.
  
        if (n.data.type === "characteristic") {
          // Pull out the existing characteristic_data + rate
          const existingType = foundNode.characteristic_data?.type || "";
          const existingName = foundNode.characteristic_data?.name || "";
          const existingRate = foundNode.rate ?? 0;
          // const existingParentId: string = foundNode.parent_id?._id?.$oid || foundNode.parent_id;
  
          // Pass those values into the Characteristic‐edit dialog
          setEditCharModalData({
            nodeId: realNodeId,
            currentCharId: uniqueCharOrTreatId,  // this was characteristic_data._id
            currentType: existingType,
            currentName: existingName,
            currentRate: existingRate,
            patientId: realPatientId,
            parentId: existingParentId
          });
        }
        else if (n.data.type === "treatment") {
          // Pull out the treatment_data payload from foundNode
          // const treatData = foundNode.treatment_data || {};
          // const existingName = treatData.name || "";
          // const existingRegimen = treatData.regimen || {};
          // const existingAlternatives = treatData.alternatives || [];
          // const existingRate = foundNode.rate ?? 0;
  
          // Now set up your treatment‐edit modal state (you’ll need
          // a corresponding `editTreatmentModalData` state variable, similar
          // to editCharModalData). For example:
          // setEditTreatmentModalData({
          //   nodeId: realNodeId,
          //   currentName: existingName,
          //   currentRegimen: existingRegimen,
          //   currentAlternatives: existingAlternatives,
          //   currentRate: existingRate,
          //   patientId: patientTreeId,
          // });

          const treatData = foundNode.treatment_data || {};
          const existingRate = foundNode.rate ?? 0;
          const realNodeId    = foundNode._id?.$oid || foundNode._id;
          const realPatientId = patientDoc._id?.$oid || patientDoc._id;

          setEditTreatModalData({
            nodeId: realNodeId,
            currentTreatId: uniqueCharOrTreatId, 
            currentRate: existingRate,
            patientId: realPatientId,
          });
        }
  
      })
      .catch((err) => {
        console.error("Failed to fetch patientTree for editing:", err);
        alert("Could not load the patient’s tree for editing.");
      });
  }
  

  function hashColor(str: string): string {
    let h = 0, s = 0, l = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      s = (s << 3) - s + str.charCodeAt(i);
      l = (l << 2) - l + str.charCodeAt(i);
    }
  
    const hue = Math.abs(h % 360);            // 0–359
    const sat = 65 + (Math.abs(s) % 20);      // 65–84%
    const light = 80 + (Math.abs(l) % 10);    // 80–89%
  
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  } 

  function calculateSizeFromTree(tree: any, targetId: string): Decimal | null {
    // (1) We now pass around a `Decimal` object instead of a plain number
    const dfs = (node: any, acc: Decimal): Decimal | null => {
      const nodeId = getUniqueCharId(node);
  
      if (nodeId === targetId) {
        return acc;
      }
  
      if (!node.children) return null;
  
      for (const child of node.children) {
        // Multiply the Decimal `acc` by the child’s rate (wrapped in Decimal)
        const rateDecimal = new Decimal(typeof child.rate === "number" ? child.rate : 1);
        const nextAcc = acc.mul(rateDecimal);
        const result = dfs(child, nextAcc);
        if (result !== null) return result;
      }
      return null;
    };
  
    // (2) Initialize with the root’s size as a Decimal
    const rootSizeDecimal = new Decimal(typeof tree.size === "number" ? tree.size : 1);
    
  
    return dfs(tree, rootSizeDecimal);
  }
  

  /* ───────────── remove one node + its edges ───────────── */
  function deleteNode(nodeId: string) {
    const node = nodes.find((n: any) => n.id === nodeId);
    if (!node) return;
  
    if (!window.confirm("Delete this node?")) return;

    const nodeDocId = node.data.docId;
    const patientTreeId = node.data.treeId;
    console.log(node.data);
    

    if (!patientTreeId) {
      alert("Missing patient tree ID.");
      return;
    }
  
    const endpoint = `http://localhost:5000/api/patients/${patientTreeId}/node/${nodeDocId}`;
  
    const csrf = Cookies.get("csrf_token") ?? "";
    const cfg  = {
      withCredentials: true,
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
    };
  
    axios
      .delete(endpoint, cfg)
      .then(() => {
        // remove from React-Flow state
        // setNodes((ns) => ns.filter((n) => n.id !== nodeId));
        // setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
        // optional full refresh:
        drawPatientNodes();
        alert("Node deleted.");
      })
      .catch((err) => {
        const msg = err.response?.data?.error ?? "Error deleting node.";
        alert(msg);
        console.error(err);
      });
  }  
  
  function addNode(parentId: string) {
    setAddingParentId(parentId);
    setIsChoosingType(true);
  }
  
  /* ----------------------------- effects ---------------------------------- */

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      if (e.message && e.message.includes("ResizeObserver loop")) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return false;
      }
    };
  
    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      if (e.reason && e.reason.message && e.reason.message.includes("ResizeObserver loop")) {
        e.preventDefault();
        return false;
      }
    };
  
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
  
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNodes(nodes);
      setDebouncedEdges(edges);
    }, 50); // 50ms debounce
  
    return () => clearTimeout(timer);
  }, [nodes, edges]);

  useEffect(() => {
      // each time the URL’s :rootId changes we re-draw
       drawPatientNodes();
    }, [selectedRootId]);

  useEffect(() => {
      // ...inside your existing fetch block...
      axios.get("http://localhost:5000/api/treatments")
        .then((r) => {
          const list = r.data.map((x: string) => {
            const o = JSON.parse(x);
            return { ...o, _id: o._id.$oid };
          });
          setAllTreatments(list);
        });
  }, [selectedRootId]);

  useEffect(() => {
    axios.get("http://localhost:5000/api/patients")
      .then((r) => {
        const parsed = r.data.map((s: string) => JSON.parse(s));
        setRawPatients(parsed);
        drawPatientNodes();      // refresh your graph using the same routine
      })
      .catch(console.error);
  }, [selectedRootId]);  // re‐run whenever you drill in/out
    
  
  // fetch patients list for the list‑view (grid at top of page)
  useEffect(() => {
    if (!selectedRootId) {
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
  
          requestAnimationFrame(() => {
            setNodes(formattedNodes);
          });
        } catch (err) {
          console.error("Error fetching patients:", err);
        }
      };
  
      const fetchCharacteristics = async () => {
        try {
          const { data } = await axios.get("http://localhost:5000/api/characteristics");
          const parsed = data.map((item: string) => {
            const obj = JSON.parse(item);
            return { ...obj, _id: obj._id.$oid };
          });
  
          setAllCharacteristics(parsed);
          const uniqueTypes = Array.from(new Set<string>(parsed.map((char: any) => char.type)));
          setCharTypes(uniqueTypes);
          if (uniqueTypes.length > 0) setSelectedCharType(uniqueTypes[0]);
        } catch (err) {
          console.error("Error fetching characteristics:", err);
        }
      };
  
      fetchPatients();
      fetchCharacteristics();
    }
  }, [selectedRootId]);
  

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
    const clickedId = node.id;
    const whichTree = node.data.treeId;
          if (!whichTree) {
            // If somehow treeId was missing, you could fetch patients and do findNodeById to recover it.
            alert("Error: no treeId found for this node.");
            return;
          }
          navigate(`/patients/${clickedId}`, {
            state: { color: node.data.color, treeId: whichTree },
          });
    //       return;
    //     }
    //   }
  
    //   alert("⚠️ Couldn't find the root of this node.");
    // } catch (err) {
    //   console.error("🚨 Error finding root:", err);
    // }
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
    const drawPatientNodes = async (
      depthLimit: number = Infinity
    ) => {
      try {
        const { data } = await axios.get("http://localhost:5000/api/patients");
        const parsedPatients = data.map((item: string) => JSON.parse(item));
    
        // Choose either all roots (overview) or the single drilled‐in root:
        // const roots = selectedRootId
        //   ? parsedPatients
        //       .map((p: any) => findNodeById(p.tree, selectedRootId))
        //       .filter((n: any) => n != null)
        //   : parsedPatients.map((p: any) => p.tree);

        const drillTreeId = location.state?.treeId as string | undefined;

        let roots: any[] = [];
        if (selectedRootId && drillTreeId) {
          // 1) Find the single patient document whose _id === drillTreeId
          const patientDoc = parsedPatients.find((p: any) => {
            const pid = p._id?.$oid || p._id;
            return pid === drillTreeId;
          });
          if (patientDoc) {
            // 2) Inside that one patient, locate the clicked node (selectedRootId)
            const subTree = findNodeById(patientDoc.tree, selectedRootId);
            if (subTree) {
              roots = [subTree];
            } else {
              roots = [];
            }
          } else {
            roots = [];
          }
        } else {
          // Overview: show every patient’s full top‐level tree
          roots = parsedPatients.map((p: any) => p.tree);
        }
    
        /* ──────────────────────────────────────────────────
         * 1) Set up global DFS registries for this draw
         * ────────────────────────────────────────────────── */
        const isOverviewMode = selectedRootId === null;
        const visited = new Set<string>();
        const CENTER_X = 400;
        const CENTER_Y = 250;
        const OVERVIEW_RADIUS = 400;
        const H_SPACING = 200;
        const V_SPACING = 150;
    
        const nodesById = new Map<string, any>();
        const edges: Edge[] = [];
        const edgeSet = new Set<string>();
        let nextRootX = 0;
    
        /* ──────────────────────────────────────────────────
         * 2) DFS function: MERGE duplicate “Iran” by using
         *    characteristic_data._id as the single nodeId.
         * ────────────────────────────────────────────────── */
        const buildFlowNodes = (
          node: any,
          depth: number,
          index: number,
          parentId: string | null = null,
          parentSize: Decimal,
          siblingsCount: number,
          inheritedColor: string,
          treeId: string
        ) => {
          if (depth > depthLimit) return;
    
          // ──────────────────────────────────────────────────
          // A) Use the *characteristic_data._id* (or treatment_data._id) as one shared nodeId.
          //    THAT ensures all “Iran” occurrences collapse into the same React-Flow node.
          const uniqueCharId =
            node.characteristic_data?._id?.$oid ||
            node.treatment_data?._id?.$oid ||
            node._id?.$oid ||
            node._id;
          const nodeId = uniqueCharId;
    
          // ──────────────────────────────────────────────────
          // B) If we’re NOT in overview (i.e. we drilled in), and have seen this unique ID,
          //    then we only want to add its edge + recurse children (to merge grandchildren).
          if (!isOverview && visited.has(uniqueCharId)) {
            // 1) Add parent→this node edge if needed
            if (parentId) {
              const edgeId = `${parentId}->${nodeId}`;
              if (!edgeSet.has(edgeId)) {
                edges.push({ id: edgeId, source: parentId, target: nodeId });
                edgeSet.add(edgeId);
              }
            }
            // 2) Recurse into children so we collect grandchildren under this single node

            const kids = node.children || [];
            kids.forEach((child: any, i: number) =>
              buildFlowNodes(
                child,
                depth + 1,
                i,
                nodeId,
                new Decimal(parentSize).times(node.rate ?? 1),
                kids.length,
                inheritedColor,
                treeId
              )
            );
            // 3) Bail out (don’t re‐create or re‐position this node)
            return;
          }
    
          // ──────────────────────────────────────────────────
          // C) First time we see this uniqueCharId (or we are in overview). Mark “visited”:
          visited.add(uniqueCharId);
    
          // ──────────────────────────────────────────────────
          // D) If we’re drilling in on a specific root, and this is depth=0 but NOT that root, skip.
          if (selectedRootId && depth === 0 && nodeId !== selectedRootId) {
            return;
          }
    
          // ──────────────────────────────────────────────────
          // E) Compute “rawSize” based on whether this is a top‐level root or a descendant:

          
          const nodeRate = node.rate ?? 1;
          // if (rootId && depth === 0 && nodeId !== rootId) return;
          if (selectedRootId && depth === 0 && nodeId !== selectedRootId) {
          return;
        }  

          const isRoot = parentId == null;
          let rawSize: Decimal;
          if (depth === 0 && selectedRootId) {
            rawSize = parentSize;
            
          } else if (parentId == null) {
            rawSize = new Decimal(
              Number.isFinite(parentSize)
                ? parentSize
                : typeof node.size === "number"
                ? node.size
                : 1
            );
            
          } else {
            rawSize = new Decimal(parentSize).times(nodeRate);
            
          }
          const nodeSize = rawSize.toNumber();
    
          // ──────────────────────────────────────────────────
          // F) Create the React-Flow node object once:
          const isNewNode = !nodesById.has(nodeId);
          if (isNewNode) {
            nodesById.set(nodeId, {
              id: nodeId,
              position: { x: 0, y: 0 }, // we will re‐position later
              type: "custom",
              data: {
                label:
                  node.characteristic_data?.name ||
                  node.treatment_data?.name ||
                  "Node",
                type: node.node_type,
                docId: node._id.$oid || node._id, 
                parentDocId: node.parent_id?._id?.$oid || node.parent_id || null,
                charType: node.characteristic_data?.type,
                size: nodeSize,
                rate: node.rate ?? 1,
                drugs:
                  node.treatment_data?.regimen?.drugs?.map((d: any) => d.drug) ||
                  [],
                alternatives: node.treatment_data?.alternatives || [],
                color: hashColor(uniqueCharId),
                isOverview: isOverviewMode,
                treeId: treeId,
                onClick: () => navigate(`/patients/${nodeId}`, {
                          state: { color: hashColor(uniqueCharId), treeId: treeId },
                       }),
              },
            });
          }
    
          // ──────────────────────────────────────────────────
          // G) Always add an edge parent→this node if needed:
          if (parentId) {
            const edgeId = `${parentId}->${nodeId}`;
            if (!edgeSet.has(edgeId)) {
              edges.push({ id: edgeId, source: parentId, target: nodeId });
              edgeSet.add(edgeId);
            }
          }
    
          
          function containsPrimaryIndication(node: any): boolean {
            if (node.characteristic_data?.type === "Primary Indication") return true;
          
            const kids = node.children || [];
            return kids.some(containsPrimaryIndication);
          }
          
          if (isOverviewMode && !containsPrimaryIndication(node)) {
            return;
          }

          if (node.characteristic_data?.type === "Primary Indication") {
            return;
          }
          
            const kids = node.children || [];
            kids.forEach((child: any, i: number) =>
              buildFlowNodes(
                child,
                depth + 1,
                i,
                nodeId,
                rawSize,
                kids.length,
                inheritedColor,
                treeId
              )
            );
          
          
          
        };
    
        // ──────────────────────────────────────────────────
        // 3) Kick off DFS for each root
        roots.forEach((rootNode: any, idx: number) => {
          let rootSizeDecimal: Decimal;
          const patientId = parsedPatients[idx]._id.$oid || parsedPatients[idx]._id;
          if (selectedRootId) {
            // (A) Find the patient doc whose `tree` contains the clicked node
            const patientObj = parsedPatients.find((p: any) =>
              !!findNodeById(p.tree, selectedRootId)
            );
            if (!patientObj) {
              console.warn(
                "[drawPatientNodes] clicked node not found in any patient tree."
              );
              rootSizeDecimal = new Decimal(1);
            } else {
              // (B) Run our new Decimal-based DFS
              const accDecimal = calculateSizeFromTree(patientObj.tree, selectedRootId);
              rootSizeDecimal = accDecimal ?? new Decimal(1);
            }
            
          } else {
            // Overview mode: use the top‐level node.size
            rootSizeDecimal = new Decimal(
              typeof rootNode.size === "number" ? rootNode.size : 1
            );
          }
    
          buildFlowNodes(
            rootNode,
            0,
            idx,
            null,
            rootSizeDecimal,
            (rootNode.children || []).length,
            hashColor(getUniqueCharId(rootNode)),
            patientId
          );
        });
    
        // ──────────────────────────────────────────────────
        // 4) AFTER DFS completes, do a “re‐layout” pass so that no two children of the same parent overlap:
        const R = 120; // radius (in px) for drawing children around parent
        const childrenByParent = new Map<string, string[]>();
         // Build a mapping: parentId → [ childId, childId, … ]
         edges.forEach((edge) => {
          const p = edge.source;
          const c = edge.target;
          if (!childrenByParent.has(p)) {
            childrenByParent.set(p, []);
          }
          childrenByParent.get(p)!.push(c);
        });

        const allFlowNodes = Array.from(nodesById.values())
        let finalNodes: typeof allFlowNodes

        if (selectedRootId) {
          // • DRILL MODE → top‐to‐bottom dagre layout
          finalNodes = applyDagreLayout(allFlowNodes, edges)
        } else {
          // • OVERVIEW MODE → radial around the ‘Iran’ root
          const center = { x: 400, y: 250 }
          const R = 400
        
          // (a) figure out which node is the root
          //     assume your first element in `roots` is the “Iran” node
          const rootUniqueId = getUniqueCharId(roots[0])

          // (b) position the root in the center
          const rootNode = nodesById.get(rootUniqueId)!
          rootNode.position = center

          // (c) grab its immediate children
          const firstRing = childrenByParent.get(rootUniqueId) || []

          // (d) place them evenly around the circle
          firstRing.forEach((childId, i) => {
            const angle = (2 * Math.PI * i) / firstRing.length
            const n = nodesById.get(childId)!
            n.position = {
              x: center.x + R * Math.cos(angle),
              y: center.y + R * Math.sin(angle),
            }
          })

          // (e) collect all
          finalNodes = allFlowNodes
        }
        
          // everyone else stays where dagre/grid put them (or you can default them)
          setNodes(finalNodes)
          setEdges(edges)
          
       

        const depthMap = new Map<string, number>();
        const assignDepth = (nodeId: string, depth: number) => {
          if (depthMap.has(nodeId) && depthMap.get(nodeId)! <= depth) {
            return;
          }
          depthMap.set(nodeId, depth);
          const kids = childrenByParent.get(nodeId) || [];
          for (const childId of kids) {
            assignDepth(childId, depth + 1);
          }
        };

        if (selectedRootId) {
          assignDepth(selectedRootId, 0);
        } else {
          roots.forEach((rootNode: any) => {
            const uniqueRootId =
              rootNode.characteristic_data?._id?.$oid ||
              rootNode.treatment_data?._id?.$oid ||
              rootNode._id?.$oid ||
              rootNode._id;
            assignDepth(uniqueRootId, 0);
          });
        }

        const nodesByDepth = new Map<number, string[]>();
          depthMap.forEach((depth, nodeId) => {
            if (!nodesByDepth.has(depth)) {
              nodesByDepth.set(depth, []);
            }
            nodesByDepth.get(depth)!.push(nodeId);
          });

          nodesByDepth.forEach((nodeIdsAtDepth, depth) => {
            const offsetForCentering = ((nodeIdsAtDepth.length - 1) / 2) * H_SPACING;
            nodeIdsAtDepth.forEach((nodeId, idx) => {
              const flowNode = nodesById.get(nodeId);
              if (!flowNode) return;
              flowNode.position = {
                x: idx * H_SPACING - offsetForCentering,
                y: depth * V_SPACING,
              };
            });
          });

    
        // Now loop over each parentId & its array of children:
        // childrenByParent.forEach((childArray, parentId) => {
        //   const parentNode = nodesById.get(parentId);
        //   if (!parentNode) return; // safety
    
        //   const px = parentNode.position.x;
        //   const py = parentNode.position.y;
        //   const totalKids = childArray.length;  
    
        //   childArray.forEach((childId, idx) => {
        //     const childNode = nodesById.get(childId);
        //     if (!childNode) return;
    
        //     // Spread them evenly in a small circle of radius R around (px, py)
        //     const angle = (2 * Math.PI * idx) / totalKids;
        //     const cx = px + R * Math.cos(angle);
        //     const cy = py + R * Math.sin(angle);
        //     childNode.position = { x: cx, y: cy };
        //   });
        // });

        // const rawNodes = Array.from(nodesById.values())
        // const finalNodes = selectedRootId
        //   ? applyDagreLayout(rawNodes, edges)
        //   : rawNodes  // or radialLayout(rawNodes, childrenByParent)
        //   requestAnimationFrame(() => {
        //     setNodes(finalNodes)
        //     setEdges(edges)
        //   })
        
    
        // ──────────────────────────────────────────────────
        // 5) Finally, send everything to React-Flow in one go:
        // requestAnimationFrame(() => {
        //   setNodes(Array.from(nodesById.values()));
        //   setEdges(edges);
        // });
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
    
        {/* If we drilled into a specific root, show “Back to All Roots” */}
        {rootId && (
          <Button
            variant="contained"
            onClick={() => navigate("/patients")}
            sx={{ mb: 2 }}
          >
            Back to All Roots
          </Button>
        )}
    
        {/* Legend */}
        {!isOverview && (
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
        )}
    
        {/* ===== React Flow Canvas ===== */}
        <div
          style={{
            width: "100%",
            height: 500,
            border: "1px solid #ddd",
            backgroundColor: mapColor,
            transition: "background-color 0.5s ease",
          }}
        >
          <ReactFlow
            nodes={debouncedNodes} // Use debounced nodes
            edges={debouncedEdges} // Use debounced edges
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            fitView
            nodeTypes={nodeTypes}
            // Add these props to help with ResizeObserver issues
            fitViewOptions={{
              padding: 0.1,
              includeHiddenNodes: false,
            }}
            minZoom={0.1}
            maxZoom={2}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          >
            {/* <Background  variant="none" gap={12} size={1}  /> */}
          </ReactFlow>
    
          {/* Context menu (right‐click) */}
          <Menu
            open={!!ctx}
            onClose={() => setCtx(null)}
            anchorReference="anchorPosition"
            anchorPosition={ctx ? { top: ctx.y, left: ctx.x } : undefined}
          >
            <MenuItem
              onClick={() => {
                if (!ctx) return;
                editNode(ctx.nodeId);
                setCtx(null);
              }}
            >
              Edit
            </MenuItem>
    
            <MenuItem
              onClick={() => {
                if (!ctx) return;
                deleteNode(ctx.nodeId);
                setCtx(null);
              }}
            >
              Delete
            </MenuItem>
    
            <MenuItem
              onClick={() => {
                if (!ctx) return;
                addNode(ctx.nodeId);
                setAddingParentId(ctx.nodeId);
                setIsChoosingType(true);
                setCtx(null);
              }}
            >
              Add Node
            </MenuItem>
          </Menu>

          {/* ===== “Edit Characteristic” dialog ===== */}
          {/* {editChar && (
            <Dialog open onClose={() => setEditChar(null)} maxWidth="md" fullWidth>
              <DialogTitle>Edit characteristic</DialogTitle>
              <DialogContent dividers>
                <CharacteristicForm
                  initial={editChar ?? undefined}
                  onSaved={async () => {
                    setEditChar(null);
                    await drawPatientNodes(); // refresh the map
                  }}
                />
              </DialogContent>
            </Dialog>
          )} */}
          {editCharModalData && (
              <Dialog
                open={true}
                onClose={() => setEditCharModalData(null)}
                maxWidth="sm"
                fullWidth
              >
                <DialogTitle>Edit Characteristic Node</DialogTitle>
                <DialogContent dividers>
                  <EditCharacteristicForm
                    allChars={allCharacteristics}
                    editData={editCharModalData}
                    // patientId={editCharModalData.patientId} 
                    onCancel={() => setEditCharModalData(null)}
                    onSave={() => {
                      setEditCharModalData(null);
                      drawPatientNodes(); 
                    }}
                  />
                </DialogContent>
              </Dialog>
            )}
          {/* ─── end “Edit Characteristic” ─── */}
    
          {/* ===== “Edit Treatment” dialog ===== */}
          {editTreatModalData && (
            <Dialog
              open={true}
              onClose={() => setEditTreatModalData(null)}
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle>Edit Treatment Node</DialogTitle>
              <DialogContent dividers>
                <EditTreatmentForm
                  allTreatments={allTreatments}
                  editData={editTreatModalData}
                  onCancel={() => setEditTreatModalData(null)}
                  onSave={() => {
                    setEditTreatModalData(null);
                    drawPatientNodes();
                  }}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* ─── end “Edit Treatment” ─── */}
    
        </div>
        {/* ─── end ReactFlow container ─── */}
    
        {/* ===== “Pick Node Type” dialog ===== */}
        {isChoosingType && (
          <Dialog
            open
            onClose={() => {
              setIsChoosingType(false);
              setAddingParentId(null);
            }}
          >
            <DialogTitle>Pick node type</DialogTitle>
            <DialogContent sx={{ display: "flex", gap: 1, pb: 2 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setNewNodeType("characteristic");
                  setIsChoosingType(false);
                }}
              >
                Characteristic
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setNewNodeType("treatment");
                  setIsChoosingType(false);
                }}
              >
                Treatment
              </Button>
              <Button
                variant="outlined"
                disabled={parentType === "characteristic"}
                onClick={() => {
                  setNewNodeType("followup");
                  setIsChoosingType(false);
                }}
              >
                Follow‐up
              </Button>
            </DialogContent>
          </Dialog>
        )}
        {/* ─── end “Pick Node Type” ─── */}
    
        {/* ===== “Add Characteristic Under Parent” ===== */}
        {addingParentId && newNodeType === "characteristic" && (
          <Dialog
            open
            onClose={() => {
              setAddingParentId(null);
              setNewNodeType(null);
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogContent dividers>
              {/* find the parent node’s treeId */}
            {(() => {


              const parent = nodes.find((n) => n.id === addingParentId)!;
              const rawParent = parent.data.parentDocId;
              const trueParentId = rawParent && typeof rawParent === 'object' && '$oid' in rawParent
                    ? rawParent.$oid
                    : rawParent;
              const parentSize = parent?.data.size;
              const pid = (parent?.data.treeId).toString();


              console.log("pid: ", pid);
              console.log("trueParentId: ", trueParentId);
              
              if (!pid) {
                console.error("No treeId on parent node!", parent);
                return null; // or show an error
              }
              return (
                <CharacteristicForm
                  parentId="67d01fbe9e8a82122fb03320"
                  parentSize={parentSize}
                  patientId={pid}
                  onSaved={({ characteristicId, rate }) => {
                    setAddingParentId(null);
                    setNewNodeType(null);
                    drawPatientNodes();
                  }}
                  childrenToAdd={[]} 
                />
              );
            })()}
            </DialogContent>
          </Dialog>
        )}
        {/* ─── end “Add Characteristic” ─── */}
    
        {/* ===== “Add Treatment Under Parent” ===== */}
        {addingParentId && newNodeType === "treatment" && (
          <Dialog
            open
            onClose={() => {
              setAddingParentId(null);
              setNewNodeType(null);
            }}
            maxWidth="md"
            fullWidth
          >
            {/* <DialogTitle>Add Treatment under {addingParentId}</DialogTitle> */}
            <DialogContent dividers>
              <TreatmentForm
                parentId={(() => {
                  const parent = nodes.find((n) => n.id === addingParentId)!;
                  const rawParent = parent.data.parentDocId;
                  return typeof rawParent === "object" && rawParent?.$oid
                    ? rawParent.$oid
                    : rawParent;
                })()}
                parentSize={parentNode?.data.size ?? 1}
                patientId={parentNode?.data.treeId}
                onSaved={async () => {
                  setAddingParentId(null);
                  setNewNodeType(null);
                  await drawPatientNodes();
                }}
              />
            </DialogContent>
          </Dialog>
        )}
        {/* ─── end “Add Treatment” ─── */}
    
        {/* ===== “Add Follow‐up Under Parent” ===== */}
        {addingParentId && newNodeType === "followup" && (
          <Dialog
            open
            onClose={() => {
              setAddingParentId(null);
              setNewNodeType(null);
            }}
            maxWidth="sm"
            fullWidth
          >
            {/* <DialogTitle>Add Follow‐up under {addingParentId}</DialogTitle> */}
            <DialogContent dividers>
              {(() => {
                const parentNode = nodes.find((n) => n.id === addingParentId)!;
                const rawParent = parentNode.data.parentDocId;
                const trueParentId =
                  typeof rawParent === "object" && rawParent.$oid
                    ? rawParent.$oid
                    : rawParent;

                const patientTreeId = parentNode.data.treeId;

                return (
                  <FollowupForm
                    parentId={trueParentId} 
                    patientId={patientTreeId}
                    parentSize={parentNode.data.size}
                    nodeName={parentNode.data.label}
                    onSaved={async () => {
                      setAddingParentId(null);
                      setNewNodeType(null);
                      await drawPatientNodes();
                    }}
                  />
                );
              })()}
            </DialogContent>
          </Dialog>
        )}
        {/* ─── end “Add Follow‐up” ─── */}
    
      </Container>
    );
  }

export default Patients;
