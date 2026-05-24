import React, { useCallback, useEffect, useState, useMemo } from "react";
import ReactFlow, {
  addEdge,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
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
import api from "../api";
import BackButton from "../components/BackButton";
import CustomNode from "../components/CustomNode";
import Cookies from "js-cookie";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Decimal from "decimal.js";
import { TreatmentOption } from "../components/TreatmentForm";
import EditCharacteristicDialog from "../components/patientDialogs/EditCharacteristicDialog";
import EditTreatmentDialog from "../components/patientDialogs/EditTreatmentDialog";
import AddCharacteristicDialog from "../components/patientDialogs/AddCharacteristicDialog";
import AddTreatmentDialog from "../components/patientDialogs/AddTreatmentDialog";
import AddFollowupDialog from "../components/patientDialogs/AddFollowupDialog";
import { buildFlowNodes } from "../utils/buildFlowNodes";
import {
  getUniqueCharId,
  findNodeById,
  calculateSizeFromTree,
  hashColor,
  applyDagreLayout
} from "../utils/patientTreeUtils";
import { API_ENDPOINTS } from "../api/endpoints";
import { asApiList } from "../api/parseApiList";
import { resolveDefaultRootCharacteristic } from "../config/defaultCharacteristic";
import CreatePatientTreeDialog from "../components/patientDialogs/CreatePatientTreeDialog";

type PatientsLocationState = {
  treeId?: string;
  color?: string;
};

/* -------------------------------------------------------------------------- */
/*                                helpers                                     */
/* -------------------------------------------------------------------------- */
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

  const [allCharacteristics, setAllCharacteristics] = useState<
    { _id: string; type: string; name: string }[]
  >([]);

  const [debouncedNodes, setDebouncedNodes] = useState<any[]>([]);
  const [debouncedEdges, setDebouncedEdges] = useState<any[]>([]);

  const [editCharModalData, setEditCharModalData] = useState<EditCharModalData | null>(null);
  const [allTreatments, setAllTreatments] = useState<TreatmentOption[]>([]);
  const [editTreatModalData, setEditTreatModalData] = useState<EditTreatModalData|null>(null);
  const [defaultRootCharName, setDefaultRootCharName] = useState<string | null>(
    null
  );
  const [isOverviewRootClick, setIsOverviewRootClick] = useState(false);
  const [overviewEmptyHint, setOverviewEmptyHint] = useState<string | null>(null);
  const [createPatientDialogOpen, setCreatePatientDialogOpen] = useState(false);

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

  const [ctx, setCtx] = useState<              // null = closed
  | { x: number; y: number; nodeId: string }
  | null
>(null);

// ─── “Add Node” state: open dialog under a specific parent ───
const [addingParentId, setAddingParentId] = useState<string | null>(null);
const [isChoosingType, setIsChoosingType] = useState(false);
const [newNodeType, setNewNodeType] = useState< "characteristic" | "treatment" | "followup" | null >(null);

  const location = useLocation();
  const navState = (location.state ?? {}) as PatientsLocationState;
  const patientTreeId = navState.treeId as string;

  const mapColor = navState.color || "#ffffff"; // default to white

  const parentNode = nodes.find(n => n.id === addingParentId);
  const parentType = parentNode?.data.type; // e.g. "characteristic" | "treatment" | "followup"

  function editNode(uniqueCharOrTreatId: string) {
    // Find the clicked node in React‐Flow state (nodes[])
    const n = nodes.find((x: any) => x.id === uniqueCharOrTreatId);
    if (!n) return;
  
    api
      .get(API_ENDPOINTS.PATIENTS)
      .then((res) => {
        const parsedList = asApiList<any>(res.data);
        let patientDoc = parsedList.find((p: any) => String(p._id) === patientTreeId);
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

        const treeObj = patientDoc.tree;
        const foundNode = findNodeById(treeObj, uniqueCharOrTreatId);
        if (!foundNode) {
          alert("Node not found inside this patient’s tree.");
          return;
        }

        const realNodeId: string = foundNode._id?.$oid || foundNode._id;

        const existingParentId: string =
          foundNode.parent_id?._id?.$oid || foundNode.parent_id;

        if (n.data.type === "characteristic") {
          const existingType = foundNode.characteristic_data?.type || "";
          const existingName = foundNode.characteristic_data?.name || "";
          const existingRate = foundNode.rate ?? 0;
          // const existingParentId: string = foundNode.parent_id?._id?.$oid || foundNode.parent_id;
          setEditCharModalData({
            nodeId: realNodeId,
            currentCharId: uniqueCharOrTreatId,
            currentType: existingType,
            currentName: existingName,
            currentRate: existingRate,
            patientId: realPatientId,
            parentId: existingParentId,
          });
        } else if (n.data.type === "treatment") {
          const existingRate = foundNode.rate ?? 0;
          const realNodeId = foundNode._id?.$oid || foundNode._id;
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
 

  /* ───────────── remove one node + its edges ───────────── */
  function deleteNode(nodeId: string) {
    const node = nodes.find((n: any) => n.id === nodeId);
    if (!node) return;
  
    if (!window.confirm("Delete this node?")) return;

    const nodeDocId = node.data.docId;
    const patientTreeId = node.data.treeId;

    if (!patientTreeId) {
      alert("Missing patient tree ID.");
      return;
    }
  
    const endpoint = API_ENDPOINTS.DELETE_NODE(patientTreeId, nodeDocId);
  
    const csrf = Cookies.get("csrf_token") ?? "";
    const cfg  = {
      withCredentials: true,
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
    };
  
    api
      .delete(endpoint, cfg)
      .then(() => {
        // remove from React-Flow state
        // setNodes((ns) => ns.filter((n) => n.id !== nodeId));
        // setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
        drawPatientNodes();
        alert("Node deleted.");
      })
      // .then(async () => {
      //   alert("Node deleted.");

      //   setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      //   setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));

      //   await new Promise((res) => setTimeout(res, 300));
      //   await drawPatientNodes();  // now it's safe
      // })

      .catch((err) => {
        const msg = err.response?.data?.error ?? "Error deleting node.";
        alert(msg);
        console.error(err);
      });
  }  
  
  function addNode(parentId: string) {
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) return;

    const isOverviewRoot =
      defaultRootCharName !== null &&
      parent.data?.label === defaultRootCharName;
    setIsOverviewRootClick(isOverviewRoot);
    setAddingParentId(parentId);
    setIsChoosingType(true);
  }
  
  /* ----------------------------- effects ---------------------------------- */

  useEffect(() => {
    resolveDefaultRootCharacteristic()
      .then((c) => setDefaultRootCharName(c.name))
      .catch((err) => console.error("Default root characteristic:", err));
  }, []);

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
    }, 50);
  
    return () => clearTimeout(timer);
  }, [nodes, edges]);

  useEffect(() => {
       drawPatientNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload graph when route root changes
    }, [selectedRootId]);

  useEffect(() => {
      api.get(API_ENDPOINTS.TREATMENTS)
        .then((r) => setAllTreatments(asApiList(r.data)))
  }, [selectedRootId]);

  useEffect(() => {
    api.get(API_ENDPOINTS.PATIENTS)
      .then(() => drawPatientNodes())
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial patient graph load
  }, [selectedRootId]);
    
  
  // fetch characteristics for edit/add dialogs (overview mode)
  useEffect(() => {
    if (!selectedRootId) {
      const fetchCharacteristics = async () => {
        try {
          const { data } = await api.get(API_ENDPOINTS.CHARACTERISTICS);
          setAllCharacteristics(asApiList<any>(data));
        } catch (err) {
          console.error("Error fetching characteristics:", err);
        }
      };

      fetchCharacteristics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- overview list fetch when not drilled in
  }, [selectedRootId]);

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
  

  /* ---------------------------------------------------------------------- */
  /*   Build the merged graph of *all* patient trees without duplicates     */
  /* ---------------------------------------------------------------------- */
    const drawPatientNodes = async (
      depthLimit: number = Infinity
    ) => {
      try {
        const res = await api.get(API_ENDPOINTS.PATIENTS);

        const parsedPatients = asApiList<any>(res.data);

        if (parsedPatients.length === 0) {
          setOverviewEmptyHint(
            "No patient trees yet. Click below to choose a Population and set the root size."
          );
          setNodes([]);
          setEdges([]);
          return;
        }

        setOverviewEmptyHint(null);

        // Choose either all roots (overview) or the single drilled‐in root:
        // const roots = selectedRootId
        //   ? parsedPatients
        //       .map((p: any) => findNodeById(p.tree, selectedRootId))
        //       .filter((n: any) => n != null)
        //   : parsedPatients.map((p: any) => p.tree);

        const drillTreeId = navState.treeId as string | undefined;

        let roots: any[] = [];
        let truePatientId: string | undefined;

        if (selectedRootId && !truePatientId) {
          const fallbackPatient = parsedPatients.find((p: any) =>
            findNodeById(p.tree, selectedRootId)
          );
          truePatientId =
            fallbackPatient?._id?.$oid || fallbackPatient?._id || "";
        }

        if (selectedRootId && drillTreeId) {
          // 1) Find the single patient document whose _id === drillTreeId
          const patientDoc = parsedPatients.find((p: any) => {
            const pid = p._id?.$oid || p._id;
            return pid === drillTreeId;
          });
          if (patientDoc) {
            // 2) Inside that one patient, locate the clicked node (selectedRootId)
            const subTree = findNodeById(patientDoc.tree, selectedRootId);
            const correctPatient = parsedPatients.find((p: any) =>
              findNodeById(p.tree, selectedRootId)
            );

            truePatientId = correctPatient?._id?.$oid || correctPatient?._id;
            
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

        if (roots.length === 0 || roots.every((r) => r == null)) {
          setNodes([]);
          setEdges([]);
          return;
        }
    
        /* ──────────────────────────────────────────────────
         * 1) Set up global DFS registries for this draw
         * ────────────────────────────────────────────────── */
        const isOverviewMode = selectedRootId === null;
        const visited = new Set<string>();
        const H_SPACING = 200;
        const V_SPACING = 150;
        const nodesById = new Map<string, any>();
        const edges: Edge[] = [];
        const edgeSet = new Set<string>();
        
        /* ──────────────────────────────────────────────────
         * 2) DFS function: MERGE duplicate “Iran” by using
         *    characteristic_data._id as the single nodeId.
         * ────────────────────────────────────────────────── */
        

        const treeIdMap = new Map<string, string>();
        parsedPatients.forEach((p: any) => {
          const collectIds = (node: any) => {
            const id = getUniqueCharId(node);
            treeIdMap.set(id, p._id?.$oid || p._id);
            (node.children || []).forEach(collectIds);
          };
          collectIds(p.tree);
        });

        // ──────────────────────────────────────────────────
        // 3) Kick off DFS for each root
        roots.forEach((rootNode: any, idx: number) => {     
          const patientId =
            parsedPatients[idx]?._id?.$oid || parsedPatients[idx]?._id;     
          if (!rootNode) {
            console.warn(`⚠️ rootNode at index ${idx} is undefined`);
            return;
          }

          let rootSizeDecimal: Decimal;
          // const patientId = treeIdMap.get(getUniqueCharId(rootNode)) as string;
          if (selectedRootId && !truePatientId) {
            const fallbackPatient = parsedPatients.find((p: any) =>
              findNodeById(p.tree, selectedRootId)
            );
            truePatientId =
              fallbackPatient?._id?.$oid || fallbackPatient?._id || "";
          }
          
          
          // const patientId = selectedRootId
          //   ? truePatientId ?? ""
          //   : treeIdMap.get(getUniqueCharId(rootNode)) ?? "";

          if (!patientId) {
            console.warn("⚠️ No patientId found for rootNode", rootNode);
          }

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
            patientId,
            {
              selectedRootId,
              isOverviewMode,
              visited,
              edgeSet,
              nodesById,
              edges,
              hashColor,
              getUniqueCharId,
              treeIdMap,
              navigate,
              depthLimit,
            }
          );

        });

        let finalNodes = Array.from(nodesById.values()).map((node) => {
          // Get real patient ID from map
          const fallbackTreeId = treeIdMap.get(node.id) || truePatientId;

          return {
            ...node,
            data: {
              ...node.data,
              treeId: node.data.treeId || fallbackTreeId,
              docId: node.data.docId || node.data.id,
            },
          };
        });

        setNodes(finalNodes);
        

    
        // ──────────────────────────────────────────────────
        // 4) AFTER DFS completes, do a “re‐layout” pass so that no two children of the same parent overlap:
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
        // finalNodes: typeof allFlowNodes

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
          const rootNode = nodesById.get(rootUniqueId)
          if (rootNode) {
            rootNode.position = center

            // (c) grab its immediate children
            const firstRing = childrenByParent.get(rootUniqueId) || []

            // (d) place them evenly around the circle
            firstRing.forEach((childId, i) => {
              const angle = (2 * Math.PI * i) / firstRing.length
              const n = nodesById.get(childId)
              if (!n) return
              n.position = {
                x: center.x + R * Math.cos(angle),
                y: center.y + R * Math.sin(angle),
              }
            })
          }

          // (e) collect all
          finalNodes = allFlowNodes
        }
          setNodes(finalNodes)
          console.log("✅ Final Nodes:", finalNodes);
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
        Patient Map
      </Typography>
      {isOverview && overviewEmptyHint && (
        <Box textAlign="center" sx={{ mb: 2 }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {overviewEmptyHint}
          </Typography>
          <Button
            variant="contained"
            onClick={() => setCreatePatientDialogOpen(true)}>
            Create patient tree
          </Button>
        </Box>
      )}
      <CreatePatientTreeDialog
        open={createPatientDialogOpen}
        onClose={() => setCreatePatientDialogOpen(false)}
        onCreated={() => drawPatientNodes()}
      />
      {rootId && (
        <Button
          variant="contained"
          onClick={() => navigate("/patients")}
          sx={{ mb: 2 }}>
          Back to All Roots
        </Button>
      )}

      {/* Legend */}
      {!isOverview && (
        <Box display="flex" gap={2} alignItems="center" mb={1}>
          <Box display="flex" alignItems="center">
            <Box
              width={16}
              height={16}
              bgcolor="#2196f3"
              borderRadius={1}
              mr={1}
            />
            <Typography variant="body2">Characteristic</Typography>
          </Box>
          <Box display="flex" alignItems="center">
            <Box
              width={16}
              height={16}
              bgcolor="#4caf50"
              borderRadius={1}
              mr={1}
            />
            <Typography variant="body2">Treatment</Typography>
          </Box>
        </Box>
      )}

      {/* ===== React Flow Canvas ===== */}
      <div
        style={{
          width: "100%",
          height: 600,
          border: "1px solid #ddd",
          backgroundColor: mapColor,
          transition: "background-color 0.5s ease",
        }}>
        <ReactFlow
          nodes={debouncedNodes}
          edges={debouncedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
          nodeTypes={nodeTypes}
          proOptions={{ hideAttribution: true }}
          fitViewOptions={{
            padding: 0.1,
            includeHiddenNodes: false,
          }}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}>
          {/* <Background  variant="none" gap={12} size={1}  /> */}
        </ReactFlow>

        {/* Context menu (right‐click) */}
        <Menu
          open={!!ctx}
          onClose={() => setCtx(null)}
          anchorReference="anchorPosition"
          anchorPosition={ctx ? { top: ctx.y, left: ctx.x } : undefined}>
          <MenuItem
            onClick={() => {
              if (!ctx) return;
              editNode(ctx.nodeId);
              setCtx(null);
            }}>
            Edit
          </MenuItem>

          <MenuItem
            onClick={() => {
              if (!ctx) return;
              deleteNode(ctx.nodeId);
              setCtx(null);
            }}>
            Delete
          </MenuItem>

          <MenuItem
            onClick={() => {
              if (!ctx) return;
              addNode(ctx.nodeId);
              setAddingParentId(ctx.nodeId);
              setIsChoosingType(true);
              setCtx(null);
            }}>
            Add Node
          </MenuItem>
        </Menu>

        {/* ===== “Edit Characteristic” dialog ===== */}
        {editCharModalData && (
          <EditCharacteristicDialog
            open={true}
            onClose={() => setEditCharModalData(null)}
            onSaved={() => {
              setEditCharModalData(null);
              drawPatientNodes();
            }}
            editData={editCharModalData}
            allChars={allCharacteristics}
          />
        )}
        {/* ─── end “Edit Characteristic” ─── */}

        {/* ===== “Edit Treatment” dialog ===== */}
        {editTreatModalData && (
          <EditTreatmentDialog
            open={true}
            onClose={() => setEditTreatModalData(null)}
            onSaved={() => {
              setEditTreatModalData(null);
              drawPatientNodes();
            }}
            editData={editTreatModalData}
            allTreatments={allTreatments}
          />
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
          }}>
          <DialogTitle>Pick node type</DialogTitle>
          <DialogContent sx={{ display: "flex", gap: 1, pb: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                setNewNodeType("characteristic");
                setIsChoosingType(false);
              }}>
              Characteristic
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setNewNodeType("treatment");
                setIsChoosingType(false);
              }}>
              Treatment
            </Button>
            <Button
              variant="outlined"
              disabled={parentType === "characteristic"}
              onClick={() => {
                setNewNodeType("followup");
                setIsChoosingType(false);
              }}>
              Follow‐up
            </Button>
          </DialogContent>
        </Dialog>
      )}
      {/* ─── end “Pick Node Type” ─── */}

      {/* ===== “Add Characteristic Under Parent” ===== */}
      {addingParentId && newNodeType === "characteristic" && (
        <AddCharacteristicDialog
          open
          onClose={() => {
            setAddingParentId(null);
            setNewNodeType(null);
            setIsOverviewRootClick(false);
          }}
          parentNode={parentNode!}
          isOverviewRootClick={isOverviewRootClick}
          allChars={allCharacteristics}
          onSaved={drawPatientNodes}
        />
      )}
      {/* ─── end “Add Characteristic” ─── */}

      {/* ===== “Add Treatment Under Parent” ===== */}
      {addingParentId && newNodeType === "treatment" && (
        <AddTreatmentDialog
          open
          onClose={() => {
            setAddingParentId(null);
            setNewNodeType(null);
          }}
          parentNode={parentNode!}
          onSaved={drawPatientNodes}
        />
      )}
      {/* ─── end “Add Treatment” ─── */}

      {/* ===== “Add Follow‐up Under Parent” ===== */}
      {addingParentId && newNodeType === "followup" && (
        <AddFollowupDialog
          open
          onClose={() => {
            setAddingParentId(null);
            setNewNodeType(null);
          }}
          parentNode={parentNode!}
          onSaved={drawPatientNodes}
        />
      )}
      {/* ─── end “Add Follow‐up” ─── */}
    </Container>
  );
  }

export default Patients;
