import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { Text, Surface, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { theme, tokens } from '../theme/theme';
import * as localDB from '../services/localDB';
import api from '../services/api';
import NetInfo from '@react-native-community/netinfo';

export default function DashboardScreen({ navigation }) {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [stats, setStats] = useState({ totalThisMonth: 0, inProgress: 0, completed: 0 });

  const checkConnectionAndLoad = async () => {
    try {
      const netState = await NetInfo.fetch();
      let serverOnline = false;

      if (netState.isConnected) {
        try {

          const wakeCheck = await Promise.race([
            api.get('/wake'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
          ]);
          if (wakeCheck.status === 200) {
            serverOnline = true;
          }
        } catch (e) {
          console.log('[Dashboard] Server wake check failed, falling back to offline storage');
        }
      }

      setIsOnline(serverOnline);

      if (serverOnline) {
        try {
          const clientsRes = await api.get('/clients');
          const visitsRes = await api.get('/visits');

          if (Array.isArray(clientsRes.data)) {
            await localDB.mergeServerClients(clientsRes.data);
          }
          if (Array.isArray(visitsRes.data)) {
            await localDB.mergeServerVisits(visitsRes.data);
          }
        } catch (err) {
          console.log('[Dashboard] Server sync error:', err);
        }
      }
    } catch (e) {
      setIsOnline(false);
    }

    const localVisits = await localDB.getVisits();
    setVisits(localVisits.slice(0, 3)); 

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthVisits = localVisits.filter(v => {
      const vDate = new Date(v.date);
      return vDate.getMonth() === currentMonth && vDate.getFullYear() === currentYear;
    });

    const inProgress = localVisits.filter(v => v.status === 'Em andamento').length;
    const completed = localVisits.filter(v => v.status === 'Concluído').length;

    setStats({
      totalThisMonth: thisMonthVisits.length,
      inProgress,
      completed,
    });

    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      checkConnectionAndLoad();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await checkConnectionAndLoad();
    setRefreshing(false);
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
        style={styles.recentCard}
        onPress={() => navigation.navigate('VisitDetails', { visit: item })}
      >
        <View style={styles.recentCardHeader}>
          <View style={styles.recentTextInfo}>
            <Text style={styles.clientName}>{item.client_name || 'Sem nome'}</Text>
            <Text style={styles.environmentName}>{item.environment}</Text>
            <Text style={styles.visitDate}>{formatVisitDate(item.date)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>{item.status}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.appHeader}>
        <View>
          <Text style={tokens.typography.h1}>sketchF</Text>
          <Text style={styles.subGreeting}>Olá! Aqui está o resumo das suas visitas</Text>
        </View>
        <View style={styles.connectionIndicator}>
          <IconButton 
            icon={isOnline ? "wifi" : "wifi-off"} 
            iconColor={isOnline ? theme.colors.statusCompletedText : theme.colors.error} 
            size={22}
          />
          <Text style={[styles.connectionText, { color: isOnline ? theme.colors.statusCompletedText : theme.colors.error }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <FlatList
        data={visits}
        renderItem={renderVisitCard}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
        ListHeaderComponent={
          <>
            {/* Stats Dashboard */}
            <View style={styles.statsContainer}>
              <View style={[styles.statBox, { backgroundColor: theme.colors.statusInProg }]}>
                <Text style={styles.statNumber}>{stats.totalThisMonth}</Text>
                <Text style={styles.statLabel}>Visitas este mês</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: '#FFF0F0' }]}>
                <Text style={[styles.statNumber, { color: theme.colors.error }]}>{stats.inProgress}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.error }]}>Em andamento</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: theme.colors.statusCompleted }]}>
                <Text style={[styles.statNumber, { color: theme.colors.statusCompletedText }]}>{stats.completed}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.statusCompletedText }]}>Concluídos</Text>
              </View>
            </View>

            {}
            <Button 
              mode="contained" 
              onPress={() => navigation.navigate('NewVisitFlow')}
              style={styles.newVisitButton}
              labelStyle={styles.newVisitButtonLabel}
              icon="plus"
            >
              Nova visita
            </Button>

            <View style={styles.sectionHeader}>
              <Text style={tokens.typography.h2}>Visitas recentes</Text>
              <TouchableOpacity onPress={() => navigation.navigate('VisitasTab')}>
                <Text style={styles.viewAllText}>Ver todas</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={tokens.typography.subtitle}>Nenhuma visita recente encontrada</Text>
            <Text style={tokens.typography.caption}>Toque em Nova Visita para começar</Text>
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
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xl,
    paddingBottom: tokens.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  subGreeting: {
    fontSize: 13,
    color: theme.colors.placeholder,
    marginTop: 2,
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F3F9',
    borderRadius: 20,
    paddingRight: tokens.spacing.sm,
  },
  connectionText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    padding: tokens.spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.lg,
    gap: tokens.spacing.sm,
  },
  statBox: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: theme.roundness * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...tokens.shadows.light,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.secondary,
    textAlign: 'center',
    marginTop: 4,
  },
  newVisitButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: tokens.spacing.xs,
    borderRadius: 30,
    marginBottom: tokens.spacing.xl,
    ...tokens.shadows.medium,
  },
  newVisitButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  viewAllText: {
    color: theme.colors.secondary,
    fontWeight: '700',
    fontSize: 14,
  },
  recentCard: {
    backgroundColor: theme.colors.surface,
    padding: tokens.spacing.md,
    borderRadius: theme.roundness * 1.5,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...tokens.shadows.light,
  },
  recentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recentTextInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  environmentName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.secondary,
    marginTop: 2,
  },
  visitDate: {
    fontSize: 11,
    color: theme.colors.placeholder,
    marginTop: 4,
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
