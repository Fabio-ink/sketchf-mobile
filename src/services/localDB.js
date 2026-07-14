import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_CACHED_PHOTO_ITEMS = 10;

const KEYS = {
  CLIENTS: '@localdb_clients',
  VISITS: '@localdb_visits',
  PHOTOS: (visitId) => `@localdb_photos_${visitId}`,
  SYNC_QUEUE: '@localdb_sync_queue',
  RECENT_PHOTO_VISITS: '@localdb_recent_photo_visits',
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

export const getClients = async () => {
  return (await read(KEYS.CLIENTS)) || [];
};

export const setClients = async (clients) => {
  await write(KEYS.CLIENTS, clients);
};

export const createClient = async (data, skipSync = false) => {
  const clients = await getClients();
  const newClient = {
    id: generateId(),
    name: data.name,
    phone: data.phone || '',
    address: data.address || '',
    visits_count: 0,
    _isLocal: true,
    created_at: new Date().toISOString(),
  };
  clients.unshift(newClient);
  await write(KEYS.CLIENTS, clients);
  if (!skipSync) {
    await addToSyncQueue({ type: 'CREATE', entity: 'client', localId: newClient.id, data });
  }
  return newClient;
};

export const updateClient = async (id, data) => {
  const clients = await getClients();
  const exists = clients.some(c => c.id === id || c.id.toString() === id.toString());
  let client;

  if (exists) {
    const updated = clients.map(c => c.id === id || c.id.toString() === id.toString()
      ? { ...c, ...data }
      : c
    );
    await write(KEYS.CLIENTS, updated);
    client = updated.find(c => c.id === id || c.id.toString() === id.toString());
  } else {
    client = { id, ...data, _serverId: id };
  }

  const serverId = client?._serverId || (String(id).startsWith('local_') ? null : id);
  await addToSyncQueue({ type: 'UPDATE', entity: 'client', localId: id, serverId, data });
  return client;
};

export const deleteClient = async (id) => {
  const clients = await getClients();
  const client = clients.find(c => c.id === id || c.id.toString() === id.toString());
  await write(KEYS.CLIENTS, clients.filter(c => c.id !== id && c.id.toString() !== id.toString()));
  if (client?._serverId) {
    await addToSyncQueue({ type: 'DELETE', entity: 'client', localId: id, serverId: client._serverId });
  }

  const visits = await getVisits();
  const visitsToDelete = visits.filter(v => v.client_id === id || v.client_id.toString() === id.toString());
  for (const visit of visitsToDelete) {
    await deleteVisit(visit.id);
  }
};

export const getVisits = async () => {
  return (await read(KEYS.VISITS)) || [];
};

export const setVisits = async (visits) => {
  await write(KEYS.VISITS, visits);
};

export const createVisit = async (data, skipSync = false) => {
  const visits = await getVisits();
  const newVisit = {
    id: generateId(),
    client_id: data.client_id,
    client_name: data.client_name || '',
    client_phone: data.client_phone || '',
    client_address: data.client_address || '',
    environment: data.environment,
    status: data.status || 'Em andamento',
    date: data.date || new Date().toISOString(),
    observations: data.observations || '',
    photos_count: 0,
    _isLocal: true,
    created_at: new Date().toISOString(),
  };
  visits.unshift(newVisit);
  await write(KEYS.VISITS, visits);

  if (!skipSync) {
    await addToSyncQueue({ 
      type: 'CREATE', 
      entity: 'visit', 
      localId: newVisit.id, 
      clientLocalId: data.client_id, 
      data: { 
        client_id: data.client_id, 
        environment: data.environment, 
        status: newVisit.status, 
        date: newVisit.date, 
        observations: newVisit.observations 
      } 
    });
  }

  const clients = await getClients();
  await write(KEYS.CLIENTS, clients.map(c =>
    c.id === data.client_id || c.id.toString() === data.client_id.toString()
      ? { ...c, visits_count: (c.visits_count || 0) + 1 }
      : c
  ));

  return newVisit;
};

export const updateVisit = async (id, data) => {
  const visits = await getVisits();
  const exists = visits.some(v => v.id === id || v.id.toString() === id.toString());
  let visit;

  if (exists) {
    const updated = visits.map(v => v.id === id || v.id.toString() === id.toString()
      ? { ...v, ...data }
      : v
    );
    await write(KEYS.VISITS, updated);
    visit = updated.find(v => v.id === id || v.id.toString() === id.toString());
  } else {
    visit = { id, ...data, _serverId: id };
  }

  const serverId = visit?._serverId || (String(id).startsWith('local_') ? null : id);
  await addToSyncQueue({ type: 'UPDATE', entity: 'visit', localId: id, serverId, data });
  return visit;
};

export const deleteVisit = async (id) => {
  const visits = await getVisits();
  const visit = visits.find(v => v.id === id || v.id.toString() === id.toString());
  await write(KEYS.VISITS, visits.filter(v => v.id !== id && v.id.toString() !== id.toString()));

  if (visit?._serverId) {
    await addToSyncQueue({ type: 'DELETE', entity: 'visit', localId: id, serverId: visit._serverId });
  }

  if (visit) {
    const clients = await getClients();
    await write(KEYS.CLIENTS, clients.map(c =>
      c.id === visit.client_id || c.id.toString() === visit.client_id.toString()
        ? { ...c, visits_count: Math.max(0, (c.visits_count || 1) - 1) }
        : c
    ));
  }

  await AsyncStorage.removeItem(KEYS.PHOTOS(id));
};

export const getPhotos = async (visitId) => {
  return (await read(KEYS.PHOTOS(visitId))) || [];
};

export const setPhotos = async (visitId, photos) => {
  await write(KEYS.PHOTOS(visitId), photos);
};

export const createPhoto = async (visitId, data, skipSync = false) => {
  const photos = await getPhotos(visitId);
  const newPhoto = {
    id: generateId(),
    visit_id: visitId,
    image_url: data.localFileUri,
    markers: data.markers || [],
    observations: data.observations || [],
    _isLocal: true,
    _localFileUri: data.localFileUri,
    created_at: new Date().toISOString(),
  };
  photos.unshift(newPhoto);
  await write(KEYS.PHOTOS(visitId), photos);

  if (!skipSync) {
    await addToSyncQueue({
      type: 'CREATE', 
      entity: 'photo', 
      localId: newPhoto.id, 
      visitLocalId: visitId,
      data: { localFileUri: data.localFileUri, markers: data.markers, observations: data.observations, visit_id: visitId }
    });
  }

  const visits = await getVisits();
  await write(KEYS.VISITS, visits.map(v =>
    v.id === visitId || v.id.toString() === visitId.toString()
      ? { ...v, photos_count: (v.photos_count || 0) + 1 }
      : v
  ));

  return newPhoto;
};

export const deletePhoto = async (visitId, photoId) => {
  const photos = await getPhotos(visitId);
  const photo = photos.find(p => p.id === photoId || p.id.toString() === photoId.toString());
  await write(KEYS.PHOTOS(visitId), photos.filter(p => p.id !== photoId && p.id.toString() !== photoId.toString()));

  if (photo?._serverId) {
    await addToSyncQueue({ type: 'DELETE', entity: 'photo', localId: photoId, serverId: photo._serverId });
  }

  const visits = await getVisits();
  await write(KEYS.VISITS, visits.map(v =>
    v.id === visitId || v.id.toString() === visitId.toString()
      ? { ...v, photos_count: Math.max(0, (v.photos_count || 1) - 1) }
      : v
  ));
};

export const updatePhotoMarkers = async (visitId, photoId, markers, observations) => {
  const photos = await getPhotos(visitId);
  const exists = photos.some(p => p.id === photoId || p.id.toString() === photoId.toString());
  let photo;
  let updatedPhotos = photos;

  if (exists) {
    updatedPhotos = photos.map(p => {
      if (p.id === photoId || p.id.toString() === photoId.toString()) {
        const updateData = {};
        if (markers !== undefined) updateData.markers = markers;
        if (observations !== undefined) updateData.observations = observations;
        return { ...p, ...updateData };
      }
      return p;
    });
    await write(KEYS.PHOTOS(visitId), updatedPhotos);
    photo = updatedPhotos.find(p => p.id === photoId || p.id.toString() === photoId.toString());
  } else {
    photo = { id: photoId, visit_id: visitId, markers: markers || [], observations: observations || [], _serverId: photoId };
  }

  if (!photo) return null;

  const serverId = photo?._serverId || (String(photoId).startsWith('local_') ? null : photoId);

  if (serverId) {
    const updatePayload = {};
    if (markers !== undefined) updatePayload.markers = markers;
    if (observations !== undefined) updatePayload.observations = observations;

    await addToSyncQueue({
      type: 'UPDATE',
      entity: 'photo',
      localId: photoId,
      serverId,
      data: updatePayload
    });
  } else {
    const queue = (await read(KEYS.SYNC_QUEUE)) || [];
    const updatedQueue = queue.map(op => {
      if (op.type === 'CREATE' && op.entity === 'photo' && (op.localId === photoId || op.localId.toString() === photoId.toString())) {
        const updatedData = { ...op.data };
        if (markers !== undefined) updatedData.markers = markers;
        if (observations !== undefined) updatedData.observations = observations;
        return {
          ...op,
          data: updatedData
        };
      }
      return op;
    });
    await write(KEYS.SYNC_QUEUE, updatedQueue);
  }

  return photo;
};

const trackPhotoCacheItem = async (visitId) => {
  try {
    const id = visitId.toString();
    const raw = await AsyncStorage.getItem(KEYS.RECENT_PHOTO_VISITS);
    let recent = raw ? JSON.parse(raw) : [];

    recent = [id, ...recent.filter(r => r !== id)];

    const toEvict = recent.slice(MAX_CACHED_PHOTO_ITEMS);
    recent = recent.slice(0, MAX_CACHED_PHOTO_ITEMS);

    await AsyncStorage.setItem(KEYS.RECENT_PHOTO_VISITS, JSON.stringify(recent));

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

export const mergeServerClients = async (serverClients) => {
  const localClients = await getClients();
  const localOnly = localClients.filter(c => c._isLocal);
  const serverMapped = serverClients.map(sc => ({ ...sc, _serverId: sc.id, _isLocal: false }));
  const merged = [...localOnly, ...serverMapped];
  await write(KEYS.CLIENTS, merged);
  return merged;
};

export const mergeServerVisits = async (serverVisits) => {
  const localVisits = await getVisits();
  const queue = await getSyncQueue();
  const pendingUpdates = queue
    .filter(op => op.entity === 'visit' && op.type === 'UPDATE')
    .map(op => op.localId.toString());

  const localOnly = localVisits.filter(v => v._isLocal);
  
  const serverMapped = serverVisits.map(sv => {
    const localVisit = localVisits.find(v => v.id.toString() === sv.id.toString());
    // Se a visita local possui modificações pendentes no sync queue, preserva os dados locais
    if (localVisit && pendingUpdates.includes(sv.id.toString())) {
      return { 
        ...sv, 
        _serverId: sv.id, 
        status: localVisit.status,
        environment: localVisit.environment,
        observations: localVisit.observations,
        date: localVisit.date,
        _isLocal: false 
      };
    }
    return { 
      ...sv, 
      _serverId: sv.id, 
      _isLocal: false,
      client_id: sv.client_id,
      client_name: sv.client_name,
      client_phone: sv.client_phone,
      client_address: sv.client_address
    };
  });
  
  const merged = [...localOnly, ...serverMapped];
  await write(KEYS.VISITS, merged);
  return merged;
};

export const mergeServerPhotos = async (visitId, serverPhotos) => {
  const localPhotos = await getPhotos(visitId);
  const queue = await getSyncQueue();
  const pendingUpdates = queue
    .filter(op => op.entity === 'photo' && op.type === 'UPDATE')
    .map(op => op.localId.toString());

  const localOnlyPhotos = localPhotos.filter(p => p._isLocal);

  const serverMapped = serverPhotos.map(sp => {
    const localPhoto = localPhotos.find(p => p.id.toString() === sp.id.toString());
    if (localPhoto && pendingUpdates.includes(sp.id.toString())) {
      return { 
        ...sp, 
        _serverId: sp.id, 
        markers: localPhoto.markers, 
        observations: localPhoto.observations, 
        _isLocal: false 
      };
    }
    return { ...sp, _serverId: sp.id, _isLocal: false };
  });

  const merged = [...localOnlyPhotos, ...serverMapped];

  await trackPhotoCacheItem(visitId);
  await write(KEYS.PHOTOS(visitId), merged);
  return merged;
};
