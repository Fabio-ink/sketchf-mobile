import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Dimensions, useWindowDimensions } from 'react-native';
import { Text, FAB, Portal, Modal, TextInput, Button, IconButton } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, tokens } from '../theme/theme';
import api from '../services/api';
import { saveAndCompressImage, removeImage } from '../services/imageStorage';
import * as localDB from '../services/localDB';

export default function MeasurementScreen({ route, navigation }) {
  const params = route.params || {};
  const itemId = params.itemId || 1;
  const projectId = params.projectId || 1;
  const photoUri = params.photoUri || null;
  const existingMarkers = params.existingMarkers || [];
  const initialPhotoId = params.photoId || null;

  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState(photoUri);
  const [markers, setMarkers] = useState(existingMarkers);
  const [photoId, setPhotoId] = useState(initialPhotoId);
  const [step, setStep] = useState(1);
  const [tempPointA, setTempPointA] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentValue, setCurrentValue] = useState('');
  const [lastTap, setLastTap] = useState(null);
  const cameraRef = useRef(null);
  const [aspectRatio, setAspectRatio] = useState(params.aspectRatio || null);

  const [editingMarkerId, setEditingMarkerId] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  let containerWidth = width;
  let containerHeight = height;

  if (photo && aspectRatio) {
    const availableWidth = isLandscape ? (width - 160) : width;
    const availableHeight = isLandscape ? height : (height - (insets.bottom + 140));

    const imageRatio = aspectRatio;
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
    async function unlock() {
      await ScreenOrientation.unlockAsync();
    }
    unlock().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (photo) {
      if (params.aspectRatio && photo === photoUri) {
        return;
      }
      Image.getSize(photo, (w, h) => {
        setAspectRatio(w / h);
      }, () => {
        setAspectRatio(null);
      });
    } else {
      setAspectRatio(null);
    }
  }, [photo]);

  useEffect(() => {
    async function updateOrientation() {
      if (photo && aspectRatio) {
        if (aspectRatio > 1) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } else {
        await ScreenOrientation.unlockAsync();
      }
    }
    updateOrientation().catch(() => {});
  }, [photo, aspectRatio]);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>Precisamos de acesso à câmera</Text>
        <Button onPress={requestPermission}>Permitir</Button>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const data = await cameraRef.current.takePictureAsync({ exif: true });
        let finalUri = data.uri;
        
        const exifOri = data.exif?.Orientation || data.exif?.orientation;
        const orientation = exifOri ? parseInt(exifOri, 10) : 1;
        const isPhysicallyPortrait = data.width < data.height;
        
        const isTargetLandscape = (orientation === 6 || orientation === 8 || orientation === 3) || (orientation === 1 && isLandscape);
        
        let rotation = 0;
        if (isTargetLandscape) {
          if (isPhysicallyPortrait) {
            if (orientation === 8) {
              rotation = 270;
            } else {
              rotation = 90;
            }
          }
        } else {
          if (!isPhysicallyPortrait) {
            rotation = 90;
          }
        }
        
        if (isTargetLandscape) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          setAspectRatio(16 / 9);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          setAspectRatio(9 / 16);
        }
        
        if (rotation !== 0) {
          const manipResult = await ImageManipulator.manipulateAsync(
            data.uri,
            [{ rotate: rotation }],
            { compress: 1.0, format: ImageManipulator.SaveFormat.JPEG }
          );
          finalUri = manipResult.uri;
        }
        
        setPhoto(finalUri);
      } catch (error) {
        try {
          if (cameraRef.current) {
            const data = await cameraRef.current.takePictureAsync();
            setPhoto(data.uri);
          }
        } catch (e) {}
      }
    }
  };

  const handleImageTap = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    
    if (step === 1) {
      setTempPointA({ x: locationX, y: locationY });
      setStep(2);
    } else if (step === 2) {
      setLastTap({ x: locationX, y: locationY });
      setModalVisible(true);
    }
  };

  const addMarker = () => {
    if (tempPointA && lastTap && currentValue) {
      setMarkers([...markers, { 
        start: tempPointA, 
        end: { x: lastTap.x, y: lastTap.y }, 
        value: currentValue, 
        id: Date.now().toString() 
      }]);
      setCurrentValue('');
      setTempPointA(null);
      setLastTap(null);
      setStep(1);
      setModalVisible(false);
    }
  };

  const cancelMarker = () => {
    setCurrentValue('');
    setTempPointA(null);
    setLastTap(null);
    setStep(1);
    setModalVisible(false);
  };

  const handleRetake = () => {
    setPhoto(null);
    setMarkers([]);
    setStep(1);
    setTempPointA(null);
    setLastTap(null);
  };

  const handleLabelTap = (id) => {
    if (id === 'temp') return;
    const marker = markers.find(m => m.id === id);
    if (marker) {
      setEditingMarkerId(id);
      setEditValue(marker.value || '');
      setEditModalVisible(true);
    }
  };

  const saveEditedMarker = () => {
    if (editingMarkerId && editValue.trim()) {
      setMarkers(prevMarkers => prevMarkers.map(m => 
        m.id === editingMarkerId ? { ...m, value: editValue } : m
      ));
      setEditModalVisible(false);
      setEditingMarkerId(null);
      setEditValue('');
    }
  };

  const deleteMarker = () => {
    if (editingMarkerId) {
      setMarkers(prevMarkers => prevMarkers.filter(m => m.id !== editingMarkerId));
      setEditModalVisible(false);
      setEditingMarkerId(null);
      setEditValue('');
    }
  };

  const cancelEditMarker = () => {
    setEditModalVisible(false);
    setEditingMarkerId(null);
    setEditValue('');
  };

  const renderLine = (start, end, value, id) => {
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
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => handleLabelTap(id)}
            style={[styles.labelWrapper, { left: centerX - 50, top: centerY - 15 }]}
          >
            <View style={styles.labelContainer}>
              <Text style={styles.labelText} numberOfLines={1}>{value}</Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </React.Fragment>
    );
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (photoId) {
        const updatedPhoto = await localDB.updatePhotoMarkers(itemId, photoId, markers);
        const serverId = updatedPhoto?._serverId || (String(photoId).startsWith('local_') ? null : photoId);
        if (serverId) {
          try {
            await api.put(`/photos/${serverId}`, { markers });
            const queue = await localDB.getSyncQueue();
            const lastOp = queue.find(op => op.type === 'UPDATE' && op.entity === 'photo' && op.localId === photoId);
            if (lastOp) {
              await localDB.removeSyncItem(lastOp.id);
            }
          } catch (e) {}
        }
        navigation.goBack();
        return;
      }

      const permanentUri = await saveAndCompressImage(photo);
      
      const newPhoto = await localDB.createPhoto(itemId, {
        localFileUri: permanentUri,
        markers: markers,
        item_id: itemId,
      }, true);

      const folderServerId = String(itemId).startsWith('local_') ? null : itemId;

      if (folderServerId) {
        let uploadSuccess = false;
        let serverPhotoData = null;

        try {
          const formData = new FormData();
          formData.append('photo', { uri: permanentUri, type: 'image/jpeg', name: 'photo.jpg' });
          formData.append('item_id', folderServerId);
          if (markers.length > 0) formData.append('markers', JSON.stringify(markers));
          const res = await api.post('/photos', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          if (res.data?.id) {
            uploadSuccess = true;
            serverPhotoData = res.data;
          }
        } catch (e) {
          await localDB.addToSyncQueue({
            type: 'CREATE', entity: 'photo',
            localId: newPhoto.id, itemLocalId: itemId,
            data: { localFileUri: permanentUri, markers, item_id: folderServerId }
          });
        }

        if (uploadSuccess && serverPhotoData) {
          try {
            const photos = await localDB.getPhotos(itemId);
            await localDB.setPhotos(itemId, photos.filter(p => p.id !== newPhoto.id));
            try {
              await removeImage(permanentUri);
            } catch {}
          } catch {}
        }
      } else {
        await localDB.addToSyncQueue({
          type: 'CREATE', entity: 'photo',
          localId: newPhoto.id, itemLocalId: itemId,
          data: { localFileUri: permanentUri, markers, item_id: itemId }
        });
      }

      navigation.goBack();
    } catch (error) {
      setIsSaving(false);
      alert(`Erro ao salvar foto: ${error.message}`);
    }
  };



  if (photo) {
    return (
      <View style={styles.container}>
        <IconButton
          icon="arrow-left"
          iconColor="white"
          containerColor="rgba(0,0,0,0.5)"
          size={24}
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { top: Math.max(insets.top, 16) }]}
        />
        <View style={styles.previewContainer}>
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={handleImageTap} 
            style={[styles.imageContainer, { width: containerWidth, height: containerHeight }]}
          >
            <Image source={{ uri: photo }} style={styles.fullImage} />
            
            <View style={styles.instructionBanner}>
              <Text style={styles.instructionText}>
                {step === 1 ? '1. Toque no ponto inicial' : '2. Toque no ponto final da reta'}
              </Text>
            </View>

            {markers.map(marker => renderLine(marker.start, marker.end, marker.value, marker.id))}
            
            {tempPointA && !lastTap && (
              <View style={[styles.point, { left: tempPointA.x - 6, top: tempPointA.y - 6 }]} />
            )}
            {tempPointA && lastTap && renderLine(tempPointA, lastTap, '', 'temp')}

          </TouchableOpacity>
        </View>

        <View style={isLandscape ? styles.controlsLandscape : [styles.controls, { paddingBottom: insets.bottom + 20 }]}>
          <Button 
            mode="outlined" 
            onPress={handleRetake}
            textColor={isLandscape ? "white" : undefined}
            style={isLandscape ? [styles.buttonLandscape, { borderColor: 'white', backgroundColor: 'rgba(0,0,0,0.5)' }] : null}
            labelStyle={isLandscape ? styles.buttonLabelLandscape : null}
          >
            Tirar Outra
          </Button>
          <Button 
            mode="contained" 
            onPress={handleSave} 
            disabled={isSaving}
            loading={isSaving}
            style={[
              { backgroundColor: theme.colors.accent },
              isLandscape ? styles.buttonLandscape : null
            ]}
            labelStyle={isLandscape ? styles.buttonLabelLandscape : null}
          >
            Salvar Item
          </Button>
        </View>

        <Portal>
          <Modal visible={modalVisible} onDismiss={cancelMarker} contentContainerStyle={styles.modal}>
            <Text style={tokens.typography.h2}>Adicionar Medida</Text>
            <TextInput
              label="Valor (ex: 120cm)"
              value={currentValue}
              onChangeText={setCurrentValue}
              mode="outlined"
              style={styles.input}
              autoFocus
            />
            <Button mode="contained" onPress={addMarker} style={styles.button}>Confirmar</Button>
          </Modal>

          <Modal visible={editModalVisible} onDismiss={cancelEditMarker} contentContainerStyle={styles.modal}>
            <Text style={tokens.typography.h2}>Editar Medida</Text>
            <TextInput
              label="Valor (ex: 120cm)"
              value={editValue}
              onChangeText={setEditValue}
              mode="outlined"
              style={styles.input}
              autoFocus
            />
            <View style={styles.modalButtonsRow}>
              <Button mode="contained" onPress={saveEditedMarker} style={[styles.button, { flex: 1, marginRight: 8 }]}>Salvar</Button>
              <Button mode="outlined" onPress={deleteMarker} labelStyle={{ color: 'red' }} style={{ borderColor: 'red', flex: 1 }}>Excluir</Button>
            </View>
            <Button mode="text" onPress={cancelEditMarker} style={{ marginTop: 10 }}>Cancelar</Button>
          </Modal>
        </Portal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        ref={cameraRef} 
        ratio="16:9"
        responsiveOrientationWhenOrientationLocked={true}
      />
      <IconButton
        icon="arrow-left"
        iconColor="white"
        containerColor="rgba(0,0,0,0.5)"
        size={24}
        onPress={() => navigation.goBack()}
        style={[styles.backButton, { top: Math.max(insets.top, 16) }]}
      />
      <View style={isLandscape ? styles.cameraOverlayLandscape : styles.cameraOverlay}>
        <FAB icon="camera" style={styles.captureFab} onPress={takePicture} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  cameraOverlayLandscape: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 20,
  },
  captureFab: {
    backgroundColor: theme.colors.surface,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
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
  instructionBanner: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  instructionText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  point: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.accent,
    borderWidth: 2,
    borderColor: 'white',
    elevation: 4,
  },
  labelWrapper: {
    position: 'absolute',
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    backgroundColor: 'rgba(33, 43, 54, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  labelText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  controlsLandscape: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    width: 130,
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    backgroundColor: 'transparent',
  },
  buttonLandscape: {
    marginVertical: 4,
    width: '100%',
  },
  buttonLabelLandscape: {
    fontSize: 11,
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 12,
  },
  input: {
    marginVertical: 15,
  },
  button: {
    backgroundColor: theme.colors.primary,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 999,
  },
});
