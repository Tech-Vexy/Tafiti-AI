import React from 'react';
import {
    Lightbulb,
} from 'lucide-react';
import Image from 'next/image';
import {
    AppBar,
    Toolbar,
    Typography,
    IconButton,
    InputBase,
    Badge,
    Avatar,
    Box,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Popover,
    Paper,
    Divider,
    useTheme,
    useMediaQuery,
    alpha,
    styled,
} from '@mui/material';
import {
    Menu as MenuIcon,
    Search as SearchIcon,
    GridView as GridViewIcon,
    Notifications as NotificationsIcon,
    Close as CloseIcon,
    Check as CheckIcon,
    ExpandMore as ExpandMoreIcon,
    Dashboard as DashboardIcon,
    Folder as FolderIcon,
    LibraryBooks as LibraryBooksIcon,
    SmartToy as SmartToyIcon,
    MenuBook as MenuBookIcon,
    Link as LinkIcon,
    Person as PersonIcon,
} from '@mui/icons-material';

const Search = styled('div')(({ theme }) => ({
    position: 'relative',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    '&:hover': {
        backgroundColor: '#ffffff',
    },
    marginRight: theme.spacing(2),
    marginLeft: 0,
    width: '100%',
    maxWidth: '2xl',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
    [theme.breakpoints.up('sm')]: {
        marginLeft: theme.spacing(3),
    },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
    padding: theme.spacing(0, 2),
    height: '100%',
    position: 'absolute',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
    color: '#1e293b',
    width: '100%',
    '& .MuiInputBase-input': {
        padding: theme.spacing(1.75, 1, 1.75, 0),
        paddingLeft: `calc(1em + ${theme.spacing(4)})`,
        transition: theme.transitions.create('width'),
        width: '100%',
        fontSize: '0.875rem',
        fontWeight: 500,
        '&::placeholder': {
            color: '#94a3b8',
            fontWeight: 500,
        },
    },
}));

const DRAWER_WIDTH = 288;

