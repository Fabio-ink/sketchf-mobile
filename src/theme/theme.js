import { DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#161D64',      
    secondary: '#5A609B',    
    accent: '#161D64',       
    background: '#F8F9FD',   
    surface: '#FFFFFF',
    text: '#1E2229',
    error: '#E53935',
    placeholder: '#979797',
    backdrop: 'rgba(22, 29, 100, 0.4)',
    notification: '#FFB300',
    card: '#FFFFFF',
    border: '#E8EBF2',

    statusInProg: '#E8F0FE',
    statusInProgText: '#1A73E8',
    statusPending: '#FEF3D6',
    statusPendingText: '#B06000',
    statusCompleted: '#E6F4EA',
    statusCompletedText: '#137333',
  },
  roundness: 12,
};

export const tokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    h1: { fontSize: 26, fontWeight: '800', color: '#161D64', letterSpacing: -0.5 },
    h2: { fontSize: 20, fontWeight: '700', color: '#1E2229' },
    h3: { fontSize: 16, fontWeight: '600', color: '#1E2229' },
    subtitle: { fontSize: 15, fontWeight: '500', color: '#5A609B' },
    body: { fontSize: 14, fontWeight: '400', color: '#2C3E50', lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '400', color: '#979797' },
    badge: { fontSize: 11, fontWeight: '700' },
  },
  shadows: {
    light: {
      shadowColor: '#161D64',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
    medium: {
      shadowColor: '#161D64',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    },
  },
};
