import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Surface, TextInput, ActivityIndicator } from 'react-native-paper';
import { theme, tokens } from '../theme/theme';
import * as localDB from '../services/localDB';
import api from '../services/api';
import NetInfo from '@react-native-community/netinfo';

export default function VisitsScreen({ navigation }) {
  const [visits, setVisits] = useState([]);
  const [filteredVisits, setFilteredVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('Todos'); 

  const loadData = async () => {
    try {
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        try {
          const wakeCheck = await api.get('/wake');
          if (wakeCheck.status === 200) {
            const res = await api.get('/visits');
            if (Array.isArray(res.data)) {
              await localDB.mergeServerVisits(res.data);
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    const localVisits = await localDB.getVisits();
    setVisits(localVisits);
    applyFilters(localVisits, activeTab, search);
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      loadData();
    });
    return unsubscribe;
  }, [navigation, activeTab, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const applyFilters = (visitsList, tab, query) => {
    let result = [...visitsList];

    if (tab !== 'Todos') {
      result = result.filter(v => v.status === tab);
    }

    if (query.trim() !== '') {
      const q = query.toLowerCase();
      result = result.filter(v => 
        (v.client_name && v.client_name.toLowerCase().includes(q)) || 
        (v.environment && v.environment.toLowerCase().includes(q)) ||
        (v.client_address && v.client_address.toLowerCase().includes(q))
      );
    }

    setFilteredVisits(result);
  };

  const handleTabPress = (tab) => {
    setActiveTab(tab);
    applyFilters(visits, tab, search);
  };

  const handleSearchChange = (text) => {
    setSearch(text);
    applyFilters(visits, activeTab, text);
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

  const renderVisitItem = ({ item }) => {
    const badge = getStatusBadgeStyle(item.status);
    return (
      <TouchableOpacity 
        style={styles.visitCard}
        onPress={() => navigation.navigate('VisitDetails', { visit: item })}
      >
        <View style={styles.cardLayout}>
          <View style={styles.leftInfo}>
            <Text style={styles.clientName}>{item.client_name || 'Sem nome'}</Text>
            <Text style={styles.environmentName}>{item.environment}</Text>
            <Text style={styles.visitDate}>{formatVisitDate(item.date)}</Text>
            {item.photos_count > 0 && (
              <Text style={styles.photosCount}>{item.photos_count} foto(s) registrada(s)</Text>
            )}
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
      <View style={styles.header}>
        <Text style={tokens.typography.h1}>Visitas</Text>

        <TextInput
          placeholder="Buscar visita, cliente ou ambiente..."
          value={search}
          onChangeText={handleSearchChange}
          mode="outlined"
          left={<TextInput.Icon icon="magnify" />}
          style={styles.searchInput}
          outlineColor={theme.colors.border}
          activeOutlineColor={theme.colors.primary}
        />

        {/* Horizontal tabs */}
        <View style={styles.tabContainer}>
          {['Todos', 'Pendente', 'Em andamento', 'Concluído'].map(tab => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => handleTabPress(tab)}
                style={[
                  styles.tabButton, 
                  isActive && styles.activeTabButton
                ]}
              >
                <Text 
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={[
                    styles.tabButtonText, 
                    isActive && styles.activeTabButtonText
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredVisits}
        renderItem={renderVisitItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={tokens.typography.subtitle}>Nenhuma visita encontrada</Text>
            <Text style={tokens.typography.caption}>Tente outro termo de busca ou filtro</Text>
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
  tabContainer: {
    flexDirection: 'row',
    marginTop: tokens.spacing.md,
    justifyContent: 'space-between',
    gap: 4,
  },
  tabButton: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.secondary,
    textAlign: 'center',
  },
  activeTabButtonText: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: tokens.spacing.lg,
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
  cardLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftInfo: {
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
  photosCount: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
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
