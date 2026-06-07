import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Image, ScrollView, useWindowDimensions, Modal as RNModal } from 'react-native';
import { Text, Surface, Button, TextInput, RadioButton, ActivityIndicator, IconButton, Portal, Modal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { theme, tokens } from '../theme/theme';
import * as localDB from '../services/localDB';
import api from '../services/api';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';

const formatPhone = (text) => {
  const cleaned = text.replace(/\D/g, '');
  if (cleaned.length <= 2) {
    return cleaned;
  } else if (cleaned.length <= 6) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  } else if (cleaned.length <= 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  } else {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  }
};

export default function NewVisitScreen({ route, navigation }) {
  const params = route.params || {};
  const preselectedClient = params.preselectedClient || null;
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClient ? preselectedClient.id : null);
  const [searchClient, setSearchClient] = useState('');

  const [addClientModalVisible, setAddClientModalVisible] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);

  const [selectedEnvironment, setSelectedEnvironment] = useState(null);

  const [photos, setPhotos] = useState([]);
  const [tempVisitId, setTempVisitId] = useState(null); 

  const [observations, setObservations] = useState('');

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedPhotoAspectRatio, setSelectedPhotoAspectRatio] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (selectedPhoto) {
      const uri = selectedPhoto.image_url;
      if (uri) {
        Image.getSize(uri, (w, h) => {
          setSelectedPhotoAspectRatio(w / h);
        }, () => {
          setSelectedPhotoAspectRatio(null);
        });
      } else {
        setSelectedPhotoAspectRatio(null);
      }
    } else {
      setSelectedPhotoAspectRatio(null);
    }
  }, [selectedPhoto]);

  useEffect(() => {
    async function handleOrientation() {
      if (viewerVisible && selectedPhotoAspectRatio) {
        if (selectedPhotoAspectRatio > 1) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }
    handleOrientation().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [viewerVisible, selectedPhotoAspectRatio]);

  const getViewerImageDimensions = () => {
    if (!selectedPhoto) return { width: 0, height: 0 };

    const ratio = (selectedPhoto.markers && selectedPhoto.markers.length > 0 && selectedPhoto.markers[0]?.canvasWidth && selectedPhoto.markers[0]?.canvasHeight)
      ? selectedPhoto.markers[0].canvasWidth / selectedPhoto.markers[0].canvasHeight
      : (selectedPhotoAspectRatio || (windowWidth > windowHeight ? 16 / 9 : 9 / 16));

    const isLandscapePhoto = ratio > 1;
    const safeWidth = (isMaximized && isLandscapePhoto) ? windowWidth : (windowWidth - (insets.left + insets.right));
    const safeHeight = (isMaximized && isLandscapePhoto) ? windowHeight : (windowHeight - (insets.top + insets.bottom));

    if (isMaximized) {
      let w = safeWidth;
      let h = safeWidth / ratio;

      if (h > safeHeight) {
        h = safeHeight;
        w = safeHeight * ratio;
      }
      return { width: w, height: h };
    }

    const maxWidth = safeWidth * 0.9;
    const maxHeight = safeHeight * 0.45;

    let w = maxWidth;
    let h = maxWidth / ratio;

    if (h > maxHeight) {
      h = maxHeight;
      w = maxHeight * ratio;
    }

    return { width: w, height: h };
  };

  const renderMarkersOnImage = (photoItem, displayWidth, displayHeight) => {
    if (!photoItem.markers || photoItem.markers.length === 0) return null;

    const origWidth = photoItem.markers[0].canvasWidth || 360;
    const origHeight = photoItem.markers[0].canvasHeight || 480;

    const scaleX = displayWidth / origWidth;
    const scaleY = displayHeight / origHeight;

    return photoItem.markers.map(marker => {
      const start = { x: marker.start.x * scaleX, y: marker.start.y * scaleY };
      const end = { x: marker.end.x * scaleX, y: marker.end.y * scaleY };
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;

      return (
        <React.Fragment key={marker.id}>
          <View 
            pointerEvents="none"
            style={{ 
              position: 'absolute', width: length, height: 3, 
              backgroundColor: '#00E676', 
              left: centerX - length / 2, top: centerY - 1.5, 
              transform: [{ rotate: `${angle}deg` }] 
            }} 
          />
          <View pointerEvents="none" style={[styles.point, { left: start.x - 5, top: start.y - 5 }]} />
          <View pointerEvents="none" style={[styles.point, { left: end.x - 5, top: end.y - 5 }]} />

          <View style={[styles.labelWrapper, { left: centerX - 45, top: centerY - 12 }]}>
            <View style={styles.labelContainer}>
              <Text style={styles.labelText} numberOfLines={1}>{marker.value}</Text>
            </View>
          </View>
        </React.Fragment>
      );
    });
  };

  const environments = [
    { name: 'Cozinha', icon: 'silverware-fork-knife' },
    { name: 'Quarto', icon: 'bed' },
    { name: 'Closet', icon: 'wardrobe' },
    { name: 'Banheiro', icon: 'shower' },
    { name: 'Sala', icon: 'sofa' },
    { name: 'Escritório', icon: 'desk-lamp' },
    { name: 'Lavanderia', icon: 'washing-machine' },
    { name: 'Outro', icon: 'dots-horizontal' }
  ];

  useEffect(() => {

    setTempVisitId(`temp_visit_${Date.now()}`);
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const localClients = await localDB.getClients();
    setClients(localClients);
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      if (tempVisitId) {
        const tempPhotos = await localDB.getPhotos(tempVisitId);
        setPhotos(tempPhotos);
      }
    });
    return unsubscribe;
  }, [navigation, tempVisitId]);

  const handleFetchLocation = async () => {
    setIsFetchingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos de permissão para acessar a localização.');
        setIsFetchingLocation(false);
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      let geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode && geocode.length > 0) {
        const addr = geocode[0];
        const formattedAddress = `${addr.street || ''}, ${addr.name || ''} - ${addr.subregion || addr.district || ''}, ${addr.city || addr.subregion || ''}`;
        setNewClientAddress(formattedAddress.replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').trim());
      } else {
        setNewClientAddress(`Lat: ${latitude.toFixed(6)}, Lon: ${longitude.toFixed(6)}`);
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível obter a localização.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleQuickAddClient = async () => {
    if (!newClientName.trim()) {
      Alert.alert('Erro', 'Nome do cliente é obrigatório.');
      return;
    }
    setIsSavingClient(true);
    const clientData = {
      name: newClientName,
      phone: newClientPhone,
      address: newClientAddress
    };

    try {
      const newClient = await localDB.createClient(clientData, true);

      const netState = await NetInfo.fetch();
      let synced = false;
      if (netState.isConnected) {
        try {
          const res = await api.post('/clients', clientData);
          if (res.data?.id) {
            newClient.id = res.data.id;
            newClient._serverId = res.data.id;
            newClient._isLocal = false;

            const currentList = await localDB.getClients();
            await localDB.setClients(currentList.map(c => c.id === newClient.id ? newClient : c));
            synced = true;
          }
        } catch (e) {}
      }

      if (!synced) {
        await localDB.addToSyncQueue({
          type: 'CREATE',
          entity: 'client',
          localId: newClient.id,
          data: clientData
        });
      }

      setClients([newClient, ...clients]);
      setSelectedClientId(newClient.id);
      setAddClientModalVisible(false);
      setNewClientName('');
      setNewClientPhone('');
      setNewClientAddress('');
      Alert.alert('Sucesso', 'Cliente cadastrado e selecionado!');
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao cadastrar o cliente.');
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleSaveVisit = async (isFinalized = false) => {
    setLoading(true);
    const selectedClient = clients.find(c => c.id.toString() === selectedClientId.toString());
    if (!selectedClient) {
      Alert.alert('Erro', 'Cliente inválido.');
      setLoading(false);
      return;
    }

    const visitStatus = isFinalized ? 'Concluído' : 'Pendente';
    const visitData = {
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      client_phone: selectedClient.phone,
      client_address: selectedClient.address,
      environment: selectedEnvironment,
      status: visitStatus,
      date: new Date().toISOString(),
      observations: observations,
    };

    try {

      const newVisit = await localDB.createVisit(visitData, true);

      if (photos.length > 0) {
        const movedPhotos = photos.map(p => ({
          ...p,
          id: p.id.startsWith('local_') ? p.id : `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          visit_id: newVisit.id
        }));
        await localDB.setPhotos(newVisit.id, movedPhotos);

        await localDB.setPhotos(tempVisitId, []);
      }

      const netState = await NetInfo.fetch();
      let visitSynced = false;
      let finalVisitId = newVisit.id;

      if (netState.isConnected) {
        try {
          const wakeCheck = await api.get('/wake');
          if (wakeCheck.status === 200) {

            const serverClientId = selectedClient._serverId || selectedClient.id;
            const res = await api.post('/visits', {
              ...visitData,
              client_id: serverClientId
            });
            if (res.data?.id) {
              const serverVisit = res.data;
              finalVisitId = serverVisit.id;

              const allVisits = await localDB.getVisits();
              const updatedVisits = allVisits.map(v => 
                v.id === newVisit.id 
                  ? { ...v, id: serverVisit.id, _serverId: serverVisit.id, _isLocal: false } 
                  : v
              );
              await localDB.setVisits(updatedVisits);

              const visitPhotos = await localDB.getPhotos(newVisit.id);
              const serverPhotos = [];

              for (const photo of visitPhotos) {
                try {
                  const formData = new FormData();
                  formData.append('photo', { 
                    uri: photo.image_url, 
                    type: 'image/jpeg', 
                    name: 'photo.jpg' 
                  });
                  formData.append('visit_id', serverVisit.id);
                  if (photo.markers?.length > 0) {
                    formData.append('markers', JSON.stringify(photo.markers));
                  }
                  if (photo.observations?.length > 0) {
                    formData.append('observations', JSON.stringify(photo.observations));
                  }

                  const uploadRes = await api.post('/photos', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                  });
                  if (uploadRes.data?.id) {
                    serverPhotos.push({
                      ...uploadRes.data,
                      _serverId: uploadRes.data.id,
                      _isLocal: false
                    });
                  }
                } catch (err) {

                  await localDB.addToSyncQueue({
                    type: 'CREATE',
                    entity: 'photo',
                    localId: photo.id,
                    visitLocalId: newVisit.id,
                    data: { 
                      localFileUri: photo.image_url, 
                      markers: photo.markers, 
                      observations: photo.observations,
                      visit_id: serverVisit.id 
                    }
                  });
                }
              }

              if (serverPhotos.length > 0) {
                await localDB.setPhotos(serverVisit.id, serverPhotos);
              } else {

                const adjustedPhotos = visitPhotos.map(p => ({ ...p, visit_id: serverVisit.id }));
                await localDB.setPhotos(serverVisit.id, adjustedPhotos);
              }

              visitSynced = true;
            }
          }
        } catch (e) {
          console.log('[NewVisit] Sync to server error:', e);
        }
      }

      if (!visitSynced) {

        await localDB.addToSyncQueue({
          type: 'CREATE',
          entity: 'visit',
          localId: newVisit.id,
          clientLocalId: selectedClient.id,
          data: {
            client_id: selectedClient.id,
            environment: selectedEnvironment,
            status: visitStatus,
            date: visitData.date,
            observations: observations
          }
        });

        const visitPhotos = await localDB.getPhotos(newVisit.id);
        for (const photo of visitPhotos) {
          await localDB.addToSyncQueue({
            type: 'CREATE',
            entity: 'photo',
            localId: photo.id,
            visitLocalId: newVisit.id,
            data: {
              localFileUri: photo.image_url,
              markers: photo.markers,
              observations: photo.observations,
              visit_id: newVisit.id
            }
          });
        }
      }

      setLoading(false);

      if (isFinalized) {

        const finalVisits = await localDB.getVisits();
        const visitToExport = finalVisits.find(v => v.id.toString() === finalVisitId.toString());
        navigation.replace('ExportReport', { visit: visitToExport || newVisit });
      } else {
        Alert.alert('Sucesso', 'Visita salva como pendente.');
        navigation.navigate('Projects');
      }
    } catch (error) {
      setLoading(false);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar a visita: ' + error.message);
    }
  };

  const getFilteredClients = () => {
    if (!searchClient.trim()) return clients;
    const q = searchClient.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q));
  };

  const renderProgressBar = () => {
    const steps = [
      { label: 'Cliente', icon: 'account' },
      { label: 'Ambiente', icon: 'sofa' },
      { label: 'Fotos', icon: 'camera' },
      { label: 'Resumo', icon: 'check-bold' }
    ];
    return (
      <View style={[styles.progressBarContainer, { paddingTop: insets.top + tokens.spacing.md }]}>
        <View style={styles.progressBarWrapper}>
          <View style={styles.connectingLineContainer}>
            <View style={styles.connectingLineGray} />
            <View 
              style={[
                styles.connectingLineActive, 
                { width: `${((step - 1) / (steps.length - 1)) * 100}%` }
              ]} 
            />
          </View>
          {steps.map((s, idx) => {
            const isDone = idx + 1 < step;
            const isCurrent = idx + 1 === step;
            const isPending = idx + 1 > step;
            return (
              <View key={s.label} style={styles.stepWrapper}>
                <View 
                  pointerEvents="none"
                  style={[
                    styles.iconCircle,
                    isDone && styles.iconCircleDone,
                    isCurrent && styles.iconCircleCurrent,
                    isPending && styles.iconCirclePending
                  ]}
                >
                  <IconButton
                    icon={s.icon}
                    iconColor={
                      isDone || isCurrent 
                        ? '#FFFFFF' 
                        : theme.colors.placeholder
                    }
                    size={20}
                    style={styles.stepIcon}
                  />
                </View>
                <Text 
                  style={[
                    styles.stepLabel,
                    isCurrent && styles.stepLabelCurrent,
                    isDone && styles.stepLabelDone
                  ]}
                >
                  {s.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderStepClient = () => {
    const filtered = getFilteredClients();
    return (
      <View style={styles.stepContainer}>
        <View style={styles.header}>
          <Text style={tokens.typography.h1}>Selecionar cliente</Text>
          <Text style={styles.subtitle}>Escolha um cliente existente ou cadastre um novo</Text>
        </View>

        <TextInput
          placeholder="Buscar cliente..."
          value={searchClient}
          onChangeText={setSearchClient}
          mode="outlined"
          left={<TextInput.Icon icon="magnify" />}
          style={styles.searchInput}
          outlineColor={theme.colors.border}
          activeOutlineColor={theme.colors.primary}
        />

        <FlatList
          data={filtered}
          keyExtractor={item => item.id.toString()}
          style={styles.clientList}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[
                styles.clientSelectionCard,
                selectedClientId === item.id && styles.clientSelectedCard
              ]}
              onPress={() => setSelectedClientId(item.id)}
            >
              <View style={styles.radioButtonWrapper}>
                <RadioButton
                  value={item.id}
                  status={selectedClientId === item.id ? 'checked' : 'unchecked'}
                  onPress={() => setSelectedClientId(item.id)}
                  color={theme.colors.primary}
                />
                <View style={{ marginLeft: tokens.spacing.sm, flex: 1 }}>
                  <Text style={styles.clientSelectionName}>{item.name}</Text>
                  {item.phone ? <Text style={styles.clientSelectionDetail}>📞 {item.phone}</Text> : null}
                  {item.address ? <Text style={styles.clientSelectionDetail} numberOfLines={1}>📍 {item.address}</Text> : null}
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={tokens.typography.subtitle}>Nenhum cliente encontrado</Text>
            </View>
          }
        />

        <Button 
          mode="outlined" 
          icon="plus"
          onPress={() => setAddClientModalVisible(true)}
          style={styles.addClientBtn}
        >
          Novo cliente
        </Button>

        <Button 
          mode="contained" 
          disabled={!selectedClientId}
          onPress={() => setStep(2)}
          style={styles.continueBtn}
        >
          Continuar
        </Button>
      </View>
    );
  };

  const renderStepEnvironment = () => {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.header}>
          <Text style={tokens.typography.h1}>Selecione o ambiente</Text>
          <Text style={styles.subtitle}>Escolha o cômodo correspondente ao registro</Text>
        </View>

        <ScrollView contentContainerStyle={styles.environmentsGrid}>
          {environments.map(env => {
            const isSelected = selectedEnvironment === env.name;
            return (
              <TouchableOpacity
                key={env.name}
                style={[
                  styles.envCard,
                  isSelected && styles.envCardSelected
                ]}
                onPress={() => setSelectedEnvironment(env.name)}
              >
                <IconButton 
                  icon={env.icon} 
                  iconColor={isSelected ? '#FFFFFF' : theme.colors.primary} 
                  size={32}
                  style={styles.envIcon}
                />
                <Text style={[
                  styles.envName,
                  isSelected && styles.envNameSelected
                ]}>{env.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.footerActions}>
          <Button mode="outlined" onPress={() => setStep(1)} style={styles.halfBtn}>Voltar</Button>
          <Button 
            mode="contained" 
            disabled={!selectedEnvironment} 
            onPress={() => setStep(3)} 
            style={styles.halfBtn}
          >
            Continuar
          </Button>
        </View>
      </View>
    );
  };

  const renderStepPhotos = () => {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.header}>
          <Text style={tokens.typography.h1}>Registro de fotos</Text>
          <Text style={styles.subtitle}>Tire fotos e adicione medidas e anotações</Text>
        </View>

        <View style={styles.photoCountHeader}>
          <Text style={tokens.typography.h3}>Fotos adicionadas: {photos.length}</Text>
        </View>

        <FlatList
          data={photos}
          keyExtractor={item => item.id.toString()}
          numColumns={2}
          columnWrapperStyle={styles.photosGridRow}
          style={styles.photosGrid}
          renderItem={({ item }) => (
            <Surface style={styles.photoThumbnailCard}>
              <TouchableOpacity
                style={{ width: '100%', height: '100%' }}
                onPress={() => navigation.navigate('Measurement', { 
                  visitId: tempVisitId, 
                  photoId: item.id, 
                  photoUri: item.image_url, 
                  existingMarkers: item.markers || [],
                  aspectRatio: item.aspect_ratio || (4 / 3)
                })}
              >
                <Image source={{ uri: item.image_url }} style={styles.photoThumbnail} />
              </TouchableOpacity>
              {item.markers?.length > 0 && (
                <View style={styles.photoMarkersBadge}>
                  <Text style={styles.photoBadgeText}>{item.markers.length} cota(s)</Text>
                </View>
              )}
              {item.observations?.length > 0 && (
                <View style={[styles.photoMarkersBadge, { backgroundColor: '#FFAB00', top: 30 }]}>
                  <Text style={styles.photoBadgeText}>{item.observations.length} obs</Text>
                </View>
              )}
              <IconButton 
                icon="delete" 
                iconColor="red" 
                size={18}
                style={styles.deletePhotoBtn}
                onPress={async () => {
                  await localDB.deletePhoto(tempVisitId, item.id);
                  setPhotos(prev => prev.filter(p => p.id !== item.id));
                }}
              />
              <IconButton 
                icon="comment-plus-outline" 
                iconColor={theme.colors.primary} 
                size={18}
                style={styles.commentPhotoBtn}
                onPress={() => navigation.navigate('PhotoObservations', { photoId: item.id, visitId: tempVisitId })}
              />
            </Surface>
          )}
          ListEmptyComponent={
            <View style={styles.emptyPhotosContainer}>
              <Text style={tokens.typography.caption}>Nenhuma foto adicionada ainda.</Text>
              <Text style={tokens.typography.caption}>Toque no botão de Câmera abaixo para tirar.</Text>
            </View>
          }
        />

        <IconButton
          icon="camera"
          mode="contained"
          containerColor={theme.colors.primary}
          iconColor="white"
          size={36}
          style={styles.cameraFab}
          onPress={() => navigation.navigate('Measurement', { itemId: tempVisitId, projectId: tempVisitId })}
        />

        <View style={styles.footerActions}>
          <Button mode="outlined" onPress={() => setStep(2)} style={styles.halfBtn}>Voltar</Button>
          <Button 
            mode="contained" 
            disabled={photos.length === 0} 
            onPress={() => setStep(4)} 
            style={styles.halfBtn}
          >
            Resumo
          </Button>
        </View>
      </View>
    );
  };

  const renderStepSummary = () => {
    const selectedClient = clients.find(c => c.id.toString() === selectedClientId.toString());

    const totalPhotoObs = photos.reduce((acc, p) => acc + (p.observations?.length || 0), 0);

    return (
      <View style={styles.stepContainer}>
        <View style={styles.header}>
          <Text style={tokens.typography.h1}>Resumo da visita</Text>
          <Text style={styles.subtitle}>Confira os dados antes de salvar o registro</Text>
        </View>

        <ScrollView style={styles.summaryScroll}>
          {}
          <Surface style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Cliente</Text>
            <Text style={styles.summaryTextBold}>{selectedClient?.name}</Text>
            {selectedClient?.phone ? <Text style={styles.summaryText}>📞 {selectedClient.phone}</Text> : null}
            {selectedClient?.address ? <Text style={styles.summaryText}>📍 {selectedClient.address}</Text> : null}
          </Surface>

          {}
          <Surface style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Ambiente</Text>
            <Text style={styles.summaryTextBold}>{selectedEnvironment}</Text>
          </Surface>

          {}
          <Surface style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Fotos Registradas ({photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryPhotoList}>
              {photos.map(p => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => {
                    setSelectedPhoto(p);
                    setIsMaximized(true);
                    setViewerVisible(true);
                  }}
                >
                  <Image source={{ uri: p.image_url }} style={styles.summaryPhotoThumb} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Surface>

          {}
          <TextInput
            label="Observações gerais da visita"
            value={observations}
            onChangeText={setObservations}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.observationsInput}
          />
        </ScrollView>

        <View style={styles.footerSummaryActions}>
          <Button 
            mode="text" 
            onPress={() => setStep(3)} 
            disabled={loading}
            style={styles.summaryActionBtn}
          >
            Editar visita
          </Button>
          <Button 
            mode="contained" 
            onPress={() => handleSaveVisit(false)} 
            disabled={loading}
            loading={loading}
            style={[styles.summaryActionBtn, { backgroundColor: theme.colors.primary }]}
          >
            Salvar visita
          </Button>
        </View>
      </View>
    );
  };

  if (loading && step === 1) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderProgressBar()}
      {step === 1 && renderStepClient()}
      {step === 2 && renderStepEnvironment()}
      {step === 3 && renderStepPhotos()}
      {step === 4 && renderStepSummary()}

      <RNModal
        visible={viewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setViewerVisible(false);
          setIsMaximized(false);
        }}
      >
        <View style={styles.viewerBackground}>
          {selectedPhoto && (() => {
            const ratio = (selectedPhoto.markers && selectedPhoto.markers.length > 0 && selectedPhoto.markers[0]?.canvasWidth && selectedPhoto.markers[0]?.canvasHeight)
              ? selectedPhoto.markers[0].canvasWidth / selectedPhoto.markers[0].canvasHeight
              : (selectedPhotoAspectRatio || 4 / 3);
            const isLandscapePhoto = ratio > 1;
            const safeWidth = (isMaximized && isLandscapePhoto) ? windowWidth : (windowWidth - (insets.left + insets.right));
            const safeHeight = (isMaximized && isLandscapePhoto) ? windowHeight : (windowHeight - (insets.top + insets.bottom));
            const dims = getViewerImageDimensions();
            return (
              <View style={isMaximized ? [styles.viewerContainer, { width: safeWidth, height: safeHeight, justifyContent: 'center' }] : styles.viewerContainer}>
                <View style={isMaximized 
                  ? [styles.viewerImageWrapper, { width: dims.width, height: dims.height, borderRadius: 0, alignSelf: 'center' }] 
                  : [styles.viewerImageWrapper, { width: dims.width, height: dims.height, alignSelf: 'center' }]
                }>
                  <Image 
                    source={{ uri: selectedPhoto.image_url }} 
                    style={styles.viewerImage} 
                    resizeMode="cover"
                  />

                  {}
                  <View style={StyleSheet.absoluteFill}>
                    {renderMarkersOnImage(selectedPhoto, dims.width, dims.height)}
                  </View>
                </View>

                {!isMaximized && (
                  <View style={styles.viewerObsPanel}>
                    <Text style={styles.viewerObsPanelTitle}>Anotações da Imagem</Text>
                    <ScrollView contentContainerStyle={styles.viewerObsScroll}>
                      {selectedPhoto.observations && selectedPhoto.observations.length > 0 ? (
                        selectedPhoto.observations.map(obs => (
                          <View key={obs.id} style={[styles.viewerObsItem, { borderLeftColor: obs.color }]}>
                            <Text style={styles.viewerObsItemText}>{obs.text}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.noViewerObsText}>Nenhuma anotação nesta foto.</Text>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
            );
          })()}
          <IconButton 
            icon="close" 
            iconColor="white" 
            size={28} 
            containerColor="rgba(0,0,0,0.5)"
            style={[styles.closeViewerBtn, { top: Math.max(insets.top, 20) }]}
            onPress={() => {
              setViewerVisible(false);
              setIsMaximized(false);
            }}
          />
        </View>
      </RNModal>

      {}
      <Portal>
        <Modal
          visible={addClientModalVisible}
          onDismiss={() => {
            if (!isSavingClient && !isFetchingLocation) setAddClientModalVisible(false);
          }}
          contentContainerStyle={styles.modal}
        >
          <Text style={[tokens.typography.h2, { marginBottom: tokens.spacing.md }]}>Novo Cliente</Text>
          <TextInput
            label="Nome do Cliente *"
            value={newClientName}
            onChangeText={setNewClientName}
            mode="outlined"
            style={styles.input}
            disabled={isSavingClient}
          />
          <TextInput
            label="Telefone"
            value={newClientPhone}
            onChangeText={(text) => setNewClientPhone(formatPhone(text))}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
            disabled={isSavingClient}
            maxLength={15}
          />
          <View style={styles.addressWrapper}>
            <TextInput
              label="Endereço"
              value={newClientAddress}
              onChangeText={setNewClientAddress}
              mode="outlined"
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              disabled={isSavingClient}
              multiline
            />
            <IconButton
              icon="crosshairs-gps"
              mode="contained"
              containerColor={theme.colors.statusInProg}
              iconColor={theme.colors.statusInProgText}
              size={24}
              onPress={handleFetchLocation}
              loading={isFetchingLocation}
              disabled={isSavingClient || isFetchingLocation}
              style={styles.gpsButton}
            />
          </View>
          <View style={styles.modalActions}>
            <Button onPress={() => setAddClientModalVisible(false)} disabled={isSavingClient} style={{ marginRight: 8 }}>
              Cancelar
            </Button>
            <Button 
              mode="contained" 
              onPress={handleQuickAddClient}
              loading={isSavingClient}
              disabled={isSavingClient}
              style={{ backgroundColor: theme.colors.primary }}
            >
              Salvar
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContainer: {
    flex: 1,
    paddingBottom: tokens.spacing.md,
  },
  header: {
    padding: tokens.spacing.lg,
    backgroundColor: theme.colors.surface,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.placeholder,
    marginTop: 2,
  },
  searchInput: {
    marginHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.md,
    backgroundColor: theme.colors.surface,
    height: 48,
  },
  clientList: {
    flex: 1,
    marginHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.md,
  },
  clientSelectionCard: {
    backgroundColor: theme.colors.surface,
    padding: tokens.spacing.sm,
    borderRadius: theme.roundness,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  clientSelectedCard: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: '#F3F4FB',
  },
  radioButtonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientSelectionName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  clientSelectionDetail: {
    fontSize: 12,
    color: theme.colors.placeholder,
    marginTop: 2,
  },
  addClientBtn: {
    marginHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.sm,
    borderColor: theme.colors.primary,
  },
  continueBtn: {
    marginHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
    backgroundColor: theme.colors.primary,
  },
  environmentsGrid: {
    padding: tokens.spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: tokens.spacing.md,
  },
  envCard: {
    width: '45%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness * 1.5,
    padding: tokens.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...tokens.shadows.light,
  },
  envCardSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  envIcon: {
    margin: 0,
  },
  envName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
    marginTop: tokens.spacing.xs,
  },
  envNameSelected: {
    color: '#FFFFFF',
  },
  footerActions: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
    gap: tokens.spacing.md,
  },
  halfBtn: {
    flex: 1,
  },
  photoCountHeader: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.xs,
  },
  photosGrid: {
    flex: 1,
    paddingHorizontal: tokens.spacing.lg,
  },
  photosGridRow: {
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  photoThumbnailCard: {
    width: '48%',
    height: 150,
    borderRadius: theme.roundness,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoMarkersBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '700',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    margin: 4,
  },
  commentPhotoBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    margin: 4,
  },
  emptyPhotosContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  cameraFab: {
    alignSelf: 'center',
    marginVertical: tokens.spacing.md,
    borderRadius: 30,
    width: 60,
    height: 60,
    elevation: 4,
  },
  summaryScroll: {
    flex: 1,
    paddingHorizontal: tokens.spacing.lg,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    padding: tokens.spacing.md,
    borderRadius: theme.roundness,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...tokens.shadows.light,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.placeholder,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryTextBold: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  summaryText: {
    fontSize: 13,
    color: theme.colors.secondary,
    marginTop: 2,
  },
  summaryPhotoList: {
    flexDirection: 'row',
    marginTop: tokens.spacing.sm,
  },
  summaryPhotoThumb: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  observationsInput: {
    backgroundColor: theme.colors.surface,
    marginBottom: tokens.spacing.lg,
  },
  footerSummaryActions: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  summaryActionBtn: {
    width: '100%',
  },
  progressBarContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: tokens.spacing.md,
    alignItems: 'center',
  },
  progressBarWrapper: {
    flexDirection: 'row',
    width: '90%',
    justifyContent: 'space-between',
    position: 'relative',
    alignItems: 'flex-start',
    marginTop: tokens.spacing.sm,
  },
  connectingLineContainer: {
    position: 'absolute',
    top: 20,
    left: 35,
    right: 35,
    height: 3,
  },
  connectingLineGray: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
  },
  connectingLineActive: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  stepWrapper: {
    alignItems: 'center',
    width: 70,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  iconCircleDone: {
    backgroundColor: theme.colors.primary,
  },
  iconCircleCurrent: {
    backgroundColor: theme.colors.primary,
  },
  iconCirclePending: {
    backgroundColor: '#F8F9FD',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  stepIcon: {
    margin: 0,
    padding: 0,
  },
  stepLabel: {
    fontSize: 11,
    color: theme.colors.placeholder,
    marginTop: 6,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepLabelCurrent: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  stepLabelDone: {
    color: theme.colors.primary,
  },
  modal: {
    backgroundColor: 'white',
    padding: 24,
    margin: 20,
    borderRadius: theme.roundness * 2,
    ...tokens.shadows.medium,
  },
  input: {
    marginBottom: tokens.spacing.md,
  },
  addressWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  gpsButton: {
    alignSelf: 'center',
    marginTop: 6,
    borderRadius: 8,
    width: 48,
    height: 48,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: tokens.spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: tokens.spacing.xl,
  },
  viewerBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeViewerBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 999,
  },
  viewerContainer: {
    width: '90%',
    height: '80%',
    justifyContent: 'space-between',
  },
  viewerImageWrapper: {
    width: '100%',
    height: '65%',
    backgroundColor: 'black',
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  point: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00E676',
    borderWidth: 1.5,
    borderColor: 'white',
  },
  labelWrapper: {
    position: 'absolute',
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    backgroundColor: 'rgba(22, 29, 100, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00E676',
  },
  labelText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  viewerObsPanel: {
    height: '30%',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: tokens.spacing.md,
    ...tokens.shadows.medium,
  },
  viewerObsPanelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: tokens.spacing.xs,
  },
  viewerObsScroll: {
    paddingVertical: tokens.spacing.xs,
  },
  viewerObsItem: {
    padding: tokens.spacing.xs,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
    marginBottom: tokens.spacing.xs,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  viewerObsItemText: {
    fontSize: 13,
    color: theme.colors.text,
  },
  noViewerObsText: {
    fontSize: 12,
    color: theme.colors.placeholder,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: tokens.spacing.md,
  },
});