const TafitiLogo = ({ size = 'md' }) => {
    const sz = size === 'sm' ? 32 : 40;
    return (
        <Box
            sx={{
                width: sz,
                height: sz,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #2c5f9e 0%, #3d7ac2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
        >
            <Lightbulb style={{ width: sz / 2, height: sz / 2, color: 'white' }} />
        </Box>
    );
};

const Layout = ({ children, user, navItems: _propNavItems, secondaryNav: propSecondaryNav, unreadNotifications = 0, notifications = [], onMarkRead }) => {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(isDesktop);
    const [notifAnchorEl, setNotifAnchorEl] = React.useState(null);

    const displayName = user?.fullName || user?.username || 'Alice Musyoka';

    const sidebarNavItems = [
        { icon: DashboardIcon, label: 'Dashboard', id: 'dashboard', active: true },
        { icon: FolderIcon, label: 'Research Projects', id: 'projects' },
        { icon: LibraryBooksIcon, label: 'My Library', id: 'library' },
        { icon: SmartToyIcon, label: 'AI Assistant', id: 'chat' },
        { icon: MenuBookIcon, label: 'Lit Review', id: 'research-review' },
        { icon: LinkIcon, label: 'Citation Manager', id: 'citations' },
        { icon: PersonIcon, label: 'My Profile', id: 'profile' },
    ];

    const userInitials = displayName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const handleSidebarToggle = () => setIsSidebarOpen(prev => !prev);
    const handleSidebarClose = () => setIsSidebarOpen(false);
    const handleNotificationClick = (e) => setNotifAnchorEl(e.currentTarget);
    const handleNotificationClose = () => setNotifAnchorEl(null);
    const notifOpen = Boolean(notifAnchorEl);

    const SidebarContent = (
        <Box
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                p: 2.5,
                overflow: 'hidden',
            }}
            role="presentation"
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, px: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
                    <TafitiLogo />
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 900,
                            fontSize: '1.25rem',
                            letterSpacing: '-0.02em',
                            color: '#1e293b',
                        }}
                    >
                        TAFITI AI
                    </Typography>
                </Box>
                {!isDesktop && (
                    <IconButton
                        onClick={handleSidebarClose}
                        size="small"
                        sx={{
                            color: '#64748b',
                            '&:hover': {
                                backgroundColor: '#f1f5f9',
                                color: '#0f172a',
                            },
                        }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                )}
            </Box>

            <nav aria-label="Primary" style={{ flex: 1, overflowY: 'auto', margin: '0 -4px' }}>
                <List sx={{ py: 0, '& .MuiListItem-root': { p: 0 } }}>
                    {sidebarNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.active;
                        return (
                            <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
                                <ListItemButton
                                    onClick={() => {
                                        if (propSecondaryNav?.[0]?.onClick && item.id === 'profile') {
                                            propSecondaryNav[0].onClick('profile');
                                        }
                                        if (!isDesktop) handleSidebarClose();
                                    }}
                                    selected={isActive}
                                    sx={{
                                        py: 1.5,
                                        px: 2,
                                        borderRadius: 3,
                                        mx: 1,
                                        mb: 0.5,
                                        fontWeight: isActive ? 600 : 500,
                                        fontSize: '0.875rem',
                                        letterSpacing: '-0.01em',
                                        '&.Mui-selected': {
                                            backgroundColor: '#2c5f9e',
                                            color: '#ffffff',
                                            boxShadow: '0 4px 12px rgba(44, 95, 158, 0.2)',
                                            '&:hover': {
                                                backgroundColor: '#234e82',
                                            },
                                        },
                                        '&:not(.Mui-selected)': {
                                            color: '#475569',
                                            '&:hover': {
                                                backgroundColor: '#f1f5f9',
                                                color: '#0f172a',
                                            },
                                        },
                                    }}
                                >
                                    <ListItemIcon
                                        sx={{
                                            minWidth: 40,
                                            color: 'inherit',
                                            '& .MuiSvgIcon-root': {
                                                fontSize: '1.25rem',
                                            },
                                        }}
                                    >
                                        <Icon />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.label}
                                        primaryTypographyProps={{
                                            fontSize: '0.875rem',
                                            fontWeight: isActive ? 600 : 500,
                                            letterSpacing: '-0.01em',
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            </nav>
        </Box>
    );

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: '#f8fafc',
                color: '#0f172a',
                display: 'flex',
                overflow: 'hidden',
            }}
        >
            <a href="#main-content" className="skip-link">Skip to content</a>

            {!isDesktop && isSidebarOpen && (
                <Box
                    sx={{
                        position: 'fixed',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(4px)',
                        zIndex: (t) => t.zIndex.drawer - 1,
                    }}
                    onClick={handleSidebarClose}
                />
            )}

            <Drawer
                variant={isDesktop ? 'persistent' : 'temporary'}
                open={isSidebarOpen}
                onClose={!isDesktop ? handleSidebarClose : undefined}
                sx={{
                    width: DRAWER_WIDTH,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: DRAWER_WIDTH,
                        boxSizing: 'border-box',
                        borderRight: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                    },
                }}
                ModalProps={{
                    keepMounted: true,
                }}
            >
                {SidebarContent}
            </Drawer>

            <Box
                component="main"
                sx={{
                    flex: 1,
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    position: 'relative',
                    ml: isDesktop && isSidebarOpen ? `${DRAWER_WIDTH}px` : 0,
                    transition: (t) => t.transitions.create('margin', {
                        easing: t.transitions.easing.sharp,
                        duration: t.transitions.duration.leavingScreen,
                    }),
                }}
            >
                <AppBar
                    position="sticky"
                    elevation={0}
                    sx={{
                        bgcolor: '#2c5f9e',
                        backgroundImage: 'none',
                        color: 'white',
                        boxShadow: '0 4px 20px rgba(44, 95, 158, 0.15)',
                        zIndex: (t) => t.zIndex.appBar,
                        flexShrink: 0,
                    }}
                >
                    <Toolbar sx={{ minHeight: '72px !important', gap: 1.5, px: { xs: 2, sm: 3 } }}>
                        {!isDesktop && (
                            <IconButton
                                color="inherit"
                                aria-label="open drawer"
                                edge="start"
                                onClick={handleSidebarToggle}
                                sx={{
                                    mr: 0,
                                    bgcolor: 'rgba(255,255,255,0.1)',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                                    p: 1.25,
                                }}
                            >
                                <MenuIcon />
                            </IconButton>
                        )}

                        <Search>
                            <SearchIconWrapper>
                                <SearchIcon fontSize="small" />
                            </SearchIconWrapper>
                            <StyledInputBase
                                placeholder="Search topics, papers, or ask AI…"
                                inputProps={{ 'aria-label': 'search' }}
                            />
                        </Search>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                            <IconButton
                                color="inherit"
                                title="Grid view"
                                aria-label="Grid view"
                                sx={{
                                    p: 1.5,
                                    borderRadius: 3,
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                                }}
                            >
                                <GridViewIcon />
                            </IconButton>

                            <Badge
                                badgeContent={unreadNotifications > 0 ? (unreadNotifications > 9 ? '9+' : unreadNotifications) : null}
                                color="error"
                                sx={{
                                    '& .MuiBadge-standard': {
                                        minWidth: 18,
                                        height: 18,
                                        fontSize: '0.65rem',
                                        fontWeight: 800,
                                        borderRadius: '50%',
                                        border: '2px solid #2c5f9e',
                                    },
                                }}
                            >
                                <IconButton
                                    color="inherit"
                                    onClick={handleNotificationClick}
                                    sx={{
                                        p: 1.5,
                                        borderRadius: 3,
                                        bgcolor: 'rgba(255,255,255,0.1)',
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                                    }}
                                >
                                    <NotificationsIcon />
                                </IconButton>
                            </Badge>

                            <Popover
                                open={notifOpen}
                                anchorEl={notifAnchorEl}
                                onClose={handleNotificationClose}
                                anchorOrigin={{
                                    vertical: 'bottom',
                                    horizontal: 'right',
                                }}
                                transformOrigin={{
                                    vertical: 'top',
                                    horizontal: 'right',
                                }}
                                PaperProps={{
                                    sx: {
                                        mt: 1.5,
                                        borderRadius: 4,
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                                        width: { xs: 'calc(100vw - 2rem)', sm: 380 },
                                        maxWidth: 380,
                                        overflow: 'hidden',
                                    },
                                }}
                            >
                                <Box sx={{ p: 2.5, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#1e293b', fontSize: '0.75rem' }}>
                                        Notifications
                                    </Typography>
                                    <Box
                                        sx={{
                                            px: 2,
                                            py: 0.75,
                                            borderRadius: 999,
                                            bgcolor: 'rgba(44,95,158,0.1)',
                                            color: '#2c5f9e',
                                            fontSize: '0.6875rem',
                                            fontWeight: 700,
                                        }}
                                    >
                                        {unreadNotifications} New
                                    </Box>
                                </Box>
                                <Box sx={{ maxHeight: 384, overflowY: 'auto' }}>
                                    {notifications.length > 0 ? (
                                        notifications.map((notif) => (
                                            <Box
                                                key={notif.id}
                                                onClick={() => {
                                                    if (!notif.is_read) onMarkRead && onMarkRead(notif.id);
                                                    if (notif.link) window.location.href = notif.link;
                                                    handleNotificationClose();
                                                }}
                                                sx={{
                                                    p: 2.5,
                                                    borderBottom: '1px solid #f1f5f9',
                                                    '&:last-child': { borderBottom: 0 },
                                                    cursor: 'pointer',
                                                    opacity: notif.is_read ? 0.7 : 1,
                                                    transition: 'background-color 0.2s',
                                                    '&:hover': { bgcolor: '#f8fafc' },
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', gap: 2 }}>
                                                    <Box
                                                        sx={{
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: 2,
                                                            bgcolor: 'rgba(44,95,158,0.1)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        <NotificationsIcon sx={{ fontSize: 16, color: '#2c5f9e' }} />
                                                    </Box>
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{
                                                                fontWeight: 600,
                                                                color: '#1e293b',
                                                                lineHeight: 1.4,
                                                                display: 'block',
                                                                fontSize: '0.75rem',
                                                            }}
                                                        >
                                                            {notif.content}
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                                                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.625rem', fontWeight: 500 }}>
                                                                {notif.created_at ? new Date(notif.created_at).toLocaleDateString() : 'Today'}
                                                            </Typography>
                                                            {!notif.is_read && <CheckIcon sx={{ fontSize: 14, color: '#2c5f9e' }} />}
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        ))
                                    ) : (
                                        <Box sx={{ p: 8, textAlign: 'center' }}>
                                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                                                No new notifications.
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            </Popover>

                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    pl: 2,
                                    pr: 1,
                                    py: 0.75,
                                    borderRadius: 4,
                                    bgcolor: 'rgba(255,255,255,0.1)',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                                    flexShrink: 0,
                                }}
                            >
                                <Avatar
                                    sx={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 3,
                                        border: '2px solid rgba(255,255,255,0.4)',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                        background: user?.imageUrl
                                            ? 'transparent'
                                            : 'linear-gradient(135deg, #2c5f9e 0%, #3d7ac2 100%)',
                                        fontSize: '0.6875rem',
                                        fontWeight: 900,
                                    }}
                                    src={user?.imageUrl}
                                    alt={displayName}
                                >
                                    {!user?.imageUrl && userInitials}
                                </Avatar>
                                <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', lineHeight: 1.2 }}>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontWeight: 700,
                                            color: '#ffffff',
                                            fontSize: '0.8125rem',
                                            letterSpacing: '-0.01em',
                                        }}
                                    >
                                        {displayName}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontWeight: 500,
                                                color: 'rgba(255,255,255,0.7)',
                                                fontSize: '0.6875rem',
                                            }}
                                        >
                                            Dashboard
                                        </Typography>
                                        <ExpandMoreIcon sx={{ fontSize: 14, opacity: 0.8 }} />
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Toolbar>
                </AppBar>

                <Box
                    id="main-content"
                    sx={{
                        flex: 1,
                        overflowY: 'auto',
                    }}
                >
                    <Box
                        sx={{
                            maxWidth: 1500,
                            mx: 'auto',
                            pt: 2.5,
                            pb: 8,
                            px: { xs: 2, sm: 3, lg: 4 },
                        }}
                    >
                        {children}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default Layout;

