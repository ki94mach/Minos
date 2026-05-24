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
  TREATMENTS: "/api/treatments",
  TREATMENT_DETAIL: (id: string) => `/api/treatments/${id}`,
  DRUGS: "/api/drugs",
  DRUG_DETAIL: (id: string) => `/api/drugs/${id}`,
  FOLLOWUPS: "/api/followups",
  FOLLOWUP_DETAIL: (id: string) => `/api/followups/${id}`,
  ADD_NODE: (patientId: string) => `/api/patients/${patientId}/add_node`,
  DELETE_NODE: (treeId: string, nodeId: string) =>
    `/api/patients/${treeId}/node/${nodeId}`,
  UPDATE_NODE: (patientId: string, nodeId: string) =>
    `/api/patients/${patientId}/node/${nodeId}`,
};
