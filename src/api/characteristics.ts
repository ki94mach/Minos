import Cookies from "js-cookie";
import { API_ENDPOINTS } from "./endpoints";
import api from "../api";
import { asApiList } from "./parseApiList";

export interface CharacteristicItem {
  _id: string;
  type: string;
  name: string;
  rate: number;
}

function authHeaders() {
  const csrf = Cookies.get("csrf_token") ?? "";
  return {
    "Content-Type": "application/json",
    "X-CSRFToken": csrf,
  };
}

export async function listCharacteristics() {
  const { data } = await api.get(API_ENDPOINTS.CHARACTERISTICS);
  return asApiList<CharacteristicItem>(data).map((obj) => ({
    ...obj,
    _id: String(obj._id),
    rate: Number(obj.rate),
  }));
}

export async function saveCharacteristic(body: {
  _id?: string;
  type: string;
  name: string;
}) {
  const cfg = { headers: authHeaders(), withCredentials: true };
  return body._id
    ? api.put(API_ENDPOINTS.CHARACTERISTIC_DETAIL(body._id), body, cfg)
    : api.post(API_ENDPOINTS.CHARACTERISTICS, body, cfg);
}

export async function deleteCharacteristic(id: string) {
  return api.delete(API_ENDPOINTS.CHARACTERISTIC_DETAIL(id), {
    headers: authHeaders(),
    withCredentials: true,
  });
}
