import api from "../api";
import { resolveDefaultRootCharacteristic } from "../config/defaultCharacteristic";
import { API_ENDPOINTS } from "./endpoints";

export type CharacteristicNodeData = {
  _id: string;
  char_type: string;
  name: string;
};

export type PatientTreeNodePayload = {
  node_type: string;
  rate: number;
  size: number;
  parent_id: string | null;
  characteristic_data?: CharacteristicNodeData;
  treatment_data?: Record<string, unknown>;
  children?: PatientTreeNodePayload[];
};

/** Create a patient tree via the shared API client (REACT_APP_API_URL). */
export async function createPatient(payload: { node: PatientTreeNodePayload }) {
  const response = await api.post(API_ENDPOINTS.PATIENTS, payload);
  return response.data.id as string;
}

export async function createPatientTree() {
  const rootChar = await resolveDefaultRootCharacteristic();
  try {
    return await createPatient({
      node: {
        node_type: "characteristic",
        rate: 1.0,
        size: 90000000,
        parent_id: null,
        characteristic_data: {
          _id: rootChar._id,
          char_type: rootChar.char_type,
          name: rootChar.name,
        },
        children: [],
      },
    });
  } catch (error) {
    console.error("Failed to create patient:", error);
    throw error;
  }
}

export type NodeReference = {
  _id: string;
  kind: "file" | "link";
  title?: string | null;
  url?: string | null;
  original_name?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
  created_by?: string | null;
  created_at?: string | null;
};

/** Persist a node's free-text description. */
export async function updateNodeDescription(
  patientId: string,
  nodeId: string,
  description: string
) {
  await api.put(API_ENDPOINTS.UPDATE_NODE(patientId, nodeId), { description });
}

/** Upload a PDF/Word file reference to a node. */
export async function addNodeFileReference(
  patientId: string,
  nodeId: string,
  file: File,
  title?: string
): Promise<NodeReference> {
  const formData = new FormData();
  formData.append("file", file);
  if (title && title.trim()) {
    formData.append("title", title.trim());
  }
  // Let axios/the browser set Content-Type (including the multipart boundary).
  // Manually forcing "multipart/form-data" drops the boundary and the server
  // cannot parse the upload (request.files ends up empty).
  const response = await api.post(
    API_ENDPOINTS.NODE_REFERENCES(patientId, nodeId),
    formData
  );
  return response.data.reference as NodeReference;
}

/** Attach an external link (URL/DOI) reference to a node. */
export async function addNodeLinkReference(
  patientId: string,
  nodeId: string,
  url: string,
  title?: string
): Promise<NodeReference> {
  const response = await api.post(
    API_ENDPOINTS.NODE_REFERENCES(patientId, nodeId),
    { url, ...(title && title.trim() ? { title: title.trim() } : {}) }
  );
  return response.data.reference as NodeReference;
}

/** Remove a reference (and its stored file, if any) from a node. */
export async function deleteNodeReference(
  patientId: string,
  nodeId: string,
  referenceId: string
) {
  await api.delete(
    API_ENDPOINTS.NODE_REFERENCE_DETAIL(patientId, nodeId, referenceId)
  );
}

/** Download a stored file reference via an authenticated request. */
export async function downloadNodeReference(
  patientId: string,
  nodeId: string,
  reference: NodeReference
) {
  const response = await api.get(
    API_ENDPOINTS.NODE_REFERENCE_DOWNLOAD(patientId, nodeId, reference._id),
    { responseType: "blob" }
  );
  const blobUrl = window.URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = reference.original_name || reference.title || "reference";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
