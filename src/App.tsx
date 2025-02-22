import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Characteristics from "./pages/Characteristics";
import Drugs from "./pages/Drugs";
import Patients from "./pages/Patients";
import Treatments from "./pages/Treatments";
import Navbar from "./components/Navbar";

const App: React.FC = () => {
  return (
      <Router>
          <Navbar />
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/characteristics" element={<Characteristics />} />
            <Route path="/drugs" element={<Drugs />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/treatments" element={<Treatments />} />
        </Routes>
      </Router>
  );
};

export default App;
