import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import ReactFlow, {
  addEdge,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
  Background,
  Controls,
  ReactFlowInstance,
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
  useTheme,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import { canvasBackground, treeTokens } from "../theme/theme";
import api from "../api";
import BackButton from "../components/BackButton";
import CustomNode from "../components/CustomNode";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Decimal from "decimal.js";
import { TreatmentOption } from "../components/TreatmentForm";
import EditCharacteristicDialog from "../components/patientDialogs/EditCharacteristicDialog";
import EditTreatmentDialog from "../components/patientDialogs/EditTreatmentDialog";
import AddCharacteristicDialog from "../components/patientDialogs/AddCharacteristicDialog";
import AddTreatmentDialog from "../components/patientDialogs/AddTreatmentDialog";
import AddFollowupDialog from "../components/patientDialogs/AddFollowupDialog";
import { buildCatalogMasterSnapshots } from "../utils/catalogStale";
import { buildFlowNodes } from "../utils/buildFlowNodes";
import {
  getUniqueCharId,
  getEmbeddedCharType,
  findNodeById,
  calculateSizeFromTree,
  hashColor,
  applyDagreLayout,
  overviewFlowNodeId,
  patientIdFromOverviewFlowNodeId,
  listPatientsWithPopulationRoot,
} from "../utils/patientTreeUtils";
import { API_ENDPOINTS } from "../api/endpoints";
import { asApiList } from "../api/parseApiList";
import {
  assignEdgeHandles,
  collectDescendantIds,
  filterEdgesForNodes,
  keepReachableNodes,
  layoutOverviewPreviewCluster,
} from "../utils/flowLayoutUtils";
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
  currentSize?: number;
  isTreeRoot?: boolean;
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
  const theme = useTheme();
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
  const [allDrugs, setAllDrugs] = useState<
    { _id: string; name: string; strength: number; unit: string }[]
  >([]);
  const [editTreatModalData, setEditTreatModalData] = useState<EditTreatModalData|null>(null);
  const [overviewEmptyHint, setOverviewEmptyHint] = useState<string | null>(null);
  const [createPatientDialogOpen, setCreatePatientDialogOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const [isCanvasFullscreen, setIsCanvasFullscreen] = useState(false);
  const [graphEpoch, setGraphEpoch] = useState(0);
  const [ctx, setCtx] = useState<
    { x: number; y: number; nodeId: string } | null
  >(null);

  const getOverlayContainer = useCallback(
    () =>
      (document.fullscreenElement as HTMLElement | null) ?? document.body,
    []
  );

  const patientTreeFitViewOptions = useMemo(
    () => ({
      padding: 0.2,
      includeHiddenNodes: false,
      duration: 400,
    }),
    []
  );

  const fitPatientTreeView = useCallback(() => {
    reactFlowRef.current?.fitView(patientTreeFitViewOptions);
  }, [patientTreeFitViewOptions]);

  const deleteMenuItemSx = { color: "error.main" };

  const ctxNode = useMemo(
    () => (ctx ? nodes.find((n) => n.id === ctx.nodeId) : null),
    [ctx, nodes]
  );
  const ctxIsTreeRoot = ctxNode?.data?.isTreeRoot === true;
  const ctxIsPopulationRoot =
    ctxIsTreeRoot && ctxNode?.data?.charType === "Population";

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === canvasRef.current;
      setIsCanvasFullscreen(active);
      setCtx(null);
      window.dispatchEvent(new Event("resize"));
      setTimeout(() => fitPatientTreeView(), 100);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [fitPatientTreeView]);

  const toggleCanvasFullscreen = useCallback(async () => {
    const el = canvasRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  }, []);

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

// ─── “Add Node” state: open dialog under a specific parent ───
const [addingParentId, setAddingParentId] = useState<string | null>(null);
const [isChoosingType, setIsChoosingType] = useState(false);
const [newNodeType, setNewNodeType] = useState< "characteristic" | "treatment" | "followup" | null >(null);

  const location = useLocation();
  const navState = (location.state ?? {}) as PatientsLocationState;
  const patientTreeId = navState.treeId as string;

  const mapColor = canvasBackground(navState.color);

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
        let patientDoc: any = null;
        let foundNode: any = null;

        if (n.data.treeId) {
          patientDoc = parsedList.find((p: any) => {
            const pid = p._id?.$oid || p._id;
            return String(pid) === String(n.data.treeId);
          });
          if (patientDoc && n.data.docId) {
            foundNode = findNodeById(patientDoc.tree, n.data.docId);
          }
        }

        if (!foundNode) {
          const lookupCatalogId = n.data.catalogId || uniqueCharOrTreatId;
          patientDoc = parsedList.find((p: any) => String(p._id) === patientTreeId);
          if (!patientDoc) {
            for (const p of parsedList) {
              const maybeMatch = findNodeById(p.tree, lookupCatalogId);
              if (maybeMatch) {
                patientDoc = p;
                foundNode = maybeMatch;
                break;
              }
            }
          } else {
            foundNode = findNodeById(patientDoc.tree, lookupCatalogId);
          }
        }

        if (!patientDoc) {
          alert("Could not find that patient in the list.");
          return;
        }

        const realPatientId: string = patientDoc._id?.$oid || patientDoc._id;

        if (!foundNode) {
          alert("Node not found inside this patient’s tree.");
          return;
        }

        const realNodeId: string = foundNode._id?.$oid || foundNode._id;

        const existingParentId: string =
          foundNode.parent_id?._id?.$oid || foundNode.parent_id;

        if (n.data.type === "characteristic") {
          const existingType = getEmbeddedCharType(foundNode) || "";
          const existingName = foundNode.characteristic_data?.name || "";
          const existingRate = foundNode.rate ?? 0;
          const isTreeRoot = n.data.isTreeRoot === true;
          const existingSize =
            typeof foundNode.size === "number"
              ? foundNode.size
              : typeof n.data.size === "number"
                ? n.data.size
                : 1;
          setEditCharModalData({
            nodeId: realNodeId,
            currentCharId: getUniqueCharId(foundNode),
            currentType: existingType,
            currentName: existingName,
            currentRate: existingRate,
            currentSize: existingSize,
            isTreeRoot,
            patientId: realPatientId,
            parentId: existingParentId,
          });
        } else if (n.data.type === "treatment") {
          const existingRate = foundNode.rate ?? 0;
          const realNodeId = foundNode._id?.$oid || foundNode._id;
          const realPatientId = patientDoc._id?.$oid || patientDoc._id;

          setEditTreatModalData({
            nodeId: realNodeId,
            currentTreatId: getUniqueCharId(foundNode),
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
 

  const applyFlowGraph = useCallback(
    (nextNodes: any[], nextEdges: Edge[]) => {
      setNodes(nextNodes);
      setEdges(nextEdges);
      setDebouncedNodes(nextNodes);
      setDebouncedEdges(nextEdges);
    },
    [setNodes, setEdges]
  );

  const pruneFlowGraph = useCallback(
    (nodeId: string, nodeList: any[], edgeList: Edge[]) => {
      const removedIds = collectDescendantIds(nodeId, edgeList);
      return {
        nodes: nodeList.filter((n) => !removedIds.has(n.id)),
        edges: edgeList.filter(
          (e) => !removedIds.has(e.source) && !removedIds.has(e.target)
        ),
      };
    },
    []
  );

  /* ───────────── delete node (splice or cascade) or whole tree at root ───────────── */
  async function deleteNode(nodeId: string, options?: { cascade?: boolean }) {
    const node = nodes.find((n: any) => n.id === nodeId);
    if (!node) return;

    const nodeDocId = node.data.docId;
    const patientTreeId = node.data.treeId;
    const isTreeRoot = node.data.isTreeRoot === true;
    const isPopulationRoot =
      isTreeRoot && node.data.charType === "Population";
    const cascade = options?.cascade === true;

    if (!patientTreeId && !isPopulationRoot) {
      alert("Missing patient model ID.");
      return;
    }

    const populationName = node.data.label || "Population";
    const populationCatalogId = node.data.catalogId as string | undefined;

    let confirmMsg: string;
    if (isPopulationRoot) {
      // Fetched below; placeholder until we know how many models match.
      confirmMsg = "";
    } else if (isTreeRoot) {
      confirmMsg =
        "Delete this entire patient model? You can create a new one afterward.";
    } else if (cascade) {
      confirmMsg =
        "Remove this branch?\n\nThis node and everything below it will be removed. This cannot be undone.";
    } else {
      confirmMsg =
        "Remove this node?\n\nThe branch below will stay connected to the node above.";
    }

    try {
      if (isPopulationRoot) {
        if (!populationCatalogId) {
          alert("Missing population catalog ID.");
          return;
        }

        const res = await api.get(API_ENDPOINTS.PATIENTS);
        const parsedList = asApiList<any>(res.data);
        const toDelete = listPatientsWithPopulationRoot(
          parsedList,
          populationCatalogId
        );

        if (toDelete.length === 0) {
          alert("No patient models found for this population.");
          return;
        }

        const count = toDelete.length;
        const modelLabel = count === 1 ? "patient model" : `${count} patient models`;
        const populationConfirm =
          `Delete ${modelLabel} for "${populationName}"?\n\n` +
          "Every branch under " +
          (count === 1 ? "this population" : "each model") +
          " (characteristics, treatments, and follow-ups) will be permanently removed from the database. " +
          "This cannot be undone.";
        if (!window.confirm(populationConfirm)) return;

        for (const patient of toDelete) {
          const pid = patient._id?.$oid || patient._id;
          await api.delete(API_ENDPOINTS.PATIENT_DETAIL(String(pid)));
        }

        await drawPatientNodes();
        alert(
          count === 1
            ? "Population and all of its branches were deleted."
            : `${count} patient models for "${populationName}" were deleted.`
        );
        return;
      }

      if (!window.confirm(confirmMsg)) return;

      if (isTreeRoot) {
        await api.delete(API_ENDPOINTS.PATIENT_DETAIL(patientTreeId));
      } else {
        if (!nodeDocId) {
          alert("Missing node ID.");
          return;
        }
        await api.delete(
          API_ENDPOINTS.DELETE_NODE(patientTreeId, nodeDocId, cascade)
        );
      }

      const pruned = cascade
        ? pruneFlowGraph(nodeId, nodes, edges)
        : { nodes, edges: edges.filter((e) => e.source !== nodeId && e.target !== nodeId) };
      if (cascade) {
        applyFlowGraph(pruned.nodes, pruned.edges);
      } else {
        applyFlowGraph(
          nodes.filter((n) => n.id !== nodeId),
          pruned.edges
        );
      }

      await drawPatientNodes();
      alert(
        isTreeRoot
          ? "Patient model deleted."
          : cascade
            ? "Branch removed."
            : "Node removed. The branch below was kept."
      );
    } catch (err: any) {
      const msg =
        err.response?.data?.error ??
        err.response?.data?.message ??
        "Error deleting.";
      alert(msg);
      console.error(err);
    }
  }
  
  function addNode(parentId: string) {
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) return;

    setAddingParentId(parentId);
    setIsChoosingType(true);
  }
  
  /* ----------------------------- effects ---------------------------------- */

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNodes(nodes);
      setDebouncedEdges(edges);
    }, 50);
  
    return () => clearTimeout(timer);
  }, [nodes, edges]);

  // Fit after graph rebuild (drill-down, back to overview, delete, etc.) — not on node drag.
  useEffect(() => {
    if (debouncedNodes.length === 0) return;
    const timer = window.setTimeout(() => fitPatientTreeView(), 120);
    return () => window.clearTimeout(timer);
  }, [selectedRootId, graphEpoch, debouncedNodes.length, fitPatientTreeView]);

  useEffect(() => {
       drawPatientNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload graph when route root changes
    }, [selectedRootId]);

  useEffect(() => {
    Promise.all([
      api.get(API_ENDPOINTS.CHARACTERISTICS),
      api.get(API_ENDPOINTS.TREATMENTS),
      api.get(API_ENDPOINTS.DRUGS),
    ])
      .then(([chars, treatments, drugs]) => {
        setAllCharacteristics(asApiList(chars.data));
        setAllTreatments(asApiList(treatments.data));
        setAllDrugs(asApiList(drugs.data));
      })
      .catch((err) => console.error("Error fetching catalog masters:", err));
  }, [selectedRootId]);

  useEffect(() => {
    api.get(API_ENDPOINTS.PATIENTS)
      .then(() => drawPatientNodes())
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial patient graph load
  }, [selectedRootId]);

  useEffect(() => {
    drawPatientNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh stale hints when catalog lists load
  }, [allCharacteristics, allTreatments, allDrugs]);

  /* --------------------- react‑flow edge connect -------------------------- */
  const onConnect = useCallback(
    (connection: Edge | Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onNodeClick = (_: any, node: any) => {
    if (!node.data.canDrillDown) return;

    const clickedId = node.data.catalogId ?? node.id;
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
          applyFlowGraph([], []);
          return;
        }

        setOverviewEmptyHint(null);

        if (selectedRootId) {
          const drillPatient = parsedPatients.find((p: any) =>
            findNodeById(p.tree, selectedRootId)
          );
          const drillTarget = drillPatient
            ? findNodeById(drillPatient.tree, selectedRootId)
            : null;
          if (
            drillTarget &&
            getEmbeddedCharType(drillTarget) !== "Primary Indication"
          ) {
            navigate("/patients", { replace: true });
            return;
          }
        }

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
          applyFlowGraph([], []);
          return;
        }
    
        /* ──────────────────────────────────────────────────
         * 1) Set up global DFS registries for this draw
         * ────────────────────────────────────────────────── */
        const isOverviewMode = selectedRootId === null;
        const visited = new Set<string>();
        const nodesById = new Map<string, any>();
        const edges: Edge[] = [];
        const edgeSet = new Set<string>();
        
        /* ──────────────────────────────────────────────────
         * 2) DFS: overview merges by catalog id; drill-down uses
         *    each tree node’s document _id so duplicates stay distinct.
         * ────────────────────────────────────────────────── */
        

        const catalogMasters = buildCatalogMasterSnapshots(
          allCharacteristics,
          allTreatments,
          allDrugs
        );

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
            null,
            {
              selectedRootId,
              isOverviewMode,
              visited,
              edgeSet,
              nodesById,
              edges,
              hashColor,
              getUniqueCharId,
              navigate,
              depthLimit,
              catalogMasters,
            }
          );

        });

        let finalNodes = Array.from(nodesById.values()).map((node) => {
          const fallbackTreeId =
            patientIdFromOverviewFlowNodeId(node.id) || truePatientId;

          return {
            ...node,
            data: {
              ...node.data,
              treeId: node.data.treeId || fallbackTreeId,
              docId: node.data.docId || node.data.id,
            },
          };
        });

        let routedEdges = assignEdgeHandles(finalNodes, edges);

        // Overview scopes nodes per patient tree; orphans can linger after delete.
        if (isOverviewMode) {
          const overviewRootIds = roots.map((rootNode: any, idx: number) => {
            const pid =
              parsedPatients[idx]?._id?.$oid || parsedPatients[idx]?._id;
            return overviewFlowNodeId(pid, getUniqueCharId(rootNode));
          });
          finalNodes = keepReachableNodes(finalNodes, routedEdges, overviewRootIds);
          routedEdges = filterEdgesForNodes(finalNodes, routedEdges);
        }

        if (selectedRootId) {
          finalNodes = applyDagreLayout(finalNodes, routedEdges);
        } else {
          let offsetX = 360;
          roots.forEach((rootNode: any, idx: number) => {
            const pid =
              parsedPatients[idx]?._id?.$oid || parsedPatients[idx]?._id;
            const rootUniqueId = overviewFlowNodeId(
              pid,
              getUniqueCharId(rootNode)
            );
            const { nodes: laidOut, clusterWidth } = layoutOverviewPreviewCluster(
              finalNodes,
              routedEdges,
              rootUniqueId,
              { x: offsetX, y: 320 }
            );
            finalNodes = laidOut;
            offsetX += clusterWidth;
          });
        }

        routedEdges = assignEdgeHandles(finalNodes, routedEdges);
        applyFlowGraph(finalNodes, routedEdges);
        setGraphEpoch((epoch) => epoch + 1);
      } catch (err) {
        console.error("Error drawing patients:", err);
        alert("Failed to draw patients.");
      }
    };

  /* ---------------------------------------------------------------------- */
  /*                                  UI                                    */
  /* ---------------------------------------------------------------------- */
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <BackButton />
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          mb: overviewEmptyHint ? 2 : 4,
        }}>
        <Typography variant="h3">Patient Map</Typography>
        {isOverview && (
          <Button variant="contained" onClick={() => setCreatePatientDialogOpen(true)}>
            Create patient tree
          </Button>
        )}
      </Box>
      {isOverview && overviewEmptyHint && (
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          {overviewEmptyHint}
        </Typography>
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
        <Box display="flex" gap={1.5} alignItems="center" mb={2}>
          <Chip
            size="small"
            label="Characteristic"
            sx={{
              bgcolor: "transparent",
              border: `1px solid ${treeTokens.characteristic}`,
              color: treeTokens.characteristic,
            }}
          />
          <Chip
            size="small"
            label="Treatment"
            sx={{
              bgcolor: "transparent",
              border: `1px solid ${treeTokens.treatment}`,
              color: treeTokens.treatment,
            }}
          />
        </Box>
      )}

      {/* ===== React Flow Canvas ===== */}
      <Box
        ref={canvasRef}
        className="patient-tree-canvas"
        sx={{
          width: "100%",
          height: isCanvasFullscreen ? "100vh" : { xs: 480, md: 640 },
          borderRadius: isCanvasFullscreen ? 0 : 3,
          border: isCanvasFullscreen ? "none" : `1px solid ${theme.palette.divider}`,
          background: mapColor,
          transition: "background 0.5s ease",
          overflow: "hidden",
          boxShadow: isCanvasFullscreen ? "none" : "0 8px 32px rgba(0, 0, 0, 0.35)",
          position: "relative",
          "&:fullscreen": {
            width: "100vw",
            height: "100vh",
            borderRadius: 0,
            border: "none",
          },
        }}>
        <Tooltip
          title={isCanvasFullscreen ? "Exit full screen" : "Full screen"}
          slotProps={{ popper: { container: getOverlayContainer } }}>
          <IconButton
            onClick={() => void toggleCanvasFullscreen()}
            aria-label={isCanvasFullscreen ? "Exit full screen" : "Full screen"}
            size="small"
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 10,
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              boxShadow: 1,
              "&:hover": { bgcolor: "action.hover" },
            }}>
            {isCanvasFullscreen ? (
              <FullscreenExitIcon fontSize="small" />
            ) : (
              <FullscreenIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        <ReactFlow
          nodes={debouncedNodes}
          edges={debouncedEdges}
          onInit={(instance) => {
            reactFlowRef.current = instance;
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
          nodeTypes={nodeTypes}
          proOptions={{ hideAttribution: true }}
          fitViewOptions={patientTreeFitViewOptions}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}>
          {!isOverview && <Background color="#334155" gap={20} size={1} />}
          <Controls showInteractive={false} />
        </ReactFlow>

        {/* Context menu (right‐click) */}
        <Menu
          open={!!ctx}
          onClose={() => setCtx(null)}
          container={getOverlayContainer}
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
              addNode(ctx.nodeId);
              setAddingParentId(ctx.nodeId);
              setIsChoosingType(true);
              setCtx(null);
            }}>
            Add Node
          </MenuItem>

          {isOverview ? (
            ctx &&
            (ctxIsPopulationRoot ? (
              <MenuItem
                sx={deleteMenuItemSx}
                onClick={() => {
                  deleteNode(ctx.nodeId);
                  setCtx(null);
                }}>
                Delete Population
              </MenuItem>
            ) : (
              !ctxIsTreeRoot && (
                <MenuItem
                  sx={deleteMenuItemSx}
                  onClick={() => {
                    deleteNode(ctx.nodeId, { cascade: true });
                    setCtx(null);
                  }}>
                  Remove Branch
                </MenuItem>
              )
            ))
          ) : (
            ctx && (
              <MenuItem
                sx={deleteMenuItemSx}
                onClick={() => {
                  deleteNode(ctx.nodeId, { cascade: true });
                  setCtx(null);
                }}>
                Remove Branch
              </MenuItem>
            )
          )}
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
            container={getOverlayContainer}
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
            container={getOverlayContainer}
          />
        )}

        {/* ─── end “Edit Treatment” ─── */}
      </Box>
      {/* ─── end ReactFlow container ─── */}

      {/* ===== “Pick Node Type” dialog ===== */}
      {isChoosingType && (
        <Dialog
          open
          container={getOverlayContainer}
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
              disabled={parentType !== "treatment"}
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
          }}
          parentNode={parentNode!}
          onSaved={drawPatientNodes}
          container={getOverlayContainer}
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
          container={getOverlayContainer}
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
          container={getOverlayContainer}
        />
      )}
      {/* ─── end “Add Follow‐up” ─── */}
    </Container>
  );
  }

export default Patients;
