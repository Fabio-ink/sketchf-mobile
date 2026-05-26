import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Text, Surface, TextInput, ActivityIndicator, FAB, Portal, Modal, Button, IconButton } from 'react-native-paper';
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

export default function ClientsScreen({ navigation }) {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    try {
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        try {
          const wakeCheck = await api.get('/wake');
          if (wakeCheck.status === 200) {
            const res = await api.get('/clients');
            if (Array.isArray(res.data)) {
              await localDB.mergeServerClients(res.data);
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    const localClients = await localDB.getClients();
    setClients(localClients);
    applySearch(localClients, search);
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      loadData();
    });
    return unsubscribe;
  }, [navigation, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const applySearch = (clientsList, query) => {
    if (query.trim() === '') {
      setFilteredClients(clientsList);
    } else {
      const q = query.toLowerCase();
      const filtered = clientsList.filter(c => 
        c.name.toLowerCase().includes(q) || 
        (c.phone && c.phone.includes(q)) || 
        (c.address && c.address.toLowerCase().includes(q))
      );
      setFilteredClients(filtered);
    }
  };

  const handleSearchChange = (text) => {
    setSearch(text);
    applySearch(clients, text);
  };

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
        const formattedAddress = `${addr.street || ''}, ${addr.name || ''} - ${addr.subregion || addr.district || ''}, ${addr.city || addr.subregion || ''} - ${addr.region || ''}`;
        const cleanAddress = formattedAddress.replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').trim();
        setNewClientAddress(cleanAddress);
      } else {
        setNewClientAddress(`Lat: ${latitude.toFixed(6)}, Lon: ${longitude.toFixed(6)}`);
      }
    } catch (e) {
      console.log('Error reverse geocoding:', e);
      Alert.alert('Erro', 'Não foi possível obter a localização atual automaticamente.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleAddClient = async () => {
    if (!newClientName.trim()) {
      Alert.alert('Erro', 'O nome do cliente é obrigatório.');
      return;
    }

    setIsSaving(true);
    const clientData = {
      name: newClientName,
      phone: newClientPhone,
      address: newClientAddress,
    };

    try {

      const newClient = await localDB.createClient(clientData, true);

      const updatedClients = [newClient, ...clients];
      setClients(updatedClients);
      applySearch(updatedClients, search);

      const netState = await NetInfo.fetch();
      let synced = false;
      if (netState.isConnected) {
        try {
          const res = await api.post('/clients', clientData);
          if (res.data?.id) {

            const currentLocalList = await localDB.getClients();
            const updated = currentLocalList.map(c => 
              c.id === newClient.id ? { ...c, id: res.data.id, _serverId: res.data.id, _isLocal: false } : c
            );
            await localDB.setClients(updated);
            setClients(updated);
            applySearch(updated, search);
            synced = true;
          }
        } catch (e) {
          console.log('[Clients] Sync to server failed, staying in queue');
        }
      }

      if (!synced) {
        await localDB.addToSyncQueue({
          type: 'CREATE',
          entity: 'client',
          localId: newClient.id,
          data: clientData
        });
      }

      setNewClientName('');
      setNewClientPhone('');
      setNewClientAddress('');
      setModalVisible(false);
      Alert.alert('Sucesso', 'Cliente cadastrado com sucesso!');
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao salvar o cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderClientItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.clientCard}
      onPress={() => navigation.navigate('ClientDetails', { client: item })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{item.name.substring(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.clientDetails}>
          <Text style={styles.clientName}>{item.name}</Text>
          {item.phone ? (
            <Text style={styles.clientPhone}>📞 {item.phone}</Text>
          ) : null}
          {item.address ? (
            <Text style={styles.clientAddress} numberOfLines={1}>📍 {item.address}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.visitsCountText}>
          {item.visits_count || 0} {item.visits_count === 1 ? 'visita registrada' : 'visitas registradas'}
        </Text>
        {item._isLocal && <Text style={styles.offlineBadge}>⏱ Offline</Text>}
      </View>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={tokens.typography.h1}>Clientes</Text>
        <TextInput
          placeholder="Buscar cliente por nome, telefone ou endereço..."
          value={search}
          onChangeText={handleSearchChange}
          mode="outlined"
          left={<TextInput.Icon icon="magnify" />}
          style={styles.searchInput}
          outlineColor={theme.colors.border}
          activeOutlineColor={theme.colors.primary}
        />
      </View>

      <FlatList
        data={filteredClients}
        renderItem={renderClientItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={tokens.typography.subtitle}>Nenhum cliente cadastrado</Text>
            <Text style={tokens.typography.caption}>Toque no botão + para adicionar um novo cliente</Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        color="white"
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => {
            if (!isSaving && !isFetchingLocation) setModalVisible(false);
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
            disabled={isSaving}
          />

          <TextInput
            label="Telefone (opcional)"
            value={newClientPhone}
            onChangeText={(text) => setNewClientPhone(formatPhone(text))}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
            disabled={isSaving}
            maxLength={15}
          />

          <View style={styles.addressWrapper}>
            <TextInput
              label="Endereço (opcional)"
              value={newClientAddress}
              onChangeText={setNewClientAddress}
              mode="outlined"
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              disabled={isSaving}
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
              disabled={isSaving || isFetchingLocation}
              style={styles.gpsButton}
            />
          </View>

          <View style={styles.modalActions}>
            <Button 
              onPress={() => setModalVisible(false)} 
              disabled={isSaving}
              style={{ marginRight: 8 }}
            >
              Cancelar
            </Button>
            <Button 
              mode="contained" 
              onPress={handleAddClient}
              loading={isSaving}
              disabled={isSaving}
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
  header: {
    padding: tokens.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchInput: {
    marginTop: tokens.spacing.md,
    backgroundColor: theme.colors.background,
    height: 48,
  },
  listContent: {
    padding: tokens.spacing.lg,
    paddingBottom: 100,
  },
  clientCard: {
    backgroundColor: theme.colors.surface,
    padding: tokens.spacing.md,
    borderRadius: theme.roundness * 1.5,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...tokens.shadows.light,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F3F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  clientDetails: {
    marginLeft: tokens.spacing.md,
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  clientPhone: {
    fontSize: 13,
    color: theme.colors.secondary,
    marginTop: 2,
  },
  clientAddress: {
    fontSize: 12,
    color: theme.colors.placeholder,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  visitsCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.placeholder,
  },
  offlineBadge: {
    fontSize: 10,
    color: theme.colors.placeholder,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    margin: tokens.spacing.lg,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: tokens.spacing.xl,
    padding: tokens.spacing.lg,
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
});
