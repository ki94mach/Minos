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
    Box
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

const Navbar: React.FC = () => {
    const [drawerOpen, setDrawerOpen] = useState(false);

    const toggleDrawer = (open: boolean) => () => {
        setDrawerOpen(open);
    };

    const menuItems = [
        { text: "Home", path: "/" },
        { text: "Characteristics", path: "/characteristics" },
        { text: "Drugs", path: "/drugs" },
        { text: "Patients", path: "/patients" },
        { text: "Treatments", path: "/treatments" }
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
                    <List>
                        {menuItems.map((item) => (
                            <ListItem component={Link} to={item.path} key={item.text}>
                                <ListItemText primary={item.text} />
                            </ListItem>
                        ))}
                    </List>
                </Box>
            </Drawer>
        </>
    );
};

export default Navbar;
