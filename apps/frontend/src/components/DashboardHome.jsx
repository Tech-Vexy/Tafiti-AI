'use client';

import React from 'react';
import {
    Lightbulb,
    CheckCircle2,
    Circle,
    FileText,
    FolderOpen,
    Clock,
    Sparkles,
    BookOpenCheck,
    PieChart,
    PenLine,
    Globe,
} from 'lucide-react';
import {
    Box,
    Card,
    CardContent,
    CardHeader,
    Typography,
    Grid,
    Button,
    IconButton,
    FormControlLabel,
    Checkbox,
    LinearProgress,
    Chip,
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Stack,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Paper,
    Divider,
} from '@mui/material';
import {
    GridView as GridViewIcon,
    ExpandMore as ExpandMoreIcon,
    MoreHoriz as MoreHorizIcon,
    AutoAwesome as AutoAwesomeIcon,
    MenuBook as MenuBookIcon,
    AccessTime as AccessTimeIcon,
    Description as DescriptionIcon,
    Folder as FolderIcon,
    Search as SearchIcon,
    EmojiEvents as EmojiEventsIcon,
    Dashboard as DashboardIcon,
    Task as TaskIcon,
    BarChart as BarChartIcon,
    Build as BuildIcon,
} from '@mui/icons-material';

const palettes = {
    mint: {
        bg: '#e6f4f1',
        iconBg: '#c4e5dc',
        icon: '#0f766e',
        title: '#134e4a',
        meta: '#115e59',
        bar: '#14b8a6',
        barBg: '#c4e5dc',
        btn: '#0f766e',
        border: 'rgba(20, 184, 166, 0.1)',
    },
    peach: {
        bg: '#fff1e0',
        iconBg: '#ffd9b3',
        icon: '#c2410c',
        title: '#7c2d12',
        meta: '#9a3412',
        bar: '#fb923c',
        barBg: '#ffd9b3',
        btn: '#c2410c',
        border: 'rgba(251, 146, 60, 0.1)',
    },
    blue: {
        bg: '#eef2ff',
        iconBg: '#c7d2fe',
        icon: '#3730a3',
        title: '#1e1b4b',
        meta: '#3730a3',
        bar: '#6366f1',
        barBg: '#c7d2fe',
        btn: '#3730a3',
        border: 'rgba(99, 102, 241, 0.1)',
    },
    rose: {
        bg: '#fff1f2',
        iconBg: '#fecdd3',
        icon: '#be123c',
        title: '#4c0519',
        meta: '#9f1239',
        bar: '#f43f5e',
        barBg: '#fecdd3',
        btn: '#be123c',
        border: 'rgba(244, 63, 94, 0.1)',
    },
    sky: {
        bg: '#e0f2fe',
        iconBg: '#bae6fd',
        icon: '#0369a1',
        title: '#082f49',
        meta: '#075985',
        bar: '#0ea5e9',
        barBg: '#bae6fd',
        btn: '#0369a1',
        border: 'rgba(14, 165, 233, 0.1)',
    },
};

const GlassCard = ({ children, sx = {} }) => (
    <Card
        sx={{
            bgcolor: '#ffffff',
            borderRadius: 4,
            border: '1px solid rgba(15, 23, 42, 0.04)',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            transition: 'all 0.3s ease',
            '&:hover': {
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
            },
            height: '100%',
            ...sx,
        }}
    >
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
            {children}
        </CardContent>
    </Card>
);

const CardHeaderMUI = ({ title, actionLabel, actionIcon: ActionIcon, action }) => (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.125rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
            {title}
        </Typography>
        <IconButton
            size="small"
            onClick={action}
            sx={{
                p: 1,
                color: '#94a3b8',
                '&:hover': {
                    color: '#0f172a',
                    bgcolor: '#f1f5f9',
                },
            }}
        >
            {ActionIcon ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ActionIcon sx={{ fontSize: 18 }} />
                    {actionLabel && (
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {actionLabel}
                        </Typography>
                    )}
                </Box>
            ) : (
                <MoreHorizIcon sx={{ fontSize: 20 }} />
            )}
        </IconButton>
    </Box>
);

