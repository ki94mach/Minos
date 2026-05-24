import React from "react";
import { Link } from "react-router-dom";
import {
  Container,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Box,
  alpha,
} from "@mui/material";
import CategoryIcon from "@mui/icons-material/Category";
import MedicationIcon from "@mui/icons-material/Medication";
import HealingIcon from "@mui/icons-material/Healing";
import AccountTreeIcon from "@mui/icons-material/AccountTree";

const tiles = [
  {
    title: "Characteristics",
    description: "Define patient population attributes and types",
    path: "/characteristics",
    icon: CategoryIcon,
    color: "#38bdf8",
  },
  {
    title: "Drugs",
    description: "Manage drug catalog and dosing units",
    path: "/drugs",
    icon: MedicationIcon,
    color: "#a78bfa",
  },
  {
    title: "Treatments",
    description: "Configure regimens and alternatives",
    path: "/treatments",
    icon: HealingIcon,
    color: "#34d399",
  },
  {
    title: "Patients",
    description: "Explore and edit patient decision trees",
    path: "/patients",
    icon: AccountTreeIcon,
    color: "#6366f1",
  },
];

const Home: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ mb: 1 }}>
          Dashboard
        </Typography>
        <Typography color="text.secondary">
          Navigate to a module to manage your Minos data.
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Grid item xs={12} sm={6} key={tile.path}>
              <Card
                sx={{
                  height: "100%",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: `0 12px 28px ${alpha(tile.color, 0.18)}`,
                  },
                }}>
                <CardActionArea
                  component={Link}
                  to={tile.path}
                  sx={{ height: "100%", alignItems: "stretch" }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 2,
                        bgcolor: alpha(tile.color, 0.15),
                        color: tile.color,
                      }}>
                      <Icon />
                    </Box>
                    <Typography variant="h6" sx={{ mb: 0.5 }}>
                      {tile.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {tile.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Container>
  );
};

export default Home;
