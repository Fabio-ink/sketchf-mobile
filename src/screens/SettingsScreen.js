import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Surface, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { theme, tokens } from '../theme/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as localDB from '../services/localDB';
import { syncToServer } from '../services/syncService';
import api from '../services/api';
import NetInfo from '@react-native-community/netinfo';

export default function SettingsScreen({ navigation }) {
  const [syncQueueSize, setSyncQueueSize] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const loadSettingsData = async () => {
    const queue = await localDB.getSyncQueue();
    setSyncQueueSize(queue.length);

    try {
      const token = await AsyncStorage.getItem('token');

      setUserEmail('Operador Técnico');
    } catch (e) {}
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadSettingsData);
    return unsubscribe;
  }, [navigation]);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        Alert.alert('Offline', 'Conecte-se à internet para realizar a sincronização.');
        setSyncing(false);
        return;
      }

      await syncToServer(api);

      const queue = await localDB.getSyncQueue();
      setSyncQueueSize(queue.length);

      if (queue.length === 0) {
        Alert.alert('Sincronização', 'Todos os dados locais foram sincronizados com sucesso!');
      } else {
        Alert.alert('Sincronização', `Alguns itens (${queue.length}) ainda estão na fila.`);
      }
    } catch (e) {
      Alert.alert('Erro', 'Ocorreu um erro durante a sincronização.');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja realmente sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('token');
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={tokens.typography.h1}>Mais</Text>
      </View>

      <View style={styles.content}>
        {}
        <Surface style={styles.userCard}>
          <IconButton icon="account-circle" iconColor={theme.colors.primary} size={48} style={styles.userIcon} />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>sketchF User</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
          </View>
        </Surface>

        {}
        <Surface style={styles.card}>
          <View style={styles.syncRow}>
            <IconButton icon="cloud-sync" iconColor={theme.colors.secondary} size={28} />
            <View style={{ flex: 1, marginLeft: tokens.spacing.sm }}>
              <Text style={styles.cardTitle}>Sincronização Offline</Text>
              <Text style={styles.cardSubtitle}>
                {syncQueueSize === 0 
                  ? 'Todos os dados estão sincronizados.' 
                  : `${syncQueueSize} alteração(ões) pendente(s) de envio.`
                }
              </Text>
            </View>
          </View>

          <Button
            mode="contained"
            icon="sync"
            onPress={handleManualSync}
            loading={syncing}
            disabled={syncing}
            style={styles.syncBtn}
            labelStyle={styles.btnLabel}
          >
            Sincronizar Agora
          </Button>
        </Surface>

        {}
        <Button
          mode="outlined"
          icon="logout"
          onPress={handleLogout}
          style={styles.logoutBtn}
          labelStyle={[styles.btnLabel, { color: theme.colors.error }]}
        >
          Sair da Conta
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: tokens.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  content: {
    padding: tokens.spacing.lg,
    gap: tokens.spacing.lg,
  },
  userCard: {
    backgroundColor: theme.colors.surface,
    padding: tokens.spacing.md,
    borderRadius: theme.roundness * 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...tokens.shadows.light,
  },
  userIcon: {
    margin: 0,
  },
  userDetails: {
    marginLeft: tokens.spacing.md,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  userEmail: {
    fontSize: 13,
    color: theme.colors.placeholder,
    marginTop: 2,
  },
  card: {
    backgroundColor: theme.colors.surface,
    padding: tokens.spacing.md,
    borderRadius: theme.roundness * 1.5,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...tokens.shadows.light,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme.colors.placeholder,
    marginTop: 2,
  },
  syncBtn: {
    backgroundColor: theme.colors.primary,
    marginTop: tokens.spacing.md,
    borderRadius: 20,
  },
  logoutBtn: {
    borderColor: theme.colors.error,
    borderRadius: 20,
    marginTop: tokens.spacing.lg,
  },
  btnLabel: {
    fontWeight: '700',
    fontSize: 14,
  },
});
