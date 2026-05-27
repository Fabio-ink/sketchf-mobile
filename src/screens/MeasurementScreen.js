import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Dimensions, useWindowDimensions, Alert } from 'react-native';
import { Text, FAB, Portal, Modal, Button, IconButton, TextInput } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, tokens } from '../theme/theme';
import api from '../services/api';
import { saveAndCompressImage, removeImage } from '../services/imageStorage';
import * as localDB from '../services/localDB';
import NetInfo from '@react-native-community/netinfo';

export default function MeasurementScreen({ route, navigation }) {
  const params = route.params || {};
  const visitId = params.visitId || params.itemId || 'temp';
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

  const { width: currentWidth, height: currentHeight } = useWindowDimensions();
  const [layoutDims, setLayoutDims] = useState({ width: currentWidth, height: currentHeight });

  useEffect(() => {
    setLayoutDims(prev => {
      // Check if it is an orientation change (width and height swap roughly)
      const isOrientationChange = Math.abs(currentWidth - prev.height) < 50 && Math.abs(currentHeight - prev.width) < 50;
      // Check if height has increased (keyboard closed or full size restored)
      const isIncrease = currentHeight > prev.height;
      
      if (isOrientationChange || isIncrease || prev.height === 0 || prev.width === 0) {
        return { width: currentWidth, height: currentHeight };
      }
      // If height decreases (likely due to keyboard opening) and width is unchanged, ignore the shrink
      return prev;
    });
  }, [currentWidth, currentHeight]);

  const { width, height } = layoutDims;
  const isLandscape = width > height;

  let containerWidth = width;
  let containerHeight = height;

  if (photo) {
    containerWidth = width;
    containerHeight = isLandscape ? height : (height - (insets.bottom + 140));
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
      <View style={[styles.container, styles.centered]}>
        <Text style={{ textAlign: 'center', color: 'white', marginBottom: 12 }}>Precisamos de acesso à câmera</Text>
        <Button mode="contained" onPress={requestPermission}>Permitir Acesso</Button>
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
      setCurrentValue('');
      setModalVisible(true);
    }
  };

  const addMarker = () => {
    if (tempPointA && lastTap && currentValue.trim()) {
      setMarkers([...markers, { 
        start: tempPointA, 
        end: { x: lastTap.x, y: lastTap.y }, 
        value: currentValue.trim(), 
        id: Date.now().toString(),
        canvasWidth: containerWidth,
        canvasHeight: containerHeight
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
        m.id === editingMarkerId ? { ...m, value: editValue.trim() } : m
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

  const renderLine = (start, end, value, id, canvasWidth, canvasHeight) => {
    const scaleX = (canvasWidth && containerWidth) ? (containerWidth / canvasWidth) : 1;
    const scaleY = (canvasHeight && containerHeight) ? (containerHeight / canvasHeight) : 1;

    const scaledStart = { x: start.x * scaleX, y: start.y * scaleY };
    const scaledEnd = { x: end.x * scaleX, y: end.y * scaleY };

    const dx = scaledEnd.x - scaledStart.x;
    const dy = scaledEnd.y - scaledStart.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const centerX = (scaledStart.x + scaledEnd.x) / 2;
    const centerY = (scaledStart.y + scaledEnd.y) / 2;

    return (
      <React.Fragment key={id}>
        <View 
          pointerEvents="none"
          style={{ 
            position: 'absolute', width: length, height: 3, 
            backgroundColor: '#00E676', 
            left: centerX - length / 2, top: centerY - 1.5, 
            transform: [{ rotate: `${angle}deg` }] 
          }} 
        />
        <View pointerEvents="none" style={[styles.point, { left: scaledStart.x - 6, top: scaledStart.y - 6 }]} />
        <View pointerEvents="none" style={[styles.point, { left: scaledEnd.x - 6, top: scaledEnd.y - 6 }]} />

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
      let savedPhotoObj = null;

      if (photoId) {

        const updatedPhoto = await localDB.updatePhotoMarkers(visitId, photoId, markers);
        savedPhotoObj = updatedPhoto;

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
      } else {

        const permanentUri = await saveAndCompressImage(photo);

        const newPhoto = await localDB.createPhoto(visitId, {
          localFileUri: permanentUri,
          markers: markers,
          observations: [],
        }, true);

        savedPhotoObj = newPhoto;

        const visitServerId = String(visitId).startsWith('local_') ? null : visitId;

        if (visitServerId) {
          let uploadSuccess = false;
          let serverPhotoData = null;

          try {
            const formData = new FormData();
            formData.append('photo', { uri: permanentUri, type: 'image/jpeg', name: 'photo.jpg' });
            formData.append('visit_id', visitServerId);
            if (markers.length > 0) formData.append('markers', JSON.stringify(markers));
            const res = await api.post('/photos', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data?.id) {
              uploadSuccess = true;
              serverPhotoData = res.data;
            }
          } catch (e) {
            await localDB.addToSyncQueue({
              type: 'CREATE', entity: 'photo',
              localId: newPhoto.id, visitLocalId: visitId,
              data: { localFileUri: permanentUri, markers, visit_id: visitServerId }
            });
          }

          if (uploadSuccess && serverPhotoData) {
            try {
              const photos = await localDB.getPhotos(visitId);
              const updatedList = photos.map(p => p.id === newPhoto.id 
                ? { ...p, id: serverPhotoData.id, _serverId: serverPhotoData.id, _isLocal: false }
                : p
              );
              await localDB.setPhotos(visitId, updatedList);
              savedPhotoObj = updatedList.find(p => p._serverId === serverPhotoData.id);
              try {
                await removeImage(permanentUri);
              } catch {}
            } catch {}
          }
        } else {
          await localDB.addToSyncQueue({
            type: 'CREATE', entity: 'photo',
            localId: newPhoto.id, visitLocalId: visitId,
            data: { localFileUri: permanentUri, markers, visit_id: visitId }
          });
        }
      }

      setIsSaving(false);

      Alert.alert(
        'Observações',
        'Deseja adicionar observações a esta foto?',
        [
          {
            text: 'Não',
            onPress: () => navigation.goBack()
          },
          {
            text: 'Sim',
            onPress: () => {
              navigation.replace('PhotoObservations', { 
                photoId: savedPhotoObj.id, 
                visitId: visitId 
              });
            }
          }
        ],
        { cancelable: false }
      );

    } catch (error) {
      setIsSaving(false);
      Alert.alert('Erro', `Erro ao salvar foto: ${error.message}`);
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
        <View 
          pointerEvents="none" 
          style={[styles.instructionBanner, { top: Math.max(insets.top, 16) + 4 }]}
        >
          <Text style={styles.instructionText}>
            {step === 1 ? '1. Toque no ponto inicial' : '2. Toque no ponto final da reta'}
          </Text>
        </View>
        <View style={styles.previewContainer}>
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={handleImageTap} 
            style={[styles.imageContainer, { width: containerWidth, height: containerHeight }]}
          >
            <Image source={{ uri: photo }} style={styles.fullImage} resizeMode="cover" />

            {markers.map(marker => renderLine(marker.start, marker.end, marker.value, marker.id, marker.canvasWidth, marker.canvasHeight))}

            {tempPointA && !lastTap && (
              <View pointerEvents="none" style={[styles.point, { left: tempPointA.x - 6, top: tempPointA.y - 6 }]} />
            )}
            {tempPointA && lastTap && renderLine(tempPointA, lastTap, '', 'temp')}

          </TouchableOpacity>
        </View>

        <View 
          pointerEvents={isLandscape ? "box-none" : "auto"}
          style={isLandscape ? styles.controlsLandscape : [styles.controls, { paddingBottom: insets.bottom + 20 }]}
        >
          <Button 
            mode="outlined" 
            onPress={handleRetake}
            textColor={isLandscape ? "white" : undefined}
            style={isLandscape ? [styles.buttonLandscape, { borderColor: 'white', backgroundColor: 'rgba(0,0,0,0.5)' }] : {}}
            labelStyle={isLandscape ? styles.buttonLabelLandscape : {}}
          >
            Tirar Outra
          </Button>
          <Button 
            mode="contained" 
            onPress={handleSave} 
            disabled={isSaving}
            loading={isSaving}
            style={[
              { backgroundColor: theme.colors.primary },
              isLandscape ? styles.buttonLandscape : {}
            ]}
            labelStyle={isLandscape ? styles.buttonLabelLandscape : {}}
          >
            Salvar Foto
          </Button>
        </View>

        {}
        <Portal>
          <Modal visible={modalVisible} onDismiss={cancelMarker} contentContainerStyle={styles.modal}>
            <Text style={tokens.typography.h2}>Adicionar Medida</Text>
            <TextInput
              label="Valor (ex: 2,45m ou 120cm)"
              value={currentValue}
              onChangeText={setCurrentValue}
              mode="outlined"
              style={styles.input}
              autoFocus
            />
            <Button mode="contained" onPress={addMarker} disabled={!currentValue.trim()} style={styles.button}>Confirmar</Button>
          </Modal>

          <Modal visible={editModalVisible} onDismiss={cancelEditMarker} contentContainerStyle={styles.modal}>
            <Text style={tokens.typography.h2}>Editar Medida</Text>
            <TextInput
              label="Valor (ex: 2,45m ou 120cm)"
              value={editValue}
              onChangeText={setEditValue}
              mode="outlined"
              style={styles.input}
              autoFocus
            />
            <View style={styles.modalButtonsRow}>
              <Button mode="contained" onPress={saveEditedMarker} disabled={!editValue.trim()} style={[styles.button, { flex: 1, marginRight: 8 }]}>Salvar</Button>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
    left: 80,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 999,
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
    backgroundColor: '#00E676',
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
    backgroundColor: 'rgba(22, 29, 100, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#00E676',
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
    backgroundColor: 'rgba(255,255,255,0.85)',
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
    padding: 24,
    margin: 20,
    borderRadius: theme.roundness * 2,
    ...tokens.shadows.medium,
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
