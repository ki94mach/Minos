import axios from "axios";
import Cookies from "js-cookie";

export async function createPatientTree() {
  const csrf = Cookies.get("csrf_token") ?? "";

  try {
    const response = await axios.post(
      "http://localhost:5000/api/patients",
      {
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
      },
      {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrf,
        },
      }
    );

    return response.data.id;
  } catch (error) {
    console.error("❌ Failed to create patient:", error);
    throw error;
  }
}
