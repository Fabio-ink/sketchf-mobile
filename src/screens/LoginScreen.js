import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Surface } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme, tokens } from '../theme/theme';
import api from '../services/api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          navigation.replace('Projects');
        } else {
          setLoading(false);
        }
      } catch (error) {
        setLoading(false);
      }
    };
    checkToken();
  }, []);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }

    if (isRegistering && password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegistering ? '/auth/register' : '/auth/login';
      const response = await api.post(endpoint, { email, password });

      const { token } = response.data;
      if (token) {
        await AsyncStorage.setItem('token', token);
        navigation.replace('Projects');
      }
    } catch (error) {
      const serverMsg = error.response?.data?.error;
      const localMsg = error.message;
      const msg = serverMsg || localMsg || 'Ocorreu um erro desconhecido.';
      Alert.alert('Falha na Autenticação', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={tokens.typography.h1}>SketchF</Text>
          <Text style={tokens.typography.subtitle}>Bem-vindo de volta!</Text>
        </View>

        <Surface style={styles.card}>
          <TextInput
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            label="Senha"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
          />
          <Button 
            mode="contained" 
            onPress={handleAuth}
            loading={loading}
            disabled={loading}
            style={styles.button}
            labelStyle={styles.buttonLabel}
          >
            {isRegistering ? 'Cadastrar' : 'Entrar'}
          </Button>
          {!isRegistering && (
            <Button 
              mode="text" 
              onPress={() => {}}
              style={styles.secondaryButton}
              labelStyle={{ color: theme.colors.accent }}
            >
              Esqueci minha senha
            </Button>
          )}
        </Surface>

        <View style={styles.footer}>
          <Text style={tokens.typography.caption}>
            {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}
          </Text>
          <Button 
            mode="text" 
            onPress={() => setIsRegistering(!isRegistering)}
            labelStyle={{ color: theme.colors.accent }}
          >
            {isRegistering ? 'Fazer Login' : 'Cadastre-se'}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: tokens.spacing.lg,
  },
  header: {
    marginBottom: tokens.spacing.xl,
    alignItems: 'center',
  },
  card: {
    padding: tokens.spacing.lg,
    borderRadius: theme.roundness * 2,
    ...tokens.shadows.light,
  },
  input: {
    marginBottom: tokens.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  button: {
    marginTop: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    backgroundColor: theme.colors.primary,
  },
  buttonLabel: {
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: tokens.spacing.sm,
  },
  footer: {
    marginTop: tokens.spacing.xl,
    alignItems: 'center',
  },
});
