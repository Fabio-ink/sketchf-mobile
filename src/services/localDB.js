import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_CACHED_PHOTO_ITEMS = 5;

const KEYS = {
  PROJECTS: '@localdb_projects',
  ITEMS: (projectId) => `@localdb_items_${projectId}`,
  PHOTOS: (itemId) => `@localdb_photos_${itemId}`,
  SYNC_QUEUE: '@localdb_sync_queue',
  RECENT_PHOTO_ITEMS: '@localdb_recent_photo_items',
};

const generateId = () => `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

const read = async (key) => {
  try {
    const json = await AsyncStorage.getItem(key);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    return null;
  }
};

const write = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
  }
};

export const addToSyncQueue = async (operation) => {
  const queue = (await read(KEYS.SYNC_QUEUE)) || [];
  queue.push({ ...operation, id: generateId(), createdAt: new Date().toISOString() });
  await write(KEYS.SYNC_QUEUE, queue);
};

export const getSyncQueue = async () => (await read(KEYS.SYNC_QUEUE)) || [];

export const removeSyncItem = async (itemId) => {
  const queue = (await read(KEYS.SYNC_QUEUE)) || [];
  await write(KEYS.SYNC_QUEUE, queue.filter(q => q.id !== itemId));
};

export const clearSyncQueue = async () => {
  await write(KEYS.SYNC_QUEUE, []);
};

export const getProjects = async () => {
  return (await read(KEYS.PROJECTS)) || [];
};

export const setProjects = async (projects) => {
  await write(KEYS.PROJECTS, projects);
};

export const createProject = async (data, skipSync = false) => {
  const projects = await getProjects();
  const newProject = {
    id: generateId(),
    name: data.name,
    client_name: data.client_name || '',
    address: data.address || '',
    items_count: 0,
    _isLocal: true,
    created_at: new Date().toISOString(),
  };
  projects.unshift(newProject);
  await write(KEYS.PROJECTS, projects);
  if (!skipSync) {
    await addToSyncQueue({ type: 'CREATE', entity: 'project', localId: newProject.id, data });
  }
  return newProject;
};

export const updateProject = async (id, data) => {
  const projects = await getProjects();
  const exists = projects.some(p => p.id === id || p.id.toString() === id.toString());
  let project;
  
  if (exists) {
    const updated = projects.map(p => p.id === id || p.id.toString() === id.toString()
      ? { ...p, ...data }
      : p
    );
    await write(KEYS.PROJECTS, updated);
    project = updated.find(p => p.id === id || p.id.toString() === id.toString());
  } else {
    project = { id, ...data, _serverId: id };
  }
  
  const serverId = project?._serverId || (String(id).startsWith('local_') ? null : id);
  await addToSyncQueue({ type: 'UPDATE', entity: 'project', localId: id, serverId, data });
  return project;
};

export const deleteProject = async (id) => {
  const projects = await getProjects();
  const project = projects.find(p => p.id === id || p.id.toString() === id.toString());
  await write(KEYS.PROJECTS, projects.filter(p => p.id !== id && p.id.toString() !== id.toString()));
  if (project?._serverId) {
    await addToSyncQueue({ type: 'DELETE', entity: 'project', localId: id, serverId: project._serverId });
  }
};

export const getItems = async (projectId) => {
  return (await read(KEYS.ITEMS(projectId))) || [];
};

export const setItems = async (projectId, items) => {
  await write(KEYS.ITEMS(projectId), items);
};

export const createItem = async (projectId, data, skipSync = false) => {
  const items = await getItems(projectId);
  const newItem = {
    id: generateId(),
    name: data.name,
    project_id: projectId,
    photos_count: 0,
    _isLocal: true,
    created_at: new Date().toISOString(),
  };
  items.unshift(newItem);
  await write(KEYS.ITEMS(projectId), items);
  if (!skipSync) {
    await addToSyncQueue({ type: 'CREATE', entity: 'item', localId: newItem.id, projectLocalId: projectId, data: { ...data, project_id: projectId } });
  }
  const projects = await getProjects();
  await write(KEYS.PROJECTS, projects.map(p =>
    p.id === projectId || p.id.toString() === projectId.toString()
      ? { ...p, items_count: (p.items_count || 0) + 1 }
      : p
  ));
  return newItem;
};

export const updateItem = async (projectId, itemId, data) => {
  const items = await getItems(projectId);
  const exists = items.some(i => i.id === itemId || i.id.toString() === itemId.toString());
  let item;
  
  if (exists) {
    const updated = items.map(i => i.id === itemId || i.id.toString() === itemId.toString()
      ? { ...i, ...data }
      : i
    );
    await write(KEYS.ITEMS(projectId), updated);
    item = updated.find(i => i.id === itemId || i.id.toString() === itemId.toString());
  } else {
    item = { id: itemId, project_id: projectId, ...data, _serverId: itemId };
  }
  
  const serverId = item?._serverId || (String(itemId).startsWith('local_') ? null : itemId);
  await addToSyncQueue({ type: 'UPDATE', entity: 'item', localId: itemId, serverId, data });
  return item;
};

export const deleteItem = async (projectId, itemId) => {
  const items = await getItems(projectId);
  const item = items.find(i => i.id === itemId || i.id.toString() === itemId.toString());
  await write(KEYS.ITEMS(projectId), items.filter(i => i.id !== itemId && i.id.toString() !== itemId.toString()));
  if (item?._serverId) {
    await addToSyncQueue({ type: 'DELETE', entity: 'item', localId: itemId, serverId: item._serverId });
  }
  const projects = await getProjects();
  await write(KEYS.PROJECTS, projects.map(p =>
    p.id === projectId || p.id.toString() === projectId.toString()
      ? { ...p, items_count: Math.max(0, (p.items_count || 1) - 1) }
      : p
  ));
};

export const getPhotos = async (itemId) => {
  return (await read(KEYS.PHOTOS(itemId))) || [];
};

export const setPhotos = async (itemId, photos) => {
  await write(KEYS.PHOTOS(itemId), photos);
};

export const createPhoto = async (itemId, data, skipSync = false) => {
  const photos = await getPhotos(itemId);
  const newPhoto = {
    id: generateId(),
    item_id: itemId,
    image_url: data.localFileUri,
    markers: data.markers || [],
    _isLocal: true,
    _localFileUri: data.localFileUri,
    created_at: new Date().toISOString(),
  };
  photos.unshift(newPhoto);
  await write(KEYS.PHOTOS(itemId), photos);
  if (!skipSync) {
    await addToSyncQueue({
      type: 'CREATE', entity: 'photo', localId: newPhoto.id, itemLocalId: itemId,
      data: { localFileUri: data.localFileUri, markers: data.markers, item_id: itemId }
    });
  }
  const projects = await getProjects();
  for (const proj of projects) {
    const items = await getItems(proj.id);
    const updated = items.map(i =>
      i.id === itemId || i.id.toString() === itemId.toString()
        ? { ...i, photos_count: (i.photos_count || 0) + 1 }
        : i
    );
    if (JSON.stringify(items) !== JSON.stringify(updated)) {
      await write(KEYS.ITEMS(proj.id), updated);
    }
  }
  return newPhoto;
};

export const deletePhoto = async (itemId, photoId) => {
  const photos = await getPhotos(itemId);
  const photo = photos.find(p => p.id === photoId || p.id.toString() === photoId.toString());
  await write(KEYS.PHOTOS(itemId), photos.filter(p => p.id !== photoId && p.id.toString() !== photoId.toString()));
  if (photo?._serverId) {
    await addToSyncQueue({ type: 'DELETE', entity: 'photo', localId: photoId, serverId: photo._serverId });
  }
};

export const updatePhotoMarkers = async (itemId, photoId, markers) => {
  const photos = await getPhotos(itemId);
  const exists = photos.some(p => p.id === photoId || p.id.toString() === photoId.toString());
  let photo;
  let updatedPhotos = photos;
  
  if (exists) {
    updatedPhotos = photos.map(p => {
      if (p.id === photoId || p.id.toString() === photoId.toString()) {
        return { ...p, markers };
      }
      return p;
    });
    await write(KEYS.PHOTOS(itemId), updatedPhotos);
    photo = updatedPhotos.find(p => p.id === photoId || p.id.toString() === photoId.toString());
  } else {
    photo = { id: photoId, item_id: itemId, markers, _serverId: photoId };
  }

  if (!photo) return null;

  const serverId = photo?._serverId || (String(photoId).startsWith('local_') ? null : photoId);

  if (serverId) {
    await addToSyncQueue({
      type: 'UPDATE',
      entity: 'photo',
      localId: photoId,
      serverId,
      data: { markers }
    });
  } else {
    const queue = (await read(KEYS.SYNC_QUEUE)) || [];
    const updatedQueue = queue.map(op => {
      if (op.type === 'CREATE' && op.entity === 'photo' && (op.localId === photoId || op.localId.toString() === photoId.toString())) {
        return {
          ...op,
          data: {
            ...op.data,
            markers
          }
        };
      }
      return op;
    });
    await write(KEYS.SYNC_QUEUE, updatedQueue);
  }

  return photo;
};

const trackPhotoCacheItem = async (itemId) => {
  try {
    const id = itemId.toString();
    const raw = await AsyncStorage.getItem(KEYS.RECENT_PHOTO_ITEMS);
    let recent = raw ? JSON.parse(raw) : [];

    recent = [id, ...recent.filter(r => r !== id)];

    const toEvict = recent.slice(MAX_CACHED_PHOTO_ITEMS);
    recent = recent.slice(0, MAX_CACHED_PHOTO_ITEMS);

    await AsyncStorage.setItem(KEYS.RECENT_PHOTO_ITEMS, JSON.stringify(recent));

    for (const evictedId of toEvict) {
      const photosKey = KEYS.PHOTOS(evictedId);
      const photosRaw = await AsyncStorage.getItem(photosKey);
      if (photosRaw) {
        const photos = JSON.parse(photosRaw);
        const localOnly = photos.filter(p => p._isLocal);
        if (localOnly.length === 0) {
          await AsyncStorage.removeItem(photosKey);
        } else {
          await AsyncStorage.setItem(photosKey, JSON.stringify(localOnly));
        }
      }
    }
  } catch (e) {
  }
};

export const mergeServerProjects = async (serverProjects) => {
  const localProjects = await getProjects();
  const localOnlyItems = localProjects.filter(p => p._isLocal);
  const serverMapped = serverProjects.map(sp => ({ ...sp, _serverId: sp.id, _isLocal: false }));
  const merged = [...localOnlyItems, ...serverMapped];
  await write(KEYS.PROJECTS, merged);
  return merged;
};

export const mergeServerItems = async (projectId, serverItems) => {
  const localItems = await getItems(projectId);
  const localOnlyItems = localItems.filter(i => i._isLocal);
  const serverMapped = serverItems.map(si => ({ ...si, _serverId: si.id, _isLocal: false }));
  const merged = [...localOnlyItems, ...serverMapped];
  await write(KEYS.ITEMS(projectId), merged);
  return merged;
};

export const mergeServerPhotos = async (itemId, serverPhotos) => {
  const localPhotos = await getPhotos(itemId);
  const queue = await getSyncQueue();
  const pendingUpdates = queue
    .filter(op => op.entity === 'photo' && op.type === 'UPDATE')
    .map(op => op.localId.toString());

  const localOnlyPhotos = localPhotos.filter(p => p._isLocal);

  const serverMapped = serverPhotos.map(sp => {
    const localPhoto = localPhotos.find(p => p.id.toString() === sp.id.toString());
    if (localPhoto && pendingUpdates.includes(sp.id.toString())) {
      return { ...sp, _serverId: sp.id, markers: localPhoto.markers, _isLocal: false };
    }
    return { ...sp, _serverId: sp.id, _isLocal: false };
  });

  const merged = [...localOnlyPhotos, ...serverMapped];

  await trackPhotoCacheItem(itemId);
  await write(KEYS.PHOTOS(itemId), merged);
  return merged;
};
