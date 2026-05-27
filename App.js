import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, Platform, View, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { CustomAlertProvider, CustomAlert } from './src/components/CustomAlert';

// Override native Alert.alert globally with our custom styled version
const originalAlert = Alert.alert;
Alert.alert = (title, message, buttons, options) => {
  if (CustomAlert.isReady()) {
    CustomAlert.alert(title, message, buttons, options);
  } else {
    originalAlert(title, message, buttons, options);
  }
};
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider, IconButton } from 'react-native-paper';
import NetInfo from '@react-native-community/netinfo';
import { theme } from './src/theme/theme';

import { scanForBackend } from './src/services/networkScanner';
import { syncToServer } from './src/services/syncService';
import api from './src/services/api';
import * as NavigationBar from 'expo-navigation-bar';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import VisitsScreen from './src/screens/VisitsScreen';
import ClientsScreen from './src/screens/ClientsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ClientDetailsScreen from './src/screens/ClientDetailsScreen';
import NewVisitScreen from './src/screens/NewVisitScreen';
import MeasurementScreen from './src/screens/MeasurementScreen';
import PhotoObservationsScreen from './src/screens/PhotoObservationsScreen';
import VisitDetailsScreen from './src/screens/VisitDetailsScreen';
import ExportReportScreen from './src/screens/ExportReportScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Inicio') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'VisitasTab') {
            iconName = focused ? 'calendar-check' : 'calendar-check-outline';
          } else if (route.name === 'ClientesTab') {
            iconName = focused ? 'account-group' : 'account-group-outline';
          } else if (route.name === 'MaisTab') {
            iconName = focused ? 'dots-horizontal' : 'dots-horizontal';
          }
          return <IconButton icon={iconName} size={focused ? size + 2 : size} iconColor={color} style={{ margin: 0 }} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.placeholder,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
          elevation: 8,
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Inicio" 
        component={DashboardScreen} 
        options={{ tabBarLabel: 'Início' }} 
      />
      <Tab.Screen 
        name="VisitasTab" 
        component={VisitsScreen} 
        options={{ tabBarLabel: 'Visitas' }} 
      />
      <Tab.Screen 
        name="NewVisitDummy" 
        component={View}
        options={{
          tabBarLabel: '',
          tabBarIcon: () => (
            <IconButton 
              icon="plus-circle" 
              iconColor={theme.colors.primary} 
              size={54} 
              style={{ marginTop: -24 }} 
            />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('NewVisitFlow');
          },
        })}
      />
      <Tab.Screen 
        name="ClientesTab" 
        component={ClientsScreen} 
        options={{ tabBarLabel: 'Clientes' }} 
      />
      <Tab.Screen 
        name="MaisTab" 
        component={SettingsScreen} 
        options={{ tabBarLabel: 'Mais' }} 
      />
    </Tab.Navigator>
  );
}

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
        <CustomAlertProvider>
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
            component={MainTabNavigator} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="ClientDetails" 
            component={ClientDetailsScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="NewVisitFlow" 
            component={NewVisitScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="Measurement" 
            component={MeasurementScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="PhotoObservations" 
            component={PhotoObservationsScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="VisitDetails" 
            component={VisitDetailsScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="ExportReport" 
            component={ExportReportScreen} 
            options={{ headerShown: false }} 
          />
        </Stack.Navigator>
        </NavigationContainer>
        </CustomAlertProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
