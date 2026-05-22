import api from "../api";
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
  try {
    return await createPatient({
      node: {
        node_type: "characteristic",
        rate: 1.0,
        size: 90000000,
        parent_id: null,
        characteristic_data: {
          _id: "67d01f7b9e8a82122fb0331b",
          char_type: "Population",
          name: "Iran",
        },
        children: [],
      },
    });
  } catch (error) {
    console.error("Failed to create patient:", error);
    throw error;
  }
}
