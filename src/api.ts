import axios from "axios";

const API_BASE_URL = "http://localhost:5000"; // Adjust to match your backend

export const fetchPrimaryIndications = async (populationId: string) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/primary_indications/${populationId}`);
        return response.data.primary_indications;
    } catch (error) {
        console.error("Error fetching primary indications:", error);
        return [];
    }
};
