import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSyncQueue, removeSyncItem } from './localDB';

const KEYS = {
  CLIENTS: '@localdb_clients',
  VISITS: '@localdb_visits',
  PHOTOS: (visitId) => `@localdb_photos_${visitId}`,
};

let isSyncing = false;

export const syncToServer = async (api) => {
  if (isSyncing) {
    return;
  }
  isSyncing = true;

  try {
    const queue = await getSyncQueue();
    if (queue.length === 0) {
      return;
    }

    const idMap = {};

    for (const op of queue) {
      try {
        let success = false;

        if (op.type === 'CREATE' && op.entity === 'client') {
          const res = await api.post('/clients', op.data);
          if (res.data?.id) {
            const serverId = res.data.id;
            const localId = op.localId;
            idMap[localId] = serverId;

            const clients = JSON.parse(await AsyncStorage.getItem(KEYS.CLIENTS) || '[]');
            const updated = clients.map(c => 
              c.id === localId ? { ...c, id: serverId, _serverId: serverId, _isLocal: false } : c
            );
            await AsyncStorage.setItem(KEYS.CLIENTS, JSON.stringify(updated));

            const visitsJson = await AsyncStorage.getItem(KEYS.VISITS);
            if (visitsJson) {
              const visits = JSON.parse(visitsJson);
              const updatedVisits = visits.map(v => 
                v.client_id === localId ? { ...v, client_id: serverId } : v
              );
              await AsyncStorage.setItem(KEYS.VISITS, JSON.stringify(updatedVisits));
            }

            success = true;
          }
        }

        else if (op.type === 'UPDATE' && op.entity === 'client') {
          const serverId = idMap[op.localId] || op.serverId;
          if (serverId) {
            await api.put(`/clients/${serverId}`, op.data);
            success = true;
          }
        }

        else if (op.type === 'DELETE' && op.entity === 'client') {
          const serverId = idMap[op.localId] || op.serverId;
          if (serverId) {
            await api.delete(`/clients/${serverId}`);
            success = true;
          }
        }

        else if (op.type === 'CREATE' && op.entity === 'visit') {
          let clientServerId = idMap[op.clientLocalId] || op.data.client_id;
          if (typeof clientServerId === 'string' && clientServerId.startsWith('local_')) {

            continue;
          }

          const res = await api.post('/visits', { ...op.data, client_id: clientServerId });
          if (res.data?.id) {
            const serverId = res.data.id;
            const localId = op.localId;
            idMap[localId] = serverId;

            const visits = JSON.parse(await AsyncStorage.getItem(KEYS.VISITS) || '[]');
            const updated = visits.map(v => 
              v.id === localId ? { ...v, id: serverId, _serverId: serverId, _isLocal: false, client_id: clientServerId } : v
            );
            await AsyncStorage.setItem(KEYS.VISITS, JSON.stringify(updated));

            const oldPhotosKey = KEYS.PHOTOS(localId);
            const newPhotosKey = KEYS.PHOTOS(serverId);
            const photosJson = await AsyncStorage.getItem(oldPhotosKey);
            if (photosJson) {
              const photos = JSON.parse(photosJson);
              const updatedPhotos = photos.map(p => ({ ...p, visit_id: serverId }));
              await AsyncStorage.setItem(newPhotosKey, JSON.stringify(updatedPhotos));
              await AsyncStorage.removeItem(oldPhotosKey);
            }

            success = true;
          }
        }

        else if (op.type === 'UPDATE' && op.entity === 'visit') {
          const serverId = idMap[op.localId] || op.serverId;
          if (serverId) {
            await api.put(`/visits/${serverId}`, op.data);
            success = true;
          }
        }

        else if (op.type === 'DELETE' && op.entity === 'visit') {
          const serverId = idMap[op.localId] || op.serverId;
          if (serverId) {
            await api.delete(`/visits/${serverId}`);
            success = true;
          }
        }

        else if (op.type === 'CREATE' && op.entity === 'photo') {
          let visitServerId = idMap[op.visitLocalId] || op.data.visit_id;
          if (typeof visitServerId === 'string' && visitServerId.startsWith('local_')) {

            continue;
          }

          const formData = new FormData();
          formData.append('photo', {
            uri: op.data.localFileUri,
            type: 'image/jpeg',
            name: 'photo.jpg',
          });
          formData.append('visit_id', visitServerId);
          if (op.data.markers) formData.append('markers', JSON.stringify(op.data.markers));
          if (op.data.observations) formData.append('observations', JSON.stringify(op.data.observations));

          const res = await api.post('/photos', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          if (res.data?.id) {
            const serverId = res.data.id;
            const localId = op.localId;
            idMap[localId] = serverId;

            const photosKey = KEYS.PHOTOS(visitServerId);
            const photos = JSON.parse(await AsyncStorage.getItem(photosKey) || '[]');
            const updated = photos.map(p => 
              p.id === localId ? { ...p, id: serverId, _serverId: serverId, _isLocal: false } : p
            );
            await AsyncStorage.setItem(photosKey, JSON.stringify(updated));

            try {
              const { removeImage } = require('./imageStorage');
              await removeImage(op.data.localFileUri);
            } catch (err) {}

            success = true;
          }
        }

        else if (op.type === 'UPDATE' && op.entity === 'photo') {
          const serverId = idMap[op.localId] || op.serverId;
          if (serverId) {
            await api.put(`/photos/${serverId}`, op.data);
            success = true;
          }
        }

        else if (op.type === 'DELETE' && op.entity === 'photo') {
          const serverId = idMap[op.localId] || op.serverId;
          if (serverId) {
            await api.delete(`/photos/${serverId}`);
            success = true;
          }
        }

        if (success) {
          await removeSyncItem(op.id);
        }
      } catch (error) {
        console.log('[SyncService] Operation sync error:', error);
      }
    }
  } finally {
    isSyncing = false;
  }
};
