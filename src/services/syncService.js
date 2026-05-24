import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSyncQueue, removeSyncItem,
  getProjects, write, setProjects,
  getItems, setItems, getPhotos, setPhotos
} from './localDB';

const KEYS = {
  PROJECTS: '@localdb_projects',
  ITEMS: (projectId) => `@localdb_items_${projectId}`,
  PHOTOS: (itemId) => `@localdb_photos_${itemId}`,
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

        if (op.type === 'CREATE' && op.entity === 'project') {
          const res = await api.post('/projects', op.data);
          if (res.data?.id) {
            const serverId = res.data.id;
            const localId = op.localId;
            idMap[localId] = serverId;

            const projects = JSON.parse(await AsyncStorage.getItem(KEYS.PROJECTS) || '[]');
            const updated = projects.filter(p => p.id !== localId);
            await AsyncStorage.setItem(KEYS.PROJECTS, JSON.stringify(updated));

            const oldItemsKey = KEYS.ITEMS(localId);
            const newItemsKey = KEYS.ITEMS(serverId);
            const itemsJson = await AsyncStorage.getItem(oldItemsKey);
            if (itemsJson) {
              const items = JSON.parse(itemsJson);
              const updatedItems = items.map(i => ({ ...i, project_id: serverId }));
              await AsyncStorage.setItem(newItemsKey, JSON.stringify(updatedItems));
              await AsyncStorage.removeItem(oldItemsKey);
            }

            success = true;
          }
        }

        else if (op.type === 'UPDATE' && op.entity === 'project') {
          const serverId = idMap[op.localId] || op.serverId;
          if (serverId) {
            await api.put(`/projects/${serverId}`, op.data);
            success = true;
          }
        }

        else if (op.type === 'DELETE' && op.entity === 'project') {
          const serverId = idMap[op.localId] || op.serverId;
          if (serverId) {
            await api.delete(`/projects/${serverId}`);
            success = true;
          }
        }

        else if (op.type === 'CREATE' && op.entity === 'item') {
          let projectServerId = idMap[op.projectLocalId] || op.data.project_id;
          if (typeof projectServerId === 'string' && projectServerId.startsWith('local_')) {
            continue;
          }
          const res = await api.post('/items', { ...op.data, project_id: projectServerId });
          if (res.data?.id) {
            const serverId = res.data.id;
            const localId = op.localId;
            idMap[localId] = serverId;

            const itemsKey = KEYS.ITEMS(projectServerId);
            const items = JSON.parse(await AsyncStorage.getItem(itemsKey) || '[]');
            const updated = items.filter(i => i.id !== localId);
            await AsyncStorage.setItem(itemsKey, JSON.stringify(updated));

            const oldPhotosKey = KEYS.PHOTOS(localId);
            const newPhotosKey = KEYS.PHOTOS(serverId);
            const photosJson = await AsyncStorage.getItem(oldPhotosKey);
            if (photosJson) {
              const photos = JSON.parse(photosJson);
              const updatedPhotos = photos.map(p => ({ ...p, item_id: serverId }));
              await AsyncStorage.setItem(newPhotosKey, JSON.stringify(updatedPhotos));
              await AsyncStorage.removeItem(oldPhotosKey);
            }

            success = true;
          }
        }

        else if (op.type === 'DELETE' && op.entity === 'item') {
          const serverId = idMap[op.localId] || op.serverId;
          if (serverId) {
            await api.delete(`/items/${serverId}`);
            success = true;
          }
        }

        else if (op.type === 'CREATE' && op.entity === 'photo') {
          let itemServerId = idMap[op.itemLocalId] || op.data.item_id;
          if (typeof itemServerId === 'string' && itemServerId.startsWith('local_')) {
            continue;
          }
          const formData = new FormData();
          formData.append('photo', {
            uri: op.data.localFileUri,
            type: 'image/jpeg',
            name: 'photo.jpg',
          });
          formData.append('item_id', itemServerId);
          if (op.data.markers) formData.append('markers', JSON.stringify(op.data.markers));
          
          const res = await api.post('/photos', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          if (res.data?.id) {
            const serverId = res.data.id;
            const localId = op.localId;
            idMap[localId] = serverId;

            const photosKey = KEYS.PHOTOS(itemServerId);
            const photos = JSON.parse(await AsyncStorage.getItem(photosKey) || '[]');
            const updated = photos.filter(p => p.id !== localId);
            await AsyncStorage.setItem(photosKey, JSON.stringify(updated));
            
            try {
              const { removeImage } = require('./imageStorage');
              await removeImage(op.data.localFileUri);
            } catch (err) {
            }

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
      }
    }
  } finally {
    isSyncing = false;
  }
};