const ProjectCard = ({ project, color }) => {
    const p = palettes[color] || palettes.mint;
    const ProjectIcon = project.icon || FolderIcon;

    return (
        <Box
            sx={{
                bgcolor: p.bg,
                borderRadius: 4,
                p: 2.5,
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                '&:hover': {
                    boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
                    transform: 'translateY(-1px)',
                },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                <Avatar
                    sx={{
                        width: 40,
                        height: 40,
                        bgcolor: p.iconBg,
                        borderRadius: 3,
                        color: p.icon,
                    }}
                >
                    <ProjectIcon style={{ width: 20, height: 20 }} />
                </Avatar>
            </Box>
            <Typography
                variant="subtitle1"
                sx={{
                    fontWeight: 800,
                    fontSize: '1rem',
                    mb: 2,
                    lineHeight: 1.3,
                    color: p.title,
                    letterSpacing: '-0.01em',
                }}
            >
                {project.title}
            </Typography>

            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: p.btn, fontSize: '0.75rem' }}>
                        {project.progress}%
                    </Typography>
                </Box>
                <Box
                    sx={{
                        height: 8,
                        borderRadius: 999,
                        bgcolor: p.barBg,
                        overflow: 'hidden',
                    }}
                >
                    <Box
                        sx={{
                            height: '100%',
                            bgcolor: p.bar,
                            borderRadius: 999,
                            transition: 'width 0.7s ease',
                            width: `${project.progress}%`,
                        }}
                    />
                </Box>
            </Box>

            <Stack spacing={1.5} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <CheckCircle2 style={{ width: 14, height: 14, color: p.icon, opacity: 0.8, flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ color: p.meta, fontWeight: 600, fontSize: '0.75rem' }}>
                        {project.progress}% complete
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <FileText style={{ width: 14, height: 14, color: p.icon, opacity: 0.8, flexShrink: 0 }} />
                    <Typography variant="caption" sx={{ color: p.meta, fontWeight: 600, fontSize: '0.75rem' }}>
                        {project.resources} resources
                    </Typography>
                </Box>
            </Stack>

            <Box
                sx={{
                    pt: 2,
                    borderTop: `1px solid ${p.border}`,
                }}
            >
                <Typography variant="caption" sx={{ fontWeight: 700, color: p.btn, fontSize: '0.75rem' }}>
                    Next Step: {project.nextStep}
                </Typography>
            </Box>
        </Box>
    );
};

const ActivityItem = ({ title, time, color = 'mint', icon: Icon = AccessTimeIcon }) => {
    const p = palettes[color] || palettes.mint;

    return (
        <ListItem
            disablePadding
            sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                py: 1.25,
                px: 1,
                mx: -1,
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                '&:hover': {
                    bgcolor: '#f8fafc',
                },
            }}
            component="div"
        >
            <Avatar
                sx={{
                    width: 36,
                    height: 36,
                    bgcolor: p.bg,
                    color: p.icon,
                    borderRadius: 3,
                    mt: 0.25,
                    flexShrink: 0,
                }}
            >
                <Icon sx={{ fontSize: 18 }} />
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 600,
                        color: '#1e293b',
                        truncate: true,
                        lineHeight: 1.3,
                        transition: 'color 0.2s',
                        '&:hover': {
                            color: '#2c5f9e',
                        },
                        fontSize: '0.875rem',
                    }}
                >
                    {title}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, mt: 0.75, display: 'block', fontSize: '0.6875rem' }}>
                    {time}
                </Typography>
            </Box>
        </ListItem>
    );
};

