import axios from "axios";
import Cookies from "js-cookie";

export interface CharacteristicItem {
  _id: string;
  type: string;
  name: string;
}

function authHeaders() {
  const csrf = Cookies.get("csrf_token") ?? "";
  return {
    "Content-Type": "application/json",
    "X-CSRFToken": csrf,
  };
}

export async function listCharacteristics() {
  const { data } = await axios.get("http://localhost:5000/api/characteristics");
  return data.map((s: string) => {
    const obj = JSON.parse(s);
    return { ...obj, _id: obj._id.$oid } as CharacteristicItem;
  });
}

export async function saveCharacteristic(body: {
  _id?: string;
  type: string;
  name: string;
}) {
  const cfg = { headers: authHeaders(), withCredentials: true };
  return body._id
    ? axios.put(
        `http://localhost:5000/api/characteristics/${body._id}`,
        body,
        cfg
      )
    : axios.post("http://localhost:5000/api/characteristics", body, cfg);
}

export async function deleteCharacteristic(id: string) {
  return axios.delete(
    `http://localhost:5000/api/characteristics/${id}`,
    { headers: authHeaders(), withCredentials: true }
  );
}
