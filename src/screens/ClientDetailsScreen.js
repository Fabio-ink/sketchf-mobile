import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Text, Surface, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { theme, tokens } from '../theme/theme';
import * as localDB from '../services/localDB';
import api from '../services/api';
import NetInfo from '@react-native-community/netinfo';

export default function ClientDetailsScreen({ route, navigation }) {
  const { client } = route.params;
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadClientVisits = async () => {
    try {
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        try {
          const wakeCheck = await api.get('/wake');
          if (wakeCheck.status === 200) {
            const serverId = client._serverId || (String(client.id).startsWith('local_') ? null : client.id);
            if (serverId) {
              const res = await api.get(`/visits/client/${serverId}`);
              if (Array.isArray(res.data)) {

                const localVisits = await localDB.getVisits();

                const filteredLocal = localVisits.filter(v => v.client_id.toString() !== client.id.toString());
                const serverMapped = res.data.map(v => ({ ...v, _serverId: v.id, _isLocal: false, client_id: client.id }));
                await localDB.setVisits([...filteredLocal, ...serverMapped]);
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    const allVisits = await localDB.getVisits();
    const clientVisits = allVisits.filter(v => v.client_id.toString() === client.id.toString());
    setVisits(clientVisits);
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      loadClientVisits();
    });
    return unsubscribe;
  }, [navigation, client]);

  const handleDeleteClient = () => {
    Alert.alert(
      'Excluir Cliente',
      `Tem certeza que deseja excluir "${client.name}"?\nIsso apagará permanentemente o cliente e TODAS as suas visitas e fotos vinculadas!`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            await localDB.deleteClient(client.id);
            if (client._serverId || !String(client.id).startsWith('local_')) {
              try {
                const serverId = client._serverId || client.id;
                await api.delete(`/clients/${serverId}`);
              } catch (e) {}
            }
            Alert.alert('Sucesso', 'Cliente e dados vinculados foram excluídos.');
            navigation.goBack();
          }
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

  const renderVisitCard = ({ item }) => {
    const badge = getStatusBadgeStyle(item.status);
    return (
      <TouchableOpacity 
        style={styles.visitCard}
        onPress={() => navigation.navigate('VisitDetails', { visit: item })}
      >
        <View style={styles.visitCardHeader}>
          <View>
            <Text style={styles.environmentText}>{item.environment}</Text>
            <Text style={styles.visitDate}>{formatVisitDate(item.date)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{item.status}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton 
          icon="arrow-left" 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        />
        <Text style={tokens.typography.h1}>Detalhes do Cliente</Text>
        <IconButton 
          icon="delete" 
          iconColor={theme.colors.error} 
          onPress={handleDeleteClient}
          style={styles.deleteButton}
        />
      </View>

      <FlatList
        data={visits}
        renderItem={renderVisitCard}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <>
            {}
            <Surface style={styles.infoCard}>
              <View style={styles.avatarCircleLarge}>
                <Text style={styles.avatarTextLarge}>{client.name.substring(0, 2).toUpperCase()}</Text>
              </View>
              <Text style={styles.clientNameLarge}>{client.name}</Text>

              <View style={styles.detailsList}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>📞</Text>
                  <Text style={styles.detailText}>{client.phone || 'Nenhum telefone cadastrado'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailIcon}>📍</Text>
                  <Text style={styles.detailText}>{client.address || 'Nenhum endereço cadastrado'}</Text>
                </View>
              </View>

              <Button 
                mode="contained"
                icon="plus"
                onPress={() => navigation.navigate('NewVisitFlow', { preselectedClient: client })}
                style={styles.newVisitBtn}
                labelStyle={styles.newVisitBtnLabel}
              >
                Nova Visita
              </Button>
            </Surface>

            <Text style={[tokens.typography.h2, { marginBottom: tokens.spacing.md, marginTop: tokens.spacing.lg }]}>
              Histórico de Visitas ({visits.length})
            </Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={tokens.typography.subtitle}>Nenhuma visita registrada</Text>
            <Text style={tokens.typography.caption}>Clique no botão "Nova Visita" acima para começar</Text>
          </View>
        }
      />
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
  scrollContent: {
    padding: tokens.spacing.lg,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    padding: tokens.spacing.lg,
    borderRadius: theme.roundness * 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...tokens.shadows.light,
  },
  avatarCircleLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F3F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  avatarTextLarge: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  clientNameLarge: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: tokens.spacing.lg,
  },
  detailsList: {
    width: '100%',
    marginBottom: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.sm,
  },
  detailIcon: {
    fontSize: 18,
    marginRight: tokens.spacing.md,
  },
  detailText: {
    fontSize: 14,
    color: theme.colors.secondary,
    flex: 1,
  },
  newVisitBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 24,
    width: '100%',
    paddingVertical: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  newVisitBtnLabel: {
    fontWeight: '700',
    fontSize: 15,
  },
  visitCard: {
    backgroundColor: theme.colors.surface,
    padding: tokens.spacing.md,
    borderRadius: theme.roundness * 1.5,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...tokens.shadows.light,
  },
  visitCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  environmentText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  visitDate: {
    fontSize: 12,
    color: theme.colors.placeholder,
    marginTop: 2,
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
  emptyContainer: {
    alignItems: 'center',
    marginTop: tokens.spacing.xl,
    padding: tokens.spacing.lg,
  },
});
