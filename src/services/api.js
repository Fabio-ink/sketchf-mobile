import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStoredBackendUrl } from './networkScanner';

const api = axios.create({
  timeout: 3000
});

api.interceptors.request.use(async (config) => {
  if (!config.baseURL) {
    const storedUrl = await getStoredBackendUrl();
    if (storedUrl) {
      config.baseURL = storedUrl;
    } else {
      const err = new Error('Backend URL not found. Network scanner has not finished or backend is offline.');
      err.config = config;
      return Promise.reject(err);
    }
  }

  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers['Bypass-Tunnel-Reminder'] = 'true';

  return config;
});

export default api;