const TaskItem = ({ label, done }) => (
    <Box
        sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            py: 1.25,
            px: 1,
            mx: -1,
            borderRadius: 3,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            '&:hover': {
                bgcolor: '#f8fafc',
            },
        }}
    >
        <Checkbox
            checked={done}
            sx={{
                p: 0.5,
                color: done ? '#2c5f9e' : '#cbd5e1',
                '&.Mui-checked': {
                    color: '#2c5f9e',
                },
                '& .MuiSvgIcon-root': {
                    fontSize: 24,
                },
            }}
        />
        <Typography
            variant="body2"
            sx={{
                lineHeight: 1.3,
                color: done ? '#94a3b8' : '#334155',
                textDecoration: done ? 'line-through' : 'none',
                fontWeight: done ? 500 : 600,
                fontSize: '0.875rem',
            }}
        >
            {label}
        </Typography>
    </Box>
);

const ChatBubble = ({ side, children, accent = false, userAvatar }) => {
    if (side === 'right') {
        return (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 1.5, mb: 2 }}>
                <Box
                    sx={{
                        maxWidth: '78%',
                        bgcolor: '#2c5f9e',
                        color: '#ffffff',
                        borderRadius: 4,
                        borderTopRightRadius: 4,
                        px: 2.5,
                        py: 2,
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        lineHeight: 1.6,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                >
                    {children}
                </Box>
                {userAvatar && (
                    <Avatar
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: 3,
                            overflow: 'hidden',
                            flexShrink: 0,
                            border: '2px solid #ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            background: 'linear-gradient(135deg, #2c5f9e 0%, #3d7ac2 100%)',
                            fontSize: '0.625rem',
                            fontWeight: 900,
                        }}
                    >
                        AM
                    </Avatar>
                )}
            </Box>
        );
    }
    return (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
            <Avatar
                sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 3,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: accent ? '#fff1e0' : '#eef2ff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    color: accent ? '#c2410c' : '#3730a3',
                }}
            >
                {accent ? <Lightbulb style={{ width: 16, height: 16 }} /> : <Sparkles style={{ width: 16, height: 16 }} />}
            </Avatar>
            <Box
                sx={{
                    maxWidth: '85%',
                    bgcolor: accent ? '#fff1e0' : '#f8fafc',
                    color: accent ? '#7c2d12' : '#334155',
                    borderRadius: 4,
                    borderTopLeftRadius: 4,
                    px: 2.5,
                    py: 2,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    lineHeight: 1.6,
                    border: '1px solid #e2e8f0',
                }}
            >
                {children}
            </Box>
        </Box>
    );
};

const BarChartMUI = () => {
    const days = [
        { label: 'Mon', a: 45, b: 50 },
        { label: 'Tue', a: 65, b: 80 },
        { label: 'Wed', a: 55, b: 55 },
        { label: 'Thu', a: 40, b: 85 },
        { label: 'Fri', a: 50, b: 70 },
        { label: 'Sat', a: 70, b: 90 },
    ];

    return (
        <Box sx={{ pt: 1 }}>
            <Stack direction="row" spacing={3} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                        sx={{
                            width: 10,
                            height: 10,
                            borderRadius: 0.5,
                            bgcolor: '#fff1e0',
                            border: '1px solid rgba(251, 146, 60, 0.4)',
                        }}
                    />
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.6875rem' }}>
                        Prompts
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                        sx={{
                            width: 10,
                            height: 10,
                            borderRadius: 0.5,
                            bgcolor: '#14b8a6',
                        }}
                    />
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.6875rem' }}>
                        AI Chart
                    </Typography>
                </Box>
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-end', height: 96, px: 0.5 }}>
                {days.map((day) => (
                    <Box
                        key={day.label}
                        sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 1,
                        }}
                    >
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 0.75, height: 80 }}>
                            <Box
                                sx={{
                                    width: '40%',
                                    bgcolor: 'rgba(251, 146, 60, 0.3)',
                                    border: '1px solid rgba(251, 146, 60, 0.4)',
                                    borderTopLeftRadius: 4,
                                    borderTopRightRadius: 4,
                                    transition: 'all 0.2s',
                                    height: `${day.a}%`,
                                    '&:hover': {
                                        bgcolor: 'rgba(251, 146, 60, 0.5)',
                                    },
                                }}
                            />
                            <Box
                                sx={{
                                    width: '40%',
                                    bgcolor: '#14b8a6',
                                    borderTopLeftRadius: 4,
                                    borderTopRightRadius: 4,
                                    transition: 'all 0.2s',
                                    height: `${day.b}%`,
                                    '&:hover': {
                                        bgcolor: '#0d9488',
                                    },
                                }}
                            />
                        </Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.625rem' }}>
                            {day.label}
                        </Typography>
                    </Box>
                ))}
            </Stack>
        </Box>
    );
};

