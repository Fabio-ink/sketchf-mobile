import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Modal, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import { Text, Button, IconButton } from 'react-native-paper';
import { theme, tokens } from '../theme/theme';

let alertRef = null;

export const CustomAlert = {
  alert: (title, message, buttons, options) => {
    if (alertRef) {
      alertRef(title, message, buttons, options);
    } else {
      console.warn("CustomAlertProvider not initialized. Falling back to native console.");
    }
  },
  isReady: () => alertRef !== null,
};

const detectAlertCategory = (title = '', message = '') => {
  const t = `${title} ${message}`.toLowerCase();
  if (
    t.includes('sucesso') || 
    t.includes('cadastrado') || 
    t.includes('salvo') || 
    t.includes('salva') || 
    t.includes('excluído') || 
    t.includes('excluída') || 
    t.includes('atualizado') || 
    t.includes('atualizada') || 
    t.includes('sincronizados')
  ) {
    return 'success';
  }
  if (
    t.includes('erro') || 
    t.includes('falha') || 
    t.includes('não foi possível') || 
    t.includes('invalido') || 
    t.includes('inválido') || 
    t.includes('obrigatório') ||
    t.includes('negada')
  ) {
    return 'error';
  }
  if (
    t.includes('excluir') || 
    t.includes('deletar') || 
    t.includes('certeza') || 
    t.includes('remover') || 
    t.includes('apagar') || 
    t.includes('deseja') || 
    t.includes('sair') ||
    t.includes('realmente')
  ) {
    return 'warning';
  }
  return 'info';
};

export function CustomAlertProvider({ children }) {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState({ title: '', message: '', buttons: [], options: {} });
  const { width: windowWidth } = useWindowDimensions();

  const showAlert = useCallback((title, message, buttons, options = {}) => {
    setConfig({ title, message, buttons: buttons || [], options });
    setVisible(true);
  }, []);

  useEffect(() => {
    alertRef = showAlert;
    return () => {
      alertRef = null;
    };
  }, [showAlert]);

  const handleButtonPress = (callback) => {
    setVisible(false);
    if (callback) {
      callback();
    }
  };

  const handleBackdropPress = () => {
    if (config.options?.cancelable !== false) {
      setVisible(false);
      if (config.options?.onDismiss) {
        config.options.onDismiss();
      }
    }
  };

  const category = detectAlertCategory(config.title, config.message);

  let iconName = 'information-outline';
  let iconColor = theme.colors.primary;
  let bgCircleColor = '#E3F2FD';

  switch (category) {
    case 'success':
      iconName = 'check-circle';
      iconColor = '#137333'; 
      bgCircleColor = '#E6F4EA'; 
      break;
    case 'error':
      iconName = 'alert-circle';
      iconColor = theme.colors.error; 
      bgCircleColor = '#FEE8E6'; 
      break;
    case 'warning':
      iconName = 'alert';
      iconColor = '#B06000'; 
      bgCircleColor = '#FEF3D6'; 
      break;
    case 'info':
    default:
      iconName = 'information';
      iconColor = theme.colors.primary;
      bgCircleColor = '#E8F0FE';
      break;
  }

  const buttons = config.buttons.length > 0 
    ? config.buttons 
    : [{ text: 'OK', onPress: () => {} }];

  return (
    <>
      {children}
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleBackdropPress}
      >
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.card, { maxWidth: windowWidth > 400 ? 360 : 320 }]}>
                {}
                <View style={[styles.iconCircle, { backgroundColor: bgCircleColor }]}>
                  <IconButton icon={iconName} iconColor={iconColor} size={36} style={styles.icon} />
                </View>

                {}
                {config.title ? <Text style={styles.title}>{config.title}</Text> : null}

                {}
                {config.message ? <Text style={styles.message}>{config.message}</Text> : null}

                {}
                <View style={buttons.length === 2 ? styles.buttonRow : styles.buttonColumn}>
                  {buttons.map((btn, index) => {
                    const isDestructive = btn.style === 'destructive';
                    const isCancel = btn.style === 'cancel' || (buttons.length === 2 && index === 0 && btn.style !== 'destructive');
                    
                    let btnMode = 'contained';
                    let btnColor = theme.colors.primary;
                    let labelColor = 'white';
                    let borderColor = 'transparent';

                    if (isDestructive) {
                      btnColor = theme.colors.error;
                    } else if (isCancel) {
                      btnMode = 'outlined';
                      btnColor = 'transparent';
                      labelColor = theme.colors.secondary;
                      borderColor = theme.colors.border;
                    }

                    return (
                      <Button
                        key={index}
                        mode={btnMode}
                        onPress={() => handleButtonPress(btn.onPress)}
                        style={[
                          buttons.length === 2 ? styles.rowButton : styles.columnButton,
                          isCancel && { borderColor },
                          { backgroundColor: btnColor }
                        ]}
                        labelStyle={[
                          styles.buttonLabel,
                          { color: labelColor }
                        ]}
                      >
                        {btn.text}
                      </Button>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(22, 29, 100, 0.45)', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '85%',
    alignItems: 'center',
    elevation: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    margin: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '400',
    color: '#5A609B', 
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  buttonColumn: {
    flexDirection: 'column',
    width: '100%',
    gap: 8,
  },
  rowButton: {
    flex: 1,
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
  },
  columnButton: {
    width: '100%',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginVertical: 0,
  },
});
