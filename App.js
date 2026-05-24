import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import NetInfo from '@react-native-community/netinfo';
import { theme } from './src/theme/theme';

import { scanForBackend } from './src/services/networkScanner';
import { syncToServer } from './src/services/syncService';
import api from './src/services/api';
import * as NavigationBar from 'expo-navigation-bar';

import LoginScreen from './src/screens/LoginScreen';
import ProjectListScreen from './src/screens/ProjectListScreen';
import ProjectDetailsScreen from './src/screens/ProjectDetailsScreen';
import FolderDetailsScreen from './src/screens/FolderDetailsScreen';
import MeasurementScreen from './src/screens/MeasurementScreen';
import AddProjectScreen from './src/screens/AddProjectScreen';

const Stack = createStackNavigator();

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      if (typeof NavigationBar.setVisibilityAsync === 'function') {
        NavigationBar.setVisibilityAsync("hidden").catch(() => {});
      }
      if (typeof NavigationBar.setBehaviorAsync === 'function') {
        NavigationBar.setBehaviorAsync("immersive").catch(() => {});
      }
    }

    let intervalId;

    const handleNetworkChange = async (state) => {
      if (state.isConnected) {
        await scanForBackend();
        try {
          await api.get('/wake');
        } catch (e) { }
        await syncToServer(api);
      }
    };

    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    intervalId = setInterval(async () => {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        await scanForBackend();
        try {
          await api.get('/wake');
        } catch (e) { }
        await syncToServer(api);
      }
    }, 180000);

    NetInfo.fetch().then(handleNetworkChange);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar hidden={true} />
        <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="Login"
          screenOptions={{
            headerStyle: {
              backgroundColor: theme.colors.surface,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            },
            headerTitleStyle: {
              fontWeight: '700',
              color: theme.colors.text,
            },
            cardStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Projects" 
            component={ProjectListScreen} 
            options={{ title: 'Meus Projetos' }} 
          />
          <Stack.Screen 
            name="ProjectDetails" 
            component={ProjectDetailsScreen} 
            options={{ title: 'Pastas do Projeto' }} 
          />
          <Stack.Screen 
            name="FolderDetails" 
            component={FolderDetailsScreen} 
            options={{ title: 'Fotos' }} 
          />
          <Stack.Screen 
            name="Measurement" 
            component={MeasurementScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="AddProject" 
            component={AddProjectScreen} 
            options={{ title: 'Novo Projeto' }} 
          />
        </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
