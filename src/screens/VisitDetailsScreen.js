import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView, Image, Alert, Modal, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Surface, Button, ActivityIndicator, IconButton, SegmentedButtons, Portal, TextInput } from 'react-native-paper';
import * as ScreenOrientation from 'expo-screen-orientation';
import { theme, tokens } from '../theme/theme';
import * as localDB from '../services/localDB';
import api from '../services/api';
import NetInfo from '@react-native-community/netinfo';

export default function VisitDetailsScreen({ route, navigation }) {
  const [visit, setVisit] = useState(route.params.visit);

  const [activeTab, setActiveTab] = useState('info'); 
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selectedPhotoAspectRatio, setSelectedPhotoAspectRatio] = useState(null);

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

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedObsIds, setSelectedObsIds] = useState([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingObs, setEditingObs] = useState(null);
  const [editText, setEditText] = useState('');
  const [editColor, setEditColor] = useState('#FFEB3B');

  const toggleObsSelection = (id) => {
    setSelectedObsIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const deleteSelectedObservations = async () => {
    Alert.alert(
      'Excluir Anotações',
      `Deseja realmente excluir as ${selectedObsIds.length} anotações selecionadas?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {

              const photoGroups = {};
              selectedObsIds.forEach(id => {
                const parentPhoto = photos.find(p => p.observations?.some(o => o.id === id));
                if (parentPhoto) {
                  if (!photoGroups[parentPhoto.id]) {
                    photoGroups[parentPhoto.id] = [...parentPhoto.observations];
                  }
                  photoGroups[parentPhoto.id] = photoGroups[parentPhoto.id].filter(o => o.id !== id);
                }
              });

              for (const [photoId, updatedObs] of Object.entries(photoGroups)) {
                await localDB.updatePhotoMarkers(visit.id, photoId, undefined, updatedObs);
              }

              const netState = await NetInfo.fetch();
              if (netState.isConnected) {
                try {
                  await api.get('/wake');
                  const { syncToServer } = require('../services/syncService');
                  syncToServer(api).catch(() => {});
                } catch (e) {}
              }

              Alert.alert('Sucesso', 'Anotações excluídas com sucesso.');
              setSelectedObsIds([]);
              setSelectionMode(false);
              await loadVisitPhotos();
            } catch (err) {
              Alert.alert('Erro', 'Ocorreu um erro ao excluir as anotações.');
            }
          }
        }
      ]
    );
  };

  const saveEditedObservation = async () => {
    if (!editText.trim()) return;
    try {
      const parentPhoto = photos.find(p => p.id === editingObs.photoId);
      if (parentPhoto) {
        const updatedObs = parentPhoto.observations.map(o => 
          o.id === editingObs.id ? { ...o, text: editText.trim(), color: editColor } : o
        );
        await localDB.updatePhotoMarkers(visit.id, parentPhoto.id, undefined, updatedObs);

        const netState = await NetInfo.fetch();
        if (netState.isConnected) {
          try {
            await api.get('/wake');
            const { syncToServer } = require('../services/syncService');
            syncToServer(api).catch(() => {});
          } catch (e) {}
        }

        setEditModalVisible(false);
        setEditingObs(null);
        setEditText('');
        await loadVisitPhotos();
        Alert.alert('Sucesso', 'Anotação atualizada!');
      }
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível salvar a anotação.');
    }
  };

  const loadVisitPhotos = async () => {
    try {
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        try {
          const wakeCheck = await api.get('/wake');
          if (wakeCheck.status === 200) {
            const serverVisitId = visit._serverId || (String(visit.id).startsWith('local_') ? null : visit.id);
            if (serverVisitId) {
              const res = await api.get(`/photos/visit/${serverVisitId}`);
              if (Array.isArray(res.data)) {
                await localDB.mergeServerPhotos(visit.id, res.data);
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    const localPhotos = await localDB.getPhotos(visit.id);
    setPhotos(localPhotos);
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadVisitPhotos();
    });
    return unsubscribe;
  }, [navigation]);

  const handleDeleteVisit = () => {
    Alert.alert(
      'Excluir Visita',
      'Tem certeza que deseja excluir esta visita e todas as suas fotos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            await localDB.deleteVisit(visit.id);
            if (visit._serverId || !String(visit.id).startsWith('local_')) {
              try {
                const serverId = visit._serverId || visit.id;
                await api.delete(`/visits/${serverId}`);
              } catch (e) {}
            }
            Alert.alert('Sucesso', 'Visita excluída com sucesso.');
            navigation.goBack();
          }
        }
      ]
    );
  };

  const updateVisitStatus = async (newStatus) => {
    try {
      setLoading(true);
      const updatedVisit = await localDB.updateVisit(visit.id, { status: newStatus });

      if (visit._serverId || !String(visit.id).startsWith('local_')) {
        const serverId = visit._serverId || visit.id;
        try {
          await api.put(`/visits/${serverId}`, { status: newStatus });
        } catch (e) {

        }
      }

      setVisit(updatedVisit);
      Alert.alert('Sucesso', `Status da visita alterado para "${newStatus}".`);
    } catch (err) {
      Alert.alert('Erro', `Erro ao atualizar status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeStatus = () => {
    const statuses = ['Pendente', 'Em andamento', 'Concluído'];
    const otherStatuses = statuses.filter(s => s !== visit.status);

    Alert.alert(
      'Alterar Status da Visita',
      `O status atual é "${visit.status}". Para qual status deseja alterar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: otherStatuses[0], 
          onPress: () => updateVisitStatus(otherStatuses[0]) 
        },
        { 
          text: otherStatuses[1], 
          onPress: () => updateVisitStatus(otherStatuses[1]) 
        }
      ]
    );
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Em andamento':
        return { bg: theme.colors.statusInProg, text: theme.colors.statusInProgText };
      case 'Pendente':
        return { bg: theme.colors.statusPending, text: theme.colors.statusPendingText };
      case 'Concluído':
        return { bg: theme.colors.statusCompleted, text: theme.colors.statusCompletedText };
      default:
        return { bg: theme.colors.border, text: theme.colors.text };
    }
  };

  const formatVisitDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch (e) {
      return '';
    }
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
            style={{ 
              position: 'absolute', width: length, height: 3, 
              backgroundColor: '#00E676', 
              left: centerX - length / 2, top: centerY - 1.5, 
              transform: [{ rotate: `${angle}deg` }] 
            }} 
          />
          <View style={[styles.point, { left: start.x - 5, top: start.y - 5 }]} />
          <View style={[styles.point, { left: end.x - 5, top: end.y - 5 }]} />

          <View style={[styles.labelWrapper, { left: centerX - 45, top: centerY - 12 }]}>
            <View style={styles.labelContainer}>
              <Text style={styles.labelText} numberOfLines={1}>{marker.value}</Text>
            </View>
          </View>
        </React.Fragment>
      );
    });
  };

  const renderInfoTab = () => {
    const badge = getStatusBadgeStyle(visit.status);
    return (
      <ScrollView style={styles.tabContent}>
        {}
        <Surface style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={tokens.typography.h3}>Status da Visita</Text>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.text }]}>{visit.status}</Text>
            </View>
          </View>
          <Text style={[styles.visitDateText, { marginTop: tokens.spacing.sm }]}>
            Registrada em: {formatVisitDate(visit.date)}
          </Text>
        </Surface>

        {}
        <Surface style={styles.card}>
          <Text style={styles.sectionTitle}>Dados do Cliente</Text>
          <Text style={styles.clientName}>{visit.client_name}</Text>
          {visit.client_phone ? (
            <Text style={styles.infoText}>📞 Telefone: {visit.client_phone}</Text>
          ) : null}
          {visit.client_address ? (
            <Text style={styles.infoText}>📍 Endereço: {visit.client_address}</Text>
          ) : null}
        </Surface>

        {}
        <Surface style={styles.card}>
          <Text style={styles.sectionTitle}>Ambiente</Text>
          <Text style={styles.clientName}>{visit.environment}</Text>
        </Surface>

        {}
        <Surface style={styles.card}>
          <Text style={styles.sectionTitle}>Observações Gerais</Text>
          <Text style={styles.bodyText}>
            {visit.observations || 'Nenhuma observação geral adicionada a esta visita.'}
          </Text>
        </Surface>

        {}
        <Button 
          mode="outlined" 
          icon="swap-horizontal"
          onPress={handleChangeStatus}
          style={styles.statusButton}
          labelStyle={styles.statusButtonLabel}
        >
          Alterar Status da Visita
        </Button>

        {}
        <Button 
          mode="contained" 
          icon="file-pdf-box"
          onPress={() => navigation.navigate('ExportReport', { visit: { ...visit, photos } })}
          style={styles.pdfButton}
          labelStyle={styles.pdfButtonLabel}
        >
          Exportar Relatório PDF
        </Button>
      </ScrollView>
    );
  };

  const renderPhotosTab = () => {
    return (
      <View style={styles.tabContent}>
        <FlatList
          data={photos}
          keyExtractor={item => item.id.toString()}
          numColumns={2}
          columnWrapperStyle={styles.photosRow}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.photoThumbCard}
              onPress={() => {
                setSelectedPhoto(item);
                setViewerVisible(true);
              }}
            >
              <Image source={{ uri: item.image_url }} style={styles.photoThumb} />
              {item.markers?.length > 0 && (
                <View style={styles.cotasBadge}>
                  <Text style={styles.cotasBadgeText}>{item.markers.length} cota(s)</Text>
                </View>
              )}
              {item.observations?.length > 0 && (
                <View style={[styles.cotasBadge, { backgroundColor: '#FFAB00', top: 30 }]}>
                  <Text style={styles.cotasBadgeText}>{item.observations.length} obs</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={tokens.typography.subtitle}>Nenhuma foto cadastrada</Text>
            </View>
          }
        />
      </View>
    );
  };

  const renderObsTab = () => {

    const allObs = [];
    photos.forEach((p, pIdx) => {
      if (p.observations && p.observations.length > 0) {
        p.observations.forEach(obs => {
          allObs.push({
            ...obs,
            photoId: p.id,
            photoUrl: p.image_url,
            photoIndex: pIdx + 1
          });
        });
      }
    });

    return (
      <ScrollView style={styles.tabContent}>
        <Surface style={styles.card}>
          <Text style={styles.sectionTitle}>Observações Gerais da Visita</Text>
          <Text style={styles.bodyText}>
            {visit.observations || 'Nenhuma observação geral adicionada.'}
          </Text>
        </Surface>

        {allObs.length > 0 && (
          <View style={styles.obsListHeaderRow}>
            <Text style={[tokens.typography.h3, { marginVertical: tokens.spacing.xs }]}>
              Anotações das Fotos ({allObs.length})
            </Text>

            {selectionMode ? (
              <View style={styles.selectionActionsRow}>
                <Text style={styles.selectionCountText}>
                  {selectedObsIds.length} sel.
                </Text>
                <IconButton
                  icon="delete"
                  iconColor={theme.colors.error}
                  size={20}
                  style={{ margin: 0 }}
                  disabled={selectedObsIds.length === 0}
                  onPress={deleteSelectedObservations}
                />
                <IconButton
                  icon="close"
                  size={20}
                  style={{ margin: 0 }}
                  onPress={() => {
                    setSelectionMode(false);
                    setSelectedObsIds([]);
                  }}
                />
              </View>
            ) : (
              <Button
                mode="text"
                compact
                icon="select-multiple"
                onPress={() => setSelectionMode(true)}
                labelStyle={{ fontSize: 12, fontWeight: '700' }}
              >
                Selecionar
              </Button>
            )}
          </View>
        )}

        {allObs.map(obs => {
          const isSelected = selectedObsIds.includes(obs.id);
          return (
            <Surface 
              key={obs.id} 
              style={[
                styles.obsCard, 
                { borderLeftColor: obs.color },
                isSelected ? { backgroundColor: '#E0F2F1', borderColor: theme.colors.primary } : {}
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  if (selectionMode) {
                    toggleObsSelection(obs.id);
                  } else {
                    setEditingObs(obs);
                    setEditText(obs.text);
                    setEditColor(obs.color);
                    setEditModalVisible(true);
                  }
                }}
                onLongPress={() => {
                  if (!selectionMode) {
                    setSelectionMode(true);
                    setSelectedObsIds([obs.id]);
                  }
                }}
                style={styles.obsHeader}
              >
                {selectionMode && (
                  <IconButton
                    icon={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                    iconColor={isSelected ? theme.colors.primary : theme.colors.placeholder}
                    size={22}
                    style={{ margin: 0, marginRight: tokens.spacing.xs }}
                  />
                )}
                <Image source={{ uri: obs.photoUrl }} style={styles.obsMiniThumb} />
                <View style={{ marginLeft: tokens.spacing.md, flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.obsPhotoRef}>Foto #{obs.photoIndex}</Text>
                    {!selectionMode && (
                      <IconButton 
                        icon="pencil" 
                        size={14} 
                        style={{ margin: 0, padding: 0 }}
                        onPress={() => {
                          setEditingObs(obs);
                          setEditText(obs.text);
                          setEditColor(obs.color);
                          setEditModalVisible(true);
                        }}
                      />
                    )}
                  </View>
                  <Text style={styles.obsCommentText}>{obs.text}</Text>
                </View>
              </TouchableOpacity>
            </Surface>
          );
        })}

        {allObs.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={tokens.typography.caption}>Nenhuma anotação nas fotos registrada.</Text>
          </View>
        )}
      </ScrollView>
    );
  };

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        />
        <Text style={tokens.typography.h1}>sketchF</Text>
        <IconButton 
          icon="delete" 
          iconColor={theme.colors.error} 
          onPress={handleDeleteVisit}
          style={styles.deleteButton}
        />
      </View>

      {}
      <View style={styles.tabsWrapper}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={setActiveTab}
          buttons={[
            { value: 'info', label: 'Informações', icon: 'information-outline' },
            { value: 'photos', label: 'Fotos', icon: 'image-outline' },
            { value: 'obs', label: 'Observações', icon: 'comment-text-outline' },
          ]}
          theme={{ colors: { primary: theme.colors.primary } }}
        />
      </View>

      {}
      {activeTab === 'info' && renderInfoTab()}
      {activeTab === 'photos' && renderPhotosTab()}
      {activeTab === 'obs' && renderObsTab()}

      {}
      <Modal
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

                  {}
                  <IconButton
                    icon={isMaximized ? "fullscreen-exit" : "fullscreen"}
                    iconColor="white"
                    size={24}
                    containerColor="rgba(0,0,0,0.6)"
                    style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 1000 }}
                    onPress={() => setIsMaximized(!isMaximized)}
                  />
                </View>

                {!isMaximized && (
                  <>
                    {}
                    <Button 
                      mode="contained"
                      icon="square-edit-outline"
                      onPress={() => {
                        setViewerVisible(false);
                        navigation.navigate('Measurement', {
                          visitId: visit.id,
                          photoId: selectedPhoto.id,
                          photoUri: selectedPhoto.image_url,
                          existingMarkers: selectedPhoto.markers || [],
                          aspectRatio: (selectedPhoto.markers && selectedPhoto.markers[0]?.canvasWidth && selectedPhoto.markers[0]?.canvasHeight) 
                            ? (selectedPhoto.markers[0].canvasWidth / selectedPhoto.markers[0].canvasHeight) 
                            : (4 / 3)
                        });
                      }}
                      style={styles.viewerEditBtn}
                      labelStyle={styles.viewerEditBtnLabel}
                    >
                      Editar Medidas / Desenho
                    </Button>

                    {}
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
                  </>
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
      </Modal>

      {}
      <Portal>
        <Modal
          visible={editModalVisible}
          onDismiss={() => {
            setEditModalVisible(false);
            setEditingObs(null);
            setEditText('');
          }}
          contentContainerStyle={styles.editModal}
        >
          <Text style={[tokens.typography.h2, { marginBottom: tokens.spacing.md }]}>Editar Anotação</Text>
          <TextInput
            label="Texto da anotação"
            value={editText}
            onChangeText={setEditText}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.editInput}
            outlineColor={theme.colors.border}
            activeOutlineColor={theme.colors.primary}
          />

          <View style={styles.editColorPaletteRow}>
            <Text style={styles.editColorPaletteLabel}>Cor da tag:</Text>
            <View style={styles.editColorsRow}>
              {[
                { hex: '#FFEB3B', label: 'Amarelo' },
                { hex: '#FFCDD2', label: 'Vermelho' },
                { hex: '#BBDEFB', label: 'Azul' },
                { hex: '#C8E6C9', label: 'Verde' },
                { hex: '#E1BEE7', label: 'Roxo' },
                { hex: '#CFD8DC', label: 'Cinza' }
              ].map(c => {
                const isSelected = editColor === c.hex;
                return (
                  <TouchableOpacity
                    key={c.hex}
                    onPress={() => setEditColor(c.hex)}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c.hex },
                      isSelected ? styles.colorCircleSelected : {}
                    ]}
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.editModalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setEditModalVisible(false);
                setEditingObs(null);
                setEditText('');
              }}
              style={{ flex: 1, marginRight: 8 }}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={saveEditedObservation}
              disabled={!editText.trim()}
              style={{ flex: 1 }}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    margin: 0,
  },
  deleteButton: {
    margin: 0,
  },
  tabsWrapper: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabContent: {
    flex: 1,
    padding: tokens.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: tokens.spacing.md,
    borderRadius: theme.roundness,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...tokens.shadows.light,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.placeholder,
    textTransform: 'uppercase',
    marginBottom: tokens.spacing.xs,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.secondary,
    marginTop: tokens.spacing.xs,
  },
  bodyText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  visitDateText: {
    fontSize: 12,
    color: theme.colors.placeholder,
  },
  statusBadge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pdfButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: tokens.spacing.xs,
    borderRadius: 24,
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xl,
    ...tokens.shadows.medium,
  },
  pdfButtonLabel: {
    fontWeight: '700',
    fontSize: 15,
  },
  photosRow: {
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  photoThumbCard: {
    width: '48%',
    height: 150,
    borderRadius: theme.roundness,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
    ...tokens.shadows.light,
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  cotasBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cotasBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '700',
  },
  obsCard: {
    backgroundColor: theme.colors.surface,
    padding: tokens.spacing.md,
    borderRadius: theme.roundness,
    marginBottom: tokens.spacing.sm,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...tokens.shadows.light,
  },
  obsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  obsMiniThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  obsPhotoRef: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  obsCommentText: {
    fontSize: 13,
    color: theme.colors.text,
    marginTop: 2,
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 4,
  },
  viewerObsScroll: {
    paddingVertical: tokens.spacing.xs,
  },
  viewerObsItem: {
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    borderLeftWidth: 4,
    marginBottom: tokens.spacing.xs,
    backgroundColor: theme.colors.background,
  },
  viewerObsItemText: {
    fontSize: 13,
    color: theme.colors.text,
  },
  noViewerObsText: {
    fontSize: 12,
    color: theme.colors.placeholder,
    textAlign: 'center',
    marginTop: tokens.spacing.md,
  },
  viewerEditBtn: {
    backgroundColor: '#00E676', 
    marginVertical: tokens.spacing.xs,
    borderRadius: 20,
    alignSelf: 'center',
    width: '100%',
  },
  viewerEditBtnLabel: {
    fontWeight: '700',
    color: '#161D64', 
  },
  obsListHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  selectionActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  editModal: {
    backgroundColor: 'white',
    padding: tokens.spacing.lg,
    margin: tokens.spacing.lg,
    borderRadius: theme.roundness,
  },
  editInput: {
    backgroundColor: 'white',
    marginBottom: tokens.spacing.md,
  },
  editColorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.lg,
  },
  editColorPaletteLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.secondary,
  },
  editColorsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CFD8DC',
  },
  colorCircleSelected: {
    borderColor: '#37474F',
    borderWidth: 2.5,
    transform: [{ scale: 1.15 }],
  },
  editModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusButton: {
    borderColor: theme.colors.primary,
    paddingVertical: tokens.spacing.xs,
    borderRadius: 24,
    marginTop: tokens.spacing.md,
  },
  statusButtonLabel: {
    fontWeight: '700',
    fontSize: 15,
    color: theme.colors.primary,
  },
});
