import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, Surface } from 'react-native-paper';
import { theme, tokens } from '../theme/theme';
import * as localDB from '../services/localDB';
import api from '../services/api';

export default function AddProjectScreen({ navigation }) {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name) return alert('O nome do projeto é obrigatório');
    
    setLoading(true);
    const data = { name, client_name: client, address };

    const newProject = await localDB.createProject(data, true);

    try {
      const res = await api.post('/projects', data);
      if (res.data?.id) {
        const projects = await localDB.getProjects();
        await localDB.setProjects(projects.map(p =>
          p.id === newProject.id
            ? { ...p, id: res.data.id, _serverId: res.data.id, _isLocal: false }
            : p
        ));
      }
    } catch (e) {
      await localDB.addToSyncQueue({ type: 'CREATE', entity: 'project', localId: newProject.id, data });
    } finally {
      setLoading(false);
      navigation.goBack();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[tokens.typography.h1, { marginBottom: tokens.spacing.lg }]}>Novo Projeto</Text>
      
      <Surface style={styles.card}>
        <TextInput
          label="Nome do Projeto (ex: Cozinha Apt 202)"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Nome do Cliente"
          value={client}
          onChangeText={setClient}
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Endereço / Local"
          value={address}
          onChangeText={setAddress}
          mode="outlined"
          multiline
          numberOfLines={3}
          style={styles.input}
        />
        
        <Button 
          mode="contained" 
          onPress={handleCreate}
          loading={loading}
          disabled={loading}
          style={styles.button}
        >
          Criar Projeto
        </Button>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: tokens.spacing.lg },
  card: {
    padding: tokens.spacing.lg,
    borderRadius: theme.roundness * 2,
    ...tokens.shadows.light,
  },
  input: { marginBottom: tokens.spacing.md, backgroundColor: theme.colors.surface },
  button: { marginTop: tokens.spacing.md, backgroundColor: theme.colors.primary },
});
