import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  IconButton,
  Toolbar,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import CategoryIcon from "@mui/icons-material/Category";
import MedicationIcon from "@mui/icons-material/Medication";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import HealingIcon from "@mui/icons-material/Healing";
import LockIcon from "@mui/icons-material/Lock";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import { performLogout } from "../auth/logout";
import { isMinosAuthEnabled } from "../auth/ssoConfig";

const DRAWER_WIDTH = 260;

type NavItem = {
  text: string;
  path: string;
  icon: React.ElementType;
  matchPrefix?: boolean;
};

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const showMinosAuth = isMinosAuthEnabled();

  const navItems: NavItem[] = [
    { text: "Home", path: "/home", icon: HomeIcon },
    { text: "Characteristics", path: "/characteristics", icon: CategoryIcon },
    { text: "Drugs", path: "/drugs", icon: MedicationIcon },
    { text: "Treatments", path: "/treatments", icon: HealingIcon },
    { text: "Patients", path: "/patients", icon: AccountTreeIcon, matchPrefix: true },
  ];

  const navButtonSx = {
    mb: 0.5,
    borderRadius: 2,
    "&.Mui-selected": {
      bgcolor: "primary.main",
      color: "primary.contrastText",
      "&:hover": { bgcolor: "primary.dark" },
      "& .MuiListItemIcon-root": { color: "inherit" },
    },
  };

  const isActive = (item: NavItem) => {
    if (item.matchPrefix) {
      return location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
    }
    return location.pathname === item.path;
  };

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ px: 2.5, minHeight: 72 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
          Minos
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1, px: 1.5, py: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <ListItemButton
              key={item.path}
              component={Link}
              to={item.path}
              selected={active}
              onClick={() => setMobileOpen(false)}
              sx={navButtonSx}>
              <ListItemIcon sx={{ minWidth: 40, color: active ? "inherit" : "text.secondary" }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{ fontSize: 15, fontWeight: active ? 600 : 500 }}
              />
            </ListItemButton>
          );
        })}
      </List>
      <Divider />
      <List sx={{ px: 1.5, py: 1 }}>
        {showMinosAuth && (
          <ListItemButton
            component={Link}
            to="/auth/change-password"
            selected={location.pathname === "/auth/change-password"}
            onClick={() => setMobileOpen(false)}
            sx={navButtonSx}>
            <ListItemIcon
              sx={{
                minWidth: 40,
                color:
                  location.pathname === "/auth/change-password"
                    ? "inherit"
                    : "text.secondary",
              }}>
              <LockIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Change Password"
              primaryTypographyProps={{
                fontSize: 15,
                fontWeight: location.pathname === "/auth/change-password" ? 600 : 500,
              }}
            />
          </ListItemButton>
        )}
        <ListItemButton
          onClick={() => void performLogout()}
          sx={{ borderRadius: 2 }}>
          <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: 15 }} />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
            },
          }}>
          {drawerContent}
        </Drawer>
      ) : (
        <>
          <Box
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              zIndex: theme.zIndex.appBar,
              display: "flex",
              alignItems: "center",
              px: 1,
              py: 1,
              bgcolor: "background.paper",
              borderBottom: 1,
              borderColor: "divider",
            }}>
            <IconButton onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 700, ml: 1 }}>
              Minos
            </Typography>
          </Box>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
            }}>
            {drawerContent}
          </Drawer>
        </>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          pt: { xs: 8, md: 0 },
          minHeight: "100vh",
        }}>
        {children}
      </Box>
    </Box>
  );
};

export default AppLayout;
