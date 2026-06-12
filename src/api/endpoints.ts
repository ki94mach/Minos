export const API_ENDPOINTS = {
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",
  RESET_PASSWORD: "/auth/reset-password",
  FORGOT_PASSWORD: "/auth/forgot-password",
  CHANGE_PASSWORD: "/auth/change-password",
  REGISTER: "/auth/register",
  PATIENTS: "/api/patients",
  PATIENT_DETAIL: (id: string) => `/api/patients/${id}`,
  CHARACTERISTICS: "/api/characteristics",
  CHARACTERISTIC_DETAIL: (id: string) => `/api/characteristics/${id}`,
  CHARACTERISTIC_REFERENCES: (id: string) =>
    `/api/characteristics/${id}/references`,
  TREATMENTS: "/api/treatments",
  TREATMENT_DETAIL: (id: string) => `/api/treatments/${id}`,
  TREATMENT_REFERENCES: (id: string) => `/api/treatments/${id}/references`,
  DRUGS: "/api/drugs",
  DRUG_DETAIL: (id: string) => `/api/drugs/${id}`,
  DRUG_REFERENCES: (id: string) => `/api/drugs/${id}/references`,
  FOLLOWUPS: "/api/followups",
  FOLLOWUP_DETAIL: (id: string) => `/api/followups/${id}`,
  ADD_NODE: (patientId: string) => `/api/patients/${patientId}/add_node`,
  DELETE_NODE: (treeId: string, nodeId: string, cascade = false) =>
    `/api/patients/${treeId}/node/${nodeId}${
      cascade ? "?cascade=true" : ""
    }`,
  UPDATE_NODE: (patientId: string, nodeId: string) =>
    `/api/patients/${patientId}/node/${nodeId}`,
  NODE_REFERENCES: (patientId: string, nodeId: string) =>
    `/api/patients/${patientId}/node/${nodeId}/references`,
  NODE_REFERENCE_DETAIL: (
    patientId: string,
    nodeId: string,
    referenceId: string
  ) => `/api/patients/${patientId}/node/${nodeId}/references/${referenceId}`,
  NODE_REFERENCE_DOWNLOAD: (
    patientId: string,
    nodeId: string,
    referenceId: string
  ) =>
    `/api/patients/${patientId}/node/${nodeId}/references/${referenceId}/download`,
};
