import React from "react";
import { Link } from "react-router-dom";
import {
    Container,
    Typography,
    Card,
    CardContent,
    Button,
    Grid
} from "@mui/material";

const Home: React.FC = () => {
    return (
        <Container maxWidth="sm" sx={{ mt: 5 }}>
            <Typography variant="h3" align="center" sx={{ my: 4, fontWeight: "bold" }}>
                Minos Project Dashboard
            </Typography>

            <Card sx={{ p: 3, boxShadow: 3, borderRadius: 2 }}>
                <CardContent>
                    <Typography variant="h5" align="center" sx={{ mb: 3 }}>
                        Navigate to Pages
                    </Typography>

                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Button
                                variant="contained"
                                fullWidth
                                component={Link}
                                to="/characteristics"
                            >
                                Characteristics
                            </Button>
                        </Grid>

                        <Grid item xs={12}>
                            <Button
                                variant="contained"
                                fullWidth
                                component={Link}
                                to="/drugs"
                            >
                                Drugs
                            </Button>
                        </Grid>

                        <Grid item xs={12}>
                            <Button
                                variant="contained"
                                fullWidth
                                component={Link}
                                to="/treatments"
                            >
                                Treatments
                            </Button>
                        </Grid>

                        <Grid item xs={12}>
                            <Button
                                variant="contained"
                                fullWidth
                                component={Link}
                                to="/patients"
                            >
                                Patients
                            </Button>
                        </Grid>

                        
                    </Grid>
                </CardContent>
            </Card>
        </Container>
    );
};

export default Home;
