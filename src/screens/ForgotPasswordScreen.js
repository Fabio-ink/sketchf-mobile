import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Surface } from 'react-native-paper';
import { theme, tokens } from '../theme/theme';
import api from '../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [step, setStep] = useState(1); // 1 = Request code, 2 = Verify & reset
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async () => {
    if (!email) {
      Alert.alert('Erro', 'Por favor, insira o seu e-mail.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      Alert.alert('Código Enviado', response.data.message || 'Se este e-mail estiver cadastrado, você receberá um código de recuperação.');
      setStep(2);
    } catch (error) {
      const serverMsg = error.response?.data?.error;
      const localMsg = error.message;
      Alert.alert('Erro', serverMsg || localMsg || 'Falha ao solicitar código de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code || !newPassword || !confirmPassword) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Erro', 'A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/reset-password', {
        email,
        code,
        newPassword
      });
      Alert.alert('Sucesso', response.data.message || 'Senha redefinida com sucesso!', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error) {
      const serverMsg = error.response?.data?.error;
      const localMsg = error.message;
      Alert.alert('Erro', serverMsg || localMsg || 'Falha ao redefinir senha.');
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
          <Text style={tokens.typography.subtitle}>
            {step === 1 ? 'Recuperação de Senha' : 'Crie sua nova senha'}
          </Text>
        </View>

        <Surface style={styles.card}>
          {step === 1 ? (
            <View>
              <Text style={[tokens.typography.body, styles.instructions]}>
                Digite seu e-mail cadastrado. Enviaremos um código de 6 dígitos para você redefinir sua senha.
              </Text>
              
              <TextInput
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
              
              <Button 
                mode="contained" 
                onPress={handleRequestCode}
                loading={loading}
                disabled={loading}
                style={styles.button}
                labelStyle={styles.buttonLabel}
              >
                Enviar Código
              </Button>
            </View>
          ) : (
            <View>
              <Text style={[tokens.typography.body, styles.instructions]}>
                Insira o código de 6 dígitos que enviamos para o e-mail <Text style={{ fontWeight: '700' }}>{email}</Text> e defina a nova senha.
              </Text>

              <TextInput
                label="Código de Verificação"
                value={code}
                onChangeText={setCode}
                mode="outlined"
                keyboardType="numeric"
                maxLength={6}
                style={styles.input}
              />

              <TextInput
                label="Nova Senha"
                value={newPassword}
                onChangeText={setNewPassword}
                mode="outlined"
                secureTextEntry
                style={styles.input}
              />

              <TextInput
                label="Confirmar Nova Senha"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                mode="outlined"
                secureTextEntry
                style={styles.input}
              />

              <Button 
                mode="contained" 
                onPress={handleResetPassword}
                loading={loading}
                disabled={loading}
                style={styles.button}
                labelStyle={styles.buttonLabel}
              >
                Redefinir Senha
              </Button>

              <Button 
                mode="text" 
                onPress={handleRequestCode}
                disabled={loading}
                style={styles.secondaryButton}
                labelStyle={{ color: theme.colors.accent }}
              >
                Reenviar Código
              </Button>
            </View>
          )}
        </Surface>

        <View style={styles.footer}>
          <Button 
            mode="text" 
            onPress={() => navigation.navigate('Login')}
            labelStyle={{ color: theme.colors.accent }}
            icon="arrow-left"
          >
            Voltar para o Login
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
  instructions: {
    marginBottom: tokens.spacing.md,
    textAlign: 'center',
    color: theme.colors.secondary,
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
