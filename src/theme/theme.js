import { DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#212B36',
    accent: '#00A76F',
    background: '#F9FAFB',
    surface: '#FFFFFF',
    text: '#212B36',
    error: '#FF5630',
    placeholder: '#919EAB',
    backdrop: 'rgba(33, 43, 54, 0.4)',
    notification: '#FFAB00',
    card: '#FFFFFF',
    border: '#919EAB33',
  },
  roundness: 8,
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
    h1: { fontSize: 24, fontWeight: '700', color: '#212B36' },
    h2: { fontSize: 20, fontWeight: '700', color: '#212B36' },
    subtitle: { fontSize: 16, fontWeight: '600', color: '#637381' },
    body: { fontSize: 14, fontWeight: '400', color: '#212B36' },
    caption: { fontSize: 12, fontWeight: '400', color: '#919EAB' },
  },
  shadows: {
    light: {
      shadowColor: '#919EAB',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 2,
    },
  },
};
