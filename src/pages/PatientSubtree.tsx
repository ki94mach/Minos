// pages/PatientSubtree.tsx
import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import Patients from "./Patients";

const PatientSubtree: React.FC = () => {
  return <Patients />;
};

export default PatientSubtree;
