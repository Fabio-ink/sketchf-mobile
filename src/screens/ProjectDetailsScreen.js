import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Image } from 'react-native';
import { Text, Surface, FAB, ActivityIndicator, IconButton, Menu, Portal, Modal, Button, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, tokens } from '../theme/theme';
import * as localDB from '../services/localDB';
import api from '../services/api';

export default function ProjectDetailsScreen({ route, navigation }) {
  const { project } = route.params;
  const insets = useSafeAreaInsets();
  
  const [items, setItems] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [visibleMenu, setVisibleMenu] = useState(null);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [selectedItemForMove, setSelectedItemForMove] = useState(null);
  const [createFolderModalVisible, setCreateFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const loadLocalItems = async () => {
    const local = await localDB.getItems(project.id);
    setItems(local);
    setLoading(false);
    setRefreshing(false);
  };

  const fetchFromServer = async () => {
    const projectServerId = project._serverId || (String(project.id).startsWith('local_') ? null : project.id);
    if (!projectServerId) return;

    try {
      const response = await api.get(`/items/${projectServerId}`);
      if (Array.isArray(response.data)) {
        const merged = await localDB.mergeServerItems(project.id, response.data);
        setItems(merged);
      }
    } catch (error) {}
  };

  const refreshData = async () => {
    await loadLocalItems();
    await fetchFromServer();
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', refreshData);
    navigation.setOptions({ title: project.name });
    
    localDB.getProjects().then(ps => setAllProjects(ps.filter(p => p.id !== project.id)));

    return unsubscribe;
  }, [navigation, project]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      Alert.alert('Erro', 'Nome da pasta é obrigatório');
      return;
    }

    const newItem = await localDB.createItem(project.id, { name: newFolderName, description: '' }, true);
    setItems(prev => [newItem, ...prev]);
    setCreateFolderModalVisible(false);
    setNewFolderName('');

    const projectServerId = project._serverId || (String(project.id).startsWith('local_') ? null : project.id);

    if (projectServerId) {
      try {
        const res = await api.post('/items', { project_id: projectServerId, name: newFolderName, description: '' });
        if (res.data?.id) {
          const items = await localDB.getItems(project.id);
          await localDB.setItems(project.id, items.filter(i => i.id !== newItem.id));
          setItems(prev => prev.map(i =>
            i.id === newItem.id ? { ...i, id: res.data.id, _serverId: res.data.id, _isLocal: false } : i
          ));
        }
      } catch (e) {
        await localDB.addToSyncQueue({
          type: 'CREATE', entity: 'item',
          localId: newItem.id, projectLocalId: project.id,
          data: { name: newFolderName, description: '', project_id: projectServerId }
        });
      }
    } else {
      await localDB.addToSyncQueue({
        type: 'CREATE', entity: 'item',
        localId: newItem.id, projectLocalId: project.id,
        data: { name: newFolderName, description: '', project_id: project.id }
      });
    }
  };


  const handleDelete = (itemId) => {
    setVisibleMenu(null);
    Alert.alert(
      'Excluir Pasta',
      'Tem certeza que deseja excluir esta pasta e TODAS as suas fotos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            await localDB.deleteItem(project.id, itemId);
            setItems(prev => prev.filter(item => item.id !== itemId));

            const item = items.find(i => i.id === itemId);
            const serverId = item?._serverId || (String(itemId).startsWith('local_') ? null : itemId);
            if (serverId) {
              api.delete(`/items/${serverId}`).catch(() => {});
            }
          }
        }
      ]
    );
  };

  const openMoveModal = (item) => {
    setVisibleMenu(null);
    setSelectedItemForMove(item);
    setMoveModalVisible(true);
  };

  const handleMove = async (newProjectId) => {
    try {
      const item = selectedItemForMove;
      const serverId = item._serverId || (String(item.id).startsWith('local_') ? null : item.id);
      if (serverId) {
        await api.put(`/items/${serverId}/move`, { newProjectId });
      }
      setMoveModalVisible(false);
      setItems(prev => prev.filter(i => i.id !== item.id));
      setSelectedItemForMove(null);
      Alert.alert('Sucesso', 'Pasta movida com sucesso!');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível mover a pasta.');
    }
  };

  const renderItem = ({ item }) => (
    <Surface style={[styles.itemCard, item._isLocal && styles.offlineCard]}>
      <TouchableOpacity 
        activeOpacity={0.8} 
        onPress={() => navigation.navigate('FolderDetails', { folder: item, project })}
      >
        {item.cover_image ? (
          <Image source={{ uri: item.cover_image }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.noImage]}>
            <Text style={tokens.typography.h2}>📁</Text>
            <Text style={tokens.typography.caption}>Pasta Vazia</Text>
          </View>
        )}
      </TouchableOpacity>
      
      <View style={styles.itemFooter}>
        <View style={styles.itemInfo}>
          <Text style={tokens.typography.h3}>{item.name}</Text>
          <Text style={tokens.typography.caption}>
            {item.photos_count} {item.photos_count == 1 ? 'foto' : 'fotos'}
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
          <Menu.Item onPress={() => openMoveModal(item)} title="Mover para outro projeto" leadingIcon="folder-move" />
          <Menu.Item onPress={() => handleDelete(item.id)} title="Excluir Pasta" leadingIcon="delete" titleStyle={{color: 'red'}} />
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
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.accent]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={tokens.typography.subtitle}>Nenhuma pasta neste projeto</Text>
            <Text style={tokens.typography.caption}>Clique no + para adicionar</Text>
          </View>
        }
      />
      
      <FAB
        icon="folder-plus"
        style={[styles.fab, { bottom: Math.max(insets.bottom + 16, 16) }]}
        onPress={() => setCreateFolderModalVisible(true)}
        color="white"
      />

      <Portal>
        <Modal 
          visible={createFolderModalVisible} 
          onDismiss={() => setCreateFolderModalVisible(false)} 
          contentContainerStyle={styles.modal}
        >
          <Text style={[tokens.typography.h2, {marginBottom: 16}]}>Nova Pasta</Text>
          <TextInput
            label="Nome da Pasta (ex: Cozinha)"
            value={newFolderName}
            onChangeText={setNewFolderName}
            mode="outlined"
            style={{ marginBottom: 16 }}
            autoFocus
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Button onPress={() => setCreateFolderModalVisible(false)}>Cancelar</Button>
            <Button mode="contained" onPress={handleCreateFolder}>Criar</Button>
          </View>
        </Modal>

        <Modal 
          visible={moveModalVisible} 
          onDismiss={() => setMoveModalVisible(false)} 
          contentContainerStyle={styles.modal}
        >
          <Text style={[tokens.typography.h2, {marginBottom: 16}]}>Mover para qual projeto?</Text>
          {allProjects.length === 0 ? (
            <Text style={tokens.typography.caption}>Você não tem outros projetos.</Text>
          ) : (
            <FlatList
              data={allProjects}
              keyExtractor={p => p.id.toString()}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.projectListItem}
                  onPress={() => handleMove(item._serverId || item.id)}
                >
                  <Text style={tokens.typography.body}>{item.name}</Text>
                  <IconButton icon="chevron-right" size={20} />
                </TouchableOpacity>
              )}
            />
          )}
          <Button mode="text" onPress={() => setMoveModalVisible(false)} style={{marginTop: 16}}>
            Cancelar
          </Button>
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
  noImage: { justifyContent: 'center', alignItems: 'center' },
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
  modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 12 },
  projectListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
});
