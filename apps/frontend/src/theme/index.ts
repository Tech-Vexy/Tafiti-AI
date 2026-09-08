'use client';

import { createTheme } from '@mui/material/styles';

const tafitiPalette = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#2c5f9e',
    600: '#234e82',
    700: '#1e436f',
    800: '#1e3a5f',
    900: '#1e304f',
    main: '#2c5f9e',
    light: '#3d7ac2',
    dark: '#1e436f',
    contrastText: '#ffffff',
  },
  mint: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#e6f4f1',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
    main: '#14b8a6',
    light: '#5eead4',
    dark: '#0f766e',
    contrastText: '#042f2e',
  },
  peach: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fff1e0',
    300: '#fdba74',
    400: '#fb923c',
    500: '#fb923c',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
    main: '#fb923c',
    light: '#fdba74',
    dark: '#c2410c',
    contrastText: '#431407',
  },
};

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: tafitiPalette.primary,
    secondary: tafitiPalette.mint,
    error: {
      main: '#dc2626',
      light: '#ef4444',
      dark: '#991b1b',
    },
    warning: tafitiPalette.peach,
    info: {
      main: '#0284c7',
      light: '#38bdf8',
      dark: '#075985',
    },
    success: tafitiPalette.mint,
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      disabled: '#94a3b8',
    },
    divider: 'rgba(15, 23, 42, 0.06)',
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 900,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontWeight: 800,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
    },
    body1: {
      fontSize: '0.9375rem',
    },
    body2: {
      fontSize: '0.875rem',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 20px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(44, 95, 158, 0.15)',
          },
        },
        contained: {
          backgroundColor: tafitiPalette.primary.main,
          '&:hover': {
            backgroundColor: tafitiPalette.primary.light,
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: tafitiPalette.primary.main,
          boxShadow: '0 4px 20px rgba(44, 95, 158, 0.15)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid rgba(15, 23, 42, 0.04)',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 24,
          '&:last-child': {
            paddingBottom: 24,
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: '2px 8px',
          '&.Mui-selected': {
            backgroundColor: tafitiPalette.primary.main,
            color: '#ffffff',
            '&:hover': {
              backgroundColor: tafitiPalette.primary.light,
            },
          },
          '&:hover': {
            backgroundColor: '#f1f5f9',
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 40,
          color: 'inherit',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& fieldset': {
              borderWidth: '2px',
            },
            '&:hover fieldset': {
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          height: 8,
        },
        bar: {
          borderRadius: 999,
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        standard: {
          minWidth: 18,
          height: 18,
          fontSize: '0.65rem',
          fontWeight: 800,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        },
        elevation2: {
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: tafitiPalette.primary,
    secondary: tafitiPalette.mint,
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    warning: tafitiPalette.peach,
    info: {
      main: '#38bdf8',
      light: '#7dd3fc',
      dark: '#0ea5e9',
    },
    success: tafitiPalette.mint,
    background: {
      default: '#030305',
      paper: '#0a0a0f',
    },
    text: {
      primary: '#ffffff',
      secondary: '#94a3b8',
      disabled: '#475569',
    },
    divider: 'rgba(255, 255, 255, 0.05)',
  },
  shape: {
    borderRadius: 12,
  },
  typography: lightTheme.typography,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 20px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(44, 95, 158, 0.3)',
          },
        },
        contained: {
          backgroundColor: tafitiPalette.primary.main,
          '&:hover': {
            backgroundColor: tafitiPalette.primary.light,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: tafitiPalette.primary.main,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
          backgroundColor: '#0a0a0f',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#060609',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: '2px 8px',
          '&.Mui-selected': {
            backgroundColor: tafitiPalette.primary.main,
            color: '#ffffff',
            '&:hover': {
              backgroundColor: tafitiPalette.primary.light,
            },
          },
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export const getDesignTokens = (mode: 'light' | 'dark') =>
  mode === 'light' ? lightTheme : darkTheme;

export default lightTheme;
