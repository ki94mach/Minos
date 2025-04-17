import React from "react";
import { Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

const BackButton: React.FC = () => {
    const navigate = useNavigate();

    return (
        <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/home")}
            sx={{ mb: 2 }}
        >
            Back to Home
        </Button>
    );
};

export default BackButton;
