import * as Network from 'expo-network';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

const PORT = 3000;
const TIMEOUT = 2000;

let isScanning = false;

export const scanForBackend = async () => {
  if (isScanning) return null;
  
  if (Platform.OS === 'web') {
    const webUrl = `http://localhost:${PORT}/api`;
    await AsyncStorage.setItem('backend_url', webUrl);
    return webUrl;
  }

  isScanning = true;

  try {
    let ip = null;
    const netState = await NetInfo.fetch();
    
    if (netState.type === 'wifi' && netState.details && netState.details.ipAddress) {
      ip = netState.details.ipAddress;
    } else {
      ip = await Network.getIpAddressAsync();
    }

    if (!ip || ip === '0.0.0.0') {
      isScanning = false;
      return null;
    }

    const parts = ip.split('.');
    if (parts.length !== 4) {
      isScanning = false;
      return null;
    }
    const base = `${parts[0]}.${parts[1]}.${parts[2]}`;

    let devIp = null;
    try {
      const scriptURL = NativeModules.SourceCode?.scriptURL;
      if (scriptURL) {
        const ipMatch = scriptURL.match(/http:\/\/([0-9\.]+):/);
        if (ipMatch) {
          devIp = ipMatch[1];
          const devUrl = `http://${devIp}:${PORT}`;
          const res = await axios.get(devUrl, { timeout: TIMEOUT });
          if (res.data && res.data.message === 'SketchF API is running') {
            const finalUrl = devUrl + '/api';
            await AsyncStorage.setItem('backend_url', finalUrl);
            isScanning = false;
            return finalUrl;
          }
        }
      }
    } catch (e) {
    }

    const pingPromises = [];
    
    for (let i = 1; i <= 254; i++) {
      const targetIp = `${base}.${i}`;
      const targetUrl = `http://${targetIp}:${PORT}`;
      
      const ping = axios.get(targetUrl, { timeout: TIMEOUT })
        .then(response => {
          if (response.data && response.data.message === 'SketchF API is running') {
            return targetUrl + '/api';
          }
          throw new Error('Not backend');
        })
        .catch(() => {
          throw new Error('Not found');
        });
        
      pingPromises.push(ping);
    }
    
    try {
      const foundUrl = await Promise.any(pingPromises);
      await AsyncStorage.setItem('backend_url', foundUrl);
      isScanning = false;
      return foundUrl;
    } catch (aggregateError) {
      const cloudUrl = 'https://sketchf-backend.onrender.com/api';
      await AsyncStorage.setItem('backend_url', cloudUrl);
      isScanning = false;
      return cloudUrl;
    }
  } catch (error) {
    isScanning = false;
    return null;
  }
};

export const getStoredBackendUrl = async () => {
  return await AsyncStorage.getItem('backend_url');
};
