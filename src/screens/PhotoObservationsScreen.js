import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, FlatList, Alert, TouchableOpacity } from 'react-native';
import { Text, Surface, TextInput, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import { theme, tokens } from '../theme/theme';
import * as localDB from '../services/localDB';
import api from '../services/api';

const COLORS = [
  { hex: '#FFEB3B', label: 'Amarelo' },
  { hex: '#FFCDD2', label: 'Vermelho' },
  { hex: '#BBDEFB', label: 'Azul' },
  { hex: '#C8E6C9', label: 'Verde' },
  { hex: '#E1BEE7', label: 'Roxo' },
  { hex: '#CFD8DC', label: 'Cinza' }
];

export default function PhotoObservationsScreen({ route, navigation }) {
  const { photoId, visitId } = route.params;

  const [photo, setPhoto] = useState(null);
  const [observations, setObservations] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#FFEB3B');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotoData();
  }, []);

  const loadPhotoData = async () => {
    try {
      const photos = await localDB.getPhotos(visitId);
      const targetPhoto = photos.find(p => p.id === photoId || p.id.toString() === photoId.toString());
      if (targetPhoto) {
        setPhoto(targetPhoto);
        setObservations(targetPhoto.observations || []);
      }
    } catch (e) {
      console.log('Error loading photo observations:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddObservation = () => {
    if (!inputText.trim()) {
      return;
    }

    const newObs = {
      id: Date.now().toString(),
      text: inputText.trim(),
      color: selectedColor,
      created_at: new Date().toISOString()
    };

    const updated = [...observations, newObs];
    setObservations(updated);
    setInputText('');
  };

  const handleDeleteObservation = (id) => {
    const updated = observations.filter(obs => obs.id !== id);
    setObservations(updated);
  };

  const handleSaveAll = async () => {
    try {

      await localDB.updatePhotoMarkers(visitId, photoId, photo.markers, observations);
      Alert.alert('Sucesso', 'Observações salvas com sucesso!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao salvar as observações.');
    }
  };

  const renderObservationItem = ({ item }) => (
    <Surface style={[styles.obsCard, { backgroundColor: item.color }]}>
      <View style={styles.obsContent}>
        <Text style={styles.obsText}>{item.text}</Text>
        <IconButton
          icon="close-circle-outline"
          iconColor="#E53935"
          size={18}
          style={styles.deleteObsBtn}
          onPress={() => handleDeleteObservation(item.id)}
        />
      </View>
    </Surface>
  );

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
        <Text style={tokens.typography.h1}>Observações</Text>
        <Button mode="text" onPress={handleSaveAll} labelStyle={{ fontWeight: '700' }}>
          Salvar
        </Button>
      </View>

      {photo && (
        <View style={styles.photoContainer}>
          <Image source={{ uri: photo.image_url }} style={styles.photoPreview} />
        </View>
      )}

      <FlatList
        data={observations}
        renderItem={renderObservationItem}
        keyExtractor={item => item.id.toString()}
        style={styles.obsList}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={[tokens.typography.h3, { marginBottom: tokens.spacing.sm }]}>
            Observações registradas nesta foto
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={tokens.typography.caption}>Nenhuma observação adicionada.</Text>
            <Text style={tokens.typography.caption}>Use o formulário abaixo para adicionar uma.</Text>
          </View>
        }
      />

      <Surface style={styles.addFormContainer}>
        <TextInput
          placeholder="Digite uma observação (ex: Tomada baixa...)"
          value={inputText}
          onChangeText={setInputText}
          mode="outlined"
          style={styles.textInput}
          outlineColor={theme.colors.border}
          activeOutlineColor={theme.colors.primary}
        />

        <View style={styles.colorPaletteRow}>
          <Text style={styles.colorPaletteLabel}>Cor:</Text>
          <View style={styles.colorsRow}>
            {COLORS.map(c => {
              const isSelected = selectedColor === c.hex;
              return (
                <TouchableOpacity
                  key={c.hex}
                  onPress={() => setSelectedColor(c.hex)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: c.hex },
                    isSelected ? styles.colorCircleSelected : {}
                  ]}
                />
              );
            })}
          </View>
          <IconButton
            icon="plus-circle"
            iconColor={theme.colors.primary}
            size={28}
            onPress={handleAddObservation}
            disabled={!inputText.trim()}
          />
        </View>
      </Surface>
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
  photoContainer: {
    width: '100%',
    height: 180,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  obsList: {
    flex: 1,
    padding: tokens.spacing.lg,
  },
  listContent: {
    paddingBottom: 200,
  },
  obsCard: {
    borderRadius: theme.roundness,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    ...tokens.shadows.light,
  },
  obsContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  obsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#263238',
    flex: 1,
  },
  deleteObsBtn: {
    margin: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    marginVertical: tokens.spacing.xl,
  },
  addFormContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    padding: tokens.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...tokens.shadows.medium,
  },
  textInput: {
    backgroundColor: theme.colors.surface,
    height: 48,
    marginBottom: tokens.spacing.sm,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorPaletteLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.secondary,
  },
  colorsRow: {
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
});