const ToolCard = ({ title, subtitle, color, icon: Icon }) => {
    const p = palettes[color] || palettes.blue;

    return (
        <Box
            sx={{
                bgcolor: p.bg,
                borderRadius: 4,
                p: 2,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                '&:hover': {
                    boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
                    transform: 'translateY(-2px)',
                },
            }}
        >
            <Avatar
                sx={{
                    width: 40,
                    height: 40,
                    bgcolor: 'rgba(255,255,255,0.6)',
                    borderRadius: 3,
                    color: p.text || p.icon,
                    flexShrink: 0,
                }}
            >
                <Icon sx={{ fontSize: 20 }} />
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                    variant="subtitle2"
                    sx={{
                        fontWeight: 800,
                        color: p.text || p.title,
                        truncate: true,
                        lineHeight: 1.3,
                        fontSize: '0.875rem',
                    }}
                >
                    {title}
                </Typography>
                <Typography
                    variant="caption"
                    sx={{
                        fontWeight: 600,
                        mt: 0.5,
                        display: 'block',
                        truncate: true,
                        color: `${p.text || p.icon}B3`,
                        fontSize: '0.75rem',
                    }}
                >
                    {subtitle}
                </Typography>
            </Box>
        </Box>
    );
};

const DashboardHome = () => {
    const projects = [
        {
            title: 'Climate Change Impacts on Kenyan Agriculture',
            progress: 65,
            resources: 14,
            nextStep: 'Analyze Data',
            color: 'mint',
            icon: Globe,
        },
        {
            title: 'Renewable Energy Adoption In East Africa',
            progress: 38,
            resources: 9,
            nextStep: 'Literature Review',
            color: 'peach',
            icon: Lightbulb,
        },
    ];

    const insights = [
        'AI Climate Change Impact on Carbon Sequestration for Project 1',
        'Recent trials and inclusive Sequestri CarbonSequtions in Project 2',
        'Research Scopes and potential Innovations for Project 1',
    ];

    const activity = [
        { title: 'Climate Change Impacts...', time: '25 minutes ago', color: 'mint', icon: Clock },
        { title: 'Climate Change Impacts...', time: '14 minutes ago', color: 'peach', icon: FolderOpen },
        { title: 'Renewable Energy Adop...', time: '15 minutes ago', color: 'blue', icon: Clock },
    ];

    const tasks = [
        { label: 'Dashboard', done: true },
        { label: 'Task overview', done: true },
        { label: 'Enable list', done: false },
        { label: 'Application of timers', done: false },
        { label: 'Review easiest', done: false },
    ];

    return (
        <Box sx={{ '& > * + *': { mt: 6 } }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', lg: 'row' },
                    alignItems: { lg: 'center' },
                    justifyContent: 'space-between',
                    gap: 3,
                }}
            >
                <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', mb: 1.5, display: 'block', fontSize: '0.8125rem' }}>
                        Dashboard
                    </Typography>
                    <Typography
                        variant="h3"
                        sx={{
                            fontWeight: 900,
                            color: '#0f172a',
                            letterSpacing: '-0.02em',
                            fontSize: { xs: '1.875rem', sm: '2.25rem' },
                        }}
                    >
                        Welcome back, Alice!
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#475569', mt: 1, fontWeight: 500 }}>
                        Ready to delve into your research?
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                    <Button
                        variant="outlined"
                        startIcon={<GridViewIcon />}
                        sx={{
                            px: 2.5,
                            py: 1.5,
                            bgcolor: '#ffffff',
                            color: '#334155',
                            borderColor: '#e2e8f0',
                            borderWidth: '1.5px',
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            borderRadius: 3,
                            textTransform: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            '&:hover': {
                                borderColor: 'rgba(44,95,158,0.3)',
                                color: '#2c5f9e',
                                borderWidth: '1.5px',
                                bgcolor: '#ffffff',
                            },
                        }}
                    >
                        Show to Projects
                    </Button>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <Select
                            defaultValue="all"
                            sx={{
                                bgcolor: '#ffffff',
                                borderRadius: 3,
                                fontWeight: 700,
                                fontSize: '0.8125rem',
                                color: '#334155',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                '.MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#e2e8f0',
                                    borderWidth: '1.5px',
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(44,95,158,0.3)',
                                    borderWidth: '1.5px',
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#2c5f9e',
                                    borderWidth: '1.5px',
                                },
                            }}
                            IconComponent={ExpandMoreIcon}
                        >
                            <MenuItem value="all">All resource</MenuItem>
                            <MenuItem value="recent">Recent</MenuItem>
                            <MenuItem value="archived">Archived</MenuItem>
                            <MenuItem value="starred">Starred</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12} lg={5}>
                    <GlassCard>
                        <CardHeaderMUI title="Active Projects" />
                        <Grid container spacing={2}>
                            {projects.map((p, idx) => (
                                <Grid item xs={12} sm={6} key={idx}>
                                    <ProjectCard project={p} color={p.color} />
                                </Grid>
                            ))}
                        </Grid>
                    </GlassCard>
                </Grid>

                <Grid item xs={12} lg={4}>
                    <GlassCard sx={{ display: 'flex', flexDirection: 'column' }}>
                        <CardHeaderMUI title="Ask Tafiti AI (Your Research Companion)" />
                        <Box
                            sx={{
                                flex: 1,
                                minHeight: 280,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'flex-end',
                            }}
                        >
                            <ChatBubble side="right" userAvatar>
                                Summarize key papers on Carbon Sequestration for Project 1?
                            </ChatBubble>
                            <ChatBubble side="left">
                                <Box sx={{ '& > * + *': { mt: 1.5 } }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <AutoAwesomeIcon sx={{ fontSize: 16, color: '#c2410c' }} />
                                        <Typography variant="caption" sx={{ fontWeight: 800, color: '#c2410c', fontSize: '0.8125rem' }}>
                                            Summarizing findings...
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#1e293b' }}>
                                        5 key insights found.
                                    </Typography>
                                    <Box
                                        component="ol"
                                        sx={{
                                            m: 0,
                                            pl: '1.25rem',
                                            '& > * + *': { mt: 0.75 },
                                            color: '#334155',
                                            pt: 0.5,
                                        }}
                                    >
                                        <li>
                                            <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                                Methodologies include…
                                            </Typography>{' '}
                                            investigating or isolation methods…
                                        </li>
                                        <li>
                                            <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                                Constraints: High costs…
                                            </Typography>{' '}
                                            and conservancy centers…
                                        </li>
                                    </Box>
                                    <Box sx={{ display: 'flex', gap: 1, pt: 1, flexWrap: 'wrap' }}>
                                        <Typography
                                            component="a"
                                            href="#"
                                            variant="caption"
                                            sx={{
                                                fontWeight: 900,
                                                color: '#2c5f9e',
                                                textDecoration: 'none',
                                                fontSize: '0.75rem',
                                                '&:hover': { textDecoration: 'underline' },
                                            }}
                                        >
                                            *View Summary
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#cbd5e1', fontSize: '0.75rem' }}>
                                            |
                                        </Typography>
                                        <Typography
                                            component="a"
                                            href="#"
                                            variant="caption"
                                            sx={{
                                                fontWeight: 900,
                                                color: '#2c5f9e',
                                                textDecoration: 'none',
                                                fontSize: '0.75rem',
                                                '&:hover': { textDecoration: 'underline' },
                                            }}
                                        >
                                            Generate Citations
                                        </Typography>
                                    </Box>
                                </Box>
                            </ChatBubble>
                        </Box>
                    </GlassCard>
                </Grid>

                <Grid item xs={12} lg={3}>
                    <GlassCard>
                        <CardHeaderMUI title="Trending Insights" />
                        <List sx={{ py: 0, mb: 2.5, '& .MuiListItem-root': { px: 0, py: 1.75 } }} disablePadding>
                            {insights.map((ins, i) => (
                                <ListItem key={i} disablePadding sx={{ cursor: 'pointer' }} component="div">
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                        <Box
                                            sx={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: '50%',
                                                bgcolor: '#2c5f9e',
                                                flexShrink: 0,
                                                mt: 1.5,
                                                transition: 'transform 0.2s',
                                                '&:hover': {
                                                    transform: 'scale(1.5)',
                                                },
                                            }}
                                        />
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontWeight: 500,
                                                color: '#334155',
                                                lineHeight: 1.5,
                                                transition: 'color 0.2s',
                                                '&:hover': {
                                                    color: '#2c5f9e',
                                                },
                                                fontSize: '0.875rem',
                                            }}
                                        >
                                            {ins}
                                        </Typography>
                                    </Box>
                                </ListItem>
                            ))}
                        </List>
                        <Divider sx={{ borderColor: '#f1f5f9' }} />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pt: 2, flexWrap: 'wrap' }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', fontSize: '0.6875rem' }}>
                                Keywords:
                            </Typography>
                            <Chip
                                label="AI"
                                size="small"
                                sx={{
                                    bgcolor: '#f1f5f9',
                                    color: '#475569',
                                    borderRadius: 2,
                                    fontWeight: 700,
                                    fontSize: '0.6875rem',
                                }}
                            />
                            <Chip
                                label="Sustainability"
                                size="small"
                                sx={{
                                    bgcolor: '#f1f5f9',
                                    color: '#475569',
                                    borderRadius: 2,
                                    fontWeight: 700,
                                    fontSize: '0.6875rem',
                                }}
                            />
                        </Box>
                    </GlassCard>
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                <Grid item xs={12} md={6} lg={3}>
                    <GlassCard>
                        <CardHeaderMUI title="Recent Activity" />
                        <List sx={{ py: 0 }} disablePadding>
                            {activity.map((a, i) => (
                                <ActivityItem key={i} {...a} />
                            ))}
                        </List>
                    </GlassCard>
                </Grid>

                <Grid item xs={12} md={6} lg={3}>
                    <GlassCard>
                        <CardHeaderMUI title="Task List" />
                        <Stack spacing={0.5}>
                            {tasks.map((t, i) => (
                                <TaskItem key={i} {...t} />
                            ))}
                        </Stack>
                    </GlassCard>
                </Grid>

                <Grid item xs={12} md={6} lg={3}>
                    <GlassCard>
                        <CardHeaderMUI title="AI Insights Feed" />
                        <BarChartMUI />
                    </GlassCard>
                </Grid>

                <Grid item xs={12} md={6} lg={3}>
                    <GlassCard>
                        <CardHeaderMUI title="Research Tools" />
                        <Stack spacing={2}>
                            <ToolCard
                                title="Literature Review Helper"
                                subtitle="Literature Review Helper"
                                color="blue"
                                icon={BookOpenCheck}
                            />
                            <ToolCard
                                title="Data Analysis"
                                subtitle="Literature review Analysis"
                                color="peach"
                                icon={PieChart}
                            />
                            <ToolCard
                                title="Writing Assistant"
                                subtitle="Creating writing assistant"
                                color="mint"
                                icon={PenLine}
                            />
                        </Stack>
                    </GlassCard>
                </Grid>
            </Grid>
        </Box>
    );
};

export default DashboardHome;

