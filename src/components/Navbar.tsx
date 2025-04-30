import React, { useState } from "react";
import { Link, useNavigate  } from "react-router-dom";
import axios from "axios";
import {
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Drawer,
    List,
    ListItem,
    ListItemText,
    Box,
    Divider
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";

const Navbar: React.FC = () => {
    const [drawerOpen, setDrawerOpen] = useState(false);

    const toggleDrawer = (open: boolean) => () => {
        setDrawerOpen(open);
    };

    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await axios.get("http://localhost:5000/auth/logout", {
                withCredentials: true,
                validateStatus: (status) => status >= 200 && status < 400, 
            });
        } catch (error) {
            console.error("Logout error:", error);
           
        } finally {
            navigate("/auth/login"); 
        }
    };

    const menuItems = [
        { text: "Home", path: "/home" },
        { text: "Characteristics", path: "/characteristics" },
        { text: "Drugs", path: "/drugs" },
        { text: "Patients", path: "/patients" },
        { text: "Treatments", path: "/treatments" },
        { text: "Change Password", path: "/auth/change-password" }
    ];

    return (
        <>
            <AppBar position="static" >
                <Toolbar>
                    <IconButton edge="start" color="inherit" onClick={toggleDrawer(true)} aria-label="menu">
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Minos Project Menu
                    </Typography>
                </Toolbar>
            </AppBar>

            <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer(false)} >
                <Box
                    sx={{ width: 300 }}
                    role="presentation"
                    onClick={toggleDrawer(false)}
                    onKeyDown={toggleDrawer(false)}
                >
                    <List sx={{ "& .MuiListItemText-primary": { fontSize: "24px", fontWeight: 500 } }}>
                        {menuItems.map((item) => (
                            <ListItem component={Link} to={item.path} key={item.text}>
                                <ListItemText primary={item.text} />
                            </ListItem>
                        ))}
                        <Divider />
                        <ListItem 
                                component={Link} 
                                to="#" 
                                onClick={(e) => {
                                    e.preventDefault(); 
                                    handleLogout();
                                }}>
                            <LogoutIcon sx={{ mr: 2 }} />
                            <ListItemText primary="Logout" />
                        </ListItem>
                    </List>
                </Box>
            </Drawer>
        </>
    );
};

export default Navbar;
