import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Platform } from 'react-native';
import { Text, Surface, FAB, ActivityIndicator, IconButton, Modal, Portal, Button, TextInput } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme, tokens } from '../theme/theme';
import * as localDB from '../services/localDB';
import api from '../services/api';

export default function ProjectListScreen({ navigation }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  
  const [editName, setEditName] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editAddress, setEditAddress] = useState('');

  const loadLocalProjects = async () => {
    const local = await localDB.getProjects();
    setProjects(local);
    setLoading(false);
    setRefreshing(false);
  };

  const fetchFromServer = async () => {
    try {
      const response = await api.get('/projects');
      if (Array.isArray(response.data)) {
        const merged = await localDB.mergeServerProjects(response.data);
        setProjects(merged);
      }
    } catch (error) {}
  };

  const refreshData = async () => {
    await loadLocalProjects();
    await fetchFromServer();
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', refreshData);

    navigation.setOptions({
      headerRight: () => (
        <IconButton icon="logout" onPress={handleLogout} />
      ),
    });

    return unsubscribe;
  }, [navigation]);

  const handleLogout = async () => {
    const doLogout = async () => {
      await AsyncStorage.removeItem('token');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Tem certeza que deseja sair?')) doLogout();
      return;
    }

    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', onPress: doLogout }
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const handleLongPress = (project) => {
    setSelectedProject(project);
    setActionModalVisible(true);
  };

  const handleDeleteProject = () => {
    setActionModalVisible(false);
    Alert.alert(
      'Excluir Projeto',
      `Tem certeza que deseja excluir "${selectedProject?.name}"?\nIsso apagará TODAS as pastas e fotos!`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            await localDB.deleteProject(selectedProject.id);
            setProjects(prev => prev.filter(p => p.id !== selectedProject.id));
            
            if (selectedProject._serverId || !String(selectedProject.id).startsWith('local_')) {
              try {
                const serverId = selectedProject._serverId || selectedProject.id;
                await api.delete(`/projects/${serverId}`);
              } catch (e) {}
            }
          }
        }
      ]
    );
  };

  const openEditModal = () => {
    setActionModalVisible(false);
    setEditName(selectedProject.name || '');
    setEditClient(selectedProject.client_name || '');
    setEditAddress(selectedProject.address || '');
    setEditModalVisible(true);
  };

  const handleEditSubmit = async () => {
    if (!editName) {
      Alert.alert('Erro', 'O nome do projeto é obrigatório.');
      return;
    }
    const data = { name: editName, client_name: editClient, address: editAddress };
    
    await localDB.updateProject(selectedProject.id, data);
    setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, ...data } : p));
    setEditModalVisible(false);
    
    if (selectedProject._serverId || !String(selectedProject.id).startsWith('local_')) {
      try {
        const serverId = selectedProject._serverId || selectedProject.id;
        await api.put(`/projects/${serverId}`, data);
      } catch (e) {}
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      onPress={() => navigation.navigate('ProjectDetails', { project: item })}
      onLongPress={() => handleLongPress(item)}
      delayLongPress={500}
    >
      <Surface style={[styles.projectCard, item._isLocal && styles.offlineCard]}>
        <View style={{ flex: 1 }}>
          <Text style={tokens.typography.h2}>{item.name}</Text>
          <Text style={tokens.typography.caption}>{item.client_name || 'Sem cliente'}</Text>
          {item._isLocal && <Text style={styles.offlineBadge}>⏱ Offline</Text>}
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.items_count || 0} Itens</Text>
        </View>
      </Surface>
    </TouchableOpacity>
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
        data={projects}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.accent]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={tokens.typography.subtitle}>Nenhum projeto encontrado</Text>
            <Text style={tokens.typography.caption}>Clique no + para começar</Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('AddProject')}
        color="white"
      />

      <Portal>
        <Modal 
          visible={actionModalVisible} 
          onDismiss={() => setActionModalVisible(false)} 
          contentContainerStyle={styles.modal}
        >
          <Text style={[tokens.typography.h2, { marginBottom: 16, textAlign: 'center' }]}>
            {selectedProject?.name}
          </Text>
          
          <Button 
            mode="contained" 
            onPress={openEditModal}
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
          >
            Editar Projeto
          </Button>
          
          <Button 
            mode="contained" 
            onPress={handleDeleteProject}
            style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
          >
            Excluir Projeto
          </Button>
        </Modal>

        <Modal 
          visible={editModalVisible} 
          onDismiss={() => setEditModalVisible(false)} 
          contentContainerStyle={styles.modal}
        >
          <Text style={[tokens.typography.h2, { marginBottom: 16 }]}>Editar Projeto</Text>
          
          <TextInput
            label="Nome do Projeto *"
            value={editName}
            onChangeText={setEditName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Cliente (opcional)"
            value={editClient}
            onChangeText={setEditClient}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Endereço (opcional)"
            value={editAddress}
            onChangeText={setEditAddress}
            mode="outlined"
            style={styles.input}
            multiline
          />
          
          <View style={styles.modalActions}>
            <Button onPress={() => setEditModalVisible(false)}>Cancelar</Button>
            <Button mode="contained" onPress={handleEditSubmit}>Salvar</Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: tokens.spacing.md, paddingBottom: 100 },
  projectCard: {
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
    borderRadius: theme.roundness * 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...tokens.shadows.light,
  },
  offlineCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  offlineBadge: {
    fontSize: 10,
    color: '#f59e0b',
    marginTop: 2,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: theme.colors.border,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: theme.roundness,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  fab: {
    position: 'absolute',
    margin: tokens.spacing.lg,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.accent,
  },
  empty: { marginTop: 100, alignItems: 'center' },
  modal: {
    backgroundColor: 'white',
    padding: 24,
    margin: 20,
    borderRadius: theme.roundness * 2,
  },
  actionButton: { marginBottom: 12, paddingVertical: 4 },
  input: { marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 8 },
});
