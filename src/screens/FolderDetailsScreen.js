import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Image, useWindowDimensions } from 'react-native';
import { Text, Surface, FAB, ActivityIndicator, IconButton, Menu, Portal, Modal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { theme, tokens } from '../theme/theme';
import * as localDB from '../services/localDB';
import api from '../services/api';

export default function FolderDetailsScreen({ route, navigation }) {
  const { folder, project } = route.params;
  const insets = useSafeAreaInsets();
  
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visibleMenu, setVisibleMenu] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedPhotoAspectRatio, setSelectedPhotoAspectRatio] = useState(null);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  let containerWidth = width;
  let containerHeight = height;

  if (selectedPhoto && selectedPhotoAspectRatio) {
    const availableWidth = width;
    const availableHeight = height - (insets.bottom + insets.top + 40);

    const imageRatio = selectedPhotoAspectRatio;
    const screenRatio = availableWidth / availableHeight;

    if (imageRatio > screenRatio) {
      containerWidth = availableWidth;
      containerHeight = availableWidth / imageRatio;
    } else {
      containerHeight = availableHeight;
      containerWidth = availableHeight * imageRatio;
    }
  }

  useEffect(() => {
    if (selectedPhoto) {
      const uri = selectedPhoto.image_url || selectedPhoto._localFileUri;
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
      if (imageModalVisible && selectedPhotoAspectRatio) {
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
  }, [imageModalVisible, selectedPhotoAspectRatio]);

  const loadLocalPhotos = async () => {
    const local = await localDB.getPhotos(folder.id);
    setPhotos(local);
    setLoading(false);
    setRefreshing(false);
  };

  const fetchFromServer = async () => {
    const folderServerId = folder._serverId || (String(folder.id).startsWith('local_') ? null : folder.id);
    if (!folderServerId) return;

    try {
      const response = await api.get(`/photos/item/${folderServerId}`);
      if (Array.isArray(response.data)) {
        const merged = await localDB.mergeServerPhotos(folder.id, response.data);
        setPhotos(merged);
      }
    } catch (error) {}
  };

  const refreshData = async () => {
    await loadLocalPhotos();
    await fetchFromServer();
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', refreshData);
    navigation.setOptions({ title: folder.name });
    return unsubscribe;
  }, [navigation, folder]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const handleDelete = (photoId) => {
    setVisibleMenu(null);
    Alert.alert(
      'Excluir Foto',
      'Tem certeza que deseja excluir esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            await localDB.deletePhoto(folder.id, photoId);
            setPhotos(prev => prev.filter(p => p.id !== photoId));

            const photo = photos.find(p => p.id === photoId);
            const serverId = photo?._serverId || (String(photoId).startsWith('local_') ? null : photoId);
            if (serverId) {
              api.delete(`/photos/${serverId}`).catch(() => {});
            }
          }
        }
      ]
    );
  };

  const renderLine = (start, end, value, id) => {
    if (!start || !end) return null;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;

    return (
      <React.Fragment key={id}>
        <View 
          style={{ 
            position: 'absolute', width: length, height: 3, 
            backgroundColor: theme.colors.accent, 
            left: centerX - length / 2, top: centerY - 1.5, 
            transform: [{ rotate: `${angle}deg` }] 
          }} 
        />
        <View style={[styles.point, { left: start.x - 6, top: start.y - 6 }]} />
        <View style={[styles.point, { left: end.x - 6, top: end.y - 6 }]} />
        
        {value ? (
          <View style={[styles.labelWrapper, { left: centerX - 50, top: centerY - 15 }]}>
            <View style={styles.labelContainer}>
              <Text style={styles.labelText} numberOfLines={1}>{value}</Text>
            </View>
          </View>
        ) : null}
      </React.Fragment>
    );
  };

  const renderItem = ({ item }) => (
    <Surface style={[styles.itemCard, item._isLocal && styles.offlineCard]}>
      <TouchableOpacity 
        activeOpacity={0.8} 
        onPress={() => {
          setSelectedPhoto(item);
          setImageModalVisible(true);
        }}
      >
        <Image 
          source={{ uri: item.image_url || item._localFileUri }} 
          style={styles.image} 
        />
      </TouchableOpacity>
      
      <View style={styles.itemFooter}>
        <View style={styles.itemInfo}>
          <Text style={tokens.typography.caption}>
            {new Date(item.created_at).toLocaleDateString()}
            {item._isLocal ? '  ⏱ Offline' : ''}
          </Text>
        </View>
        
        <Menu
          visible={visibleMenu === item.id}
          onDismiss={() => setVisibleMenu(null)}
          anchor={
            <IconButton
              icon="dots-vertical"
              onPress={() => setVisibleMenu(item.id)}
            />
          }
        >
          <Menu.Item onPress={() => handleDelete(item.id)} title="Excluir Foto" leadingIcon="delete" titleStyle={{color: 'red'}} />
        </Menu>
      </View>
    </Surface>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={photos}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.accent]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={tokens.typography.subtitle}>Nenhuma foto nesta pasta</Text>
            <Text style={tokens.typography.caption}>Clique no + para adicionar</Text>
          </View>
        }
      />
      
      <FAB
        icon="camera"
        style={[styles.fab, { bottom: Math.max(insets.bottom + 16, 16) }]}
        onPress={() => navigation.navigate('Measurement', { 
          itemId: folder.id,
          itemLocalId: folder.id, 
          projectId: project.id 
        })}
        color="white"
      />

      <Portal>
        <Modal 
          visible={imageModalVisible} 
          onDismiss={() => setImageModalVisible(false)} 
          contentContainerStyle={styles.fullScreenModal}
        >
          {selectedPhoto && (selectedPhoto.image_url || selectedPhoto._localFileUri) && (
            <View style={styles.modalContainer}>
              <View style={[styles.imageContainer, { width: containerWidth, height: containerHeight }]}>
                <Image 
                  source={{ uri: selectedPhoto.image_url || selectedPhoto._localFileUri }} 
                  style={styles.fullImage} 
                />
                {selectedPhoto.markers && selectedPhoto.markers.length > 0 && 
                  selectedPhoto.markers.map(marker => renderLine(marker.start, marker.end, marker.value, marker.id))
                }
              </View>
              <View style={styles.modalHeaderActions}>
                <IconButton
                  icon="pencil"
                  iconColor="white"
                  containerColor="rgba(0,0,0,0.5)"
                  size={24}
                  onPress={() => {
                    setImageModalVisible(false);
                    navigation.navigate('Measurement', {
                      itemId: folder.id,
                      projectId: project?.id,
                      photoUri: selectedPhoto.image_url || selectedPhoto._localFileUri,
                      existingMarkers: selectedPhoto.markers || [],
                      photoId: selectedPhoto.id,
                      aspectRatio: selectedPhotoAspectRatio
                    });
                  }}
                  style={styles.modalHeaderButton}
                />
                <IconButton
                  icon="close"
                  iconColor="white"
                  containerColor="rgba(0,0,0,0.5)"
                  size={24}
                  onPress={() => setImageModalVisible(false)}
                  style={styles.modalHeaderButton}
                />
              </View>
            </View>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: tokens.spacing.md },
  itemCard: {
    marginBottom: tokens.spacing.md,
    borderRadius: theme.roundness * 2,
    overflow: 'hidden',
    ...tokens.shadows.light,
  },
  offlineCard: { borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  image: { width: '100%', height: 250, backgroundColor: theme.colors.surface },
  itemFooter: {
    padding: tokens.spacing.sm,
    paddingLeft: tokens.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  itemInfo: { flex: 1 },
  fab: {
    position: 'absolute',
    margin: tokens.spacing.lg,
    right: 0,
    backgroundColor: theme.colors.accent,
  },
  empty: { marginTop: 100, alignItems: 'center' },
  fullScreenModal: { flex: 1, backgroundColor: 'black', margin: 0, padding: 0 },
  modalContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    backgroundColor: 'black',
    position: 'relative',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  modalHeaderActions: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    zIndex: 999,
  },
  modalHeaderButton: {
    marginHorizontal: 4,
  },
  point: {
    position: 'absolute',
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: theme.colors.accent,
    borderWidth: 2, borderColor: 'white', elevation: 4,
  },
  labelWrapper: { position: 'absolute', width: 100, alignItems: 'center', justifyContent: 'center' },
  labelContainer: {
    backgroundColor: 'rgba(33, 43, 54, 0.9)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: theme.colors.accent,
  },
  labelText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
});
