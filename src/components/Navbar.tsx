import React, { useState } from "react";
import { Link } from "react-router-dom";
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
import { performLogout } from "../auth/logout";
import { isMinosAuthEnabled } from "../auth/ssoConfig";

const Navbar: React.FC = () => {
    const showMinosAuth = isMinosAuthEnabled();
    const [drawerOpen, setDrawerOpen] = useState(false);

    const toggleDrawer = (open: boolean) => () => {
        setDrawerOpen(open);
    };

    const handleLogout = () => {
        void performLogout();
    };

    const menuItems = [
        { text: "Home", path: "/home" },
        { text: "Characteristics", path: "/characteristics" },
        { text: "Drugs", path: "/drugs" },
        { text: "Patients", path: "/patients" },
        { text: "Treatments", path: "/treatments" },
        ...(showMinosAuth
            ? [{ text: "Change Password", path: "/auth/change-password" }]
            : []),
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
                                onClick={(e: React.MouseEvent) => {
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
