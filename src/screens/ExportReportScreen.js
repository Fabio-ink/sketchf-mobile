import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Surface, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { theme, tokens } from '../theme/theme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export default function ExportReportScreen({ route, navigation }) {
  const { visit } = route.params;
  const [generating, setGenerating] = useState(false);
  const [pdfUri, setPdfUri] = useState(null);

  const getHtmlPhotoUri = async (imageUrl) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUrl, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64}`;
    } catch (err) {
      console.log('Error reading local file as base64:', err);
      return imageUrl;
    }
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const htmlContent = await compileHTMLReport();
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      setPdfUri(uri);
    } catch (e) {
      console.log('Error generating PDF:', e);
      Alert.alert('Erro', 'Não foi possível gerar o arquivo PDF.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    generatePDF();
  }, []);

  const handleShare = async () => {
    if (!pdfUri) {
      Alert.alert('Erro', 'O PDF ainda não foi gerado.');
      return;
    }
    try {
      await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar Relatório' });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível compartilhar o relatório.');
    }
  };

  const handleView = async () => {
    if (!pdfUri) {
      Alert.alert('Erro', 'O PDF ainda não foi gerado.');
      return;
    }
    try {
      const htmlContent = await compileHTMLReport();
      await Print.printAsync({ printerUrl: pdfUri, html: htmlContent });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível abrir o visualizador de PDF.');
    }
  };

  const compileHTMLReport = async () => {
    const formattedDate = () => {
      try {
        const d = new Date(visit.date);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      } catch (e) {
        return '';
      }
    };

    let photosHtml = '';
    if (visit.photos && visit.photos.length > 0) {
      for (let idx = 0; idx < visit.photos.length; idx++) {
        const photo = visit.photos[idx];
        const displayUri = await getHtmlPhotoUri(photo.image_url);
        let svgElements = '';
        const canvasWidth = (photo.markers && photo.markers[0]?.canvasWidth) || 360;
        const canvasHeight = (photo.markers && photo.markers[0]?.canvasHeight) || 480;

        if (photo.markers && photo.markers.length > 0) {
          photo.markers.forEach(marker => {
            const start = marker.start;
            const end = marker.end;
            const cx = (start.x + end.x) / 2;
            const cy = (start.y + end.y) / 2;

            svgElements += `
              <!-- Dimension Line -->
              <line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="#00E676" stroke-width="3" />
              <!-- Endpoints -->
              <circle cx="${start.x}" cy="${start.y}" r="6" fill="#00E676" stroke="white" stroke-width="1.5" />
              <circle cx="${end.x}" cy="${end.y}" r="6" fill="#00E676" stroke="white" stroke-width="1.5" />
              <!-- Label Background -->
              <rect x="${cx - 30}" y="${cy - 10}" width="60" height="20" rx="4" fill="#161D64" />
              <!-- Label Text -->
              <text x="${cx}" y="${cy + 4}" fill="white" font-size="10" font-weight="bold" text-anchor="middle">${marker.value}</text>
            `;
          });
        }

        let observationsHtml = '';
        if (photo.observations && photo.observations.length > 0) {
          observationsHtml += '<div class="photo-comments"><strong>Anotações:</strong><ul>';
          photo.observations.forEach(obs => {
            observationsHtml += `<li><span class="color-dot" style="background-color: ${obs.color}"></span> ${obs.text}</li>`;
          });
          observationsHtml += '</ul></div>';
        }

        photosHtml += `
          <div class="photo-card page-break">
            <h3>Foto #${idx + 1}</h3>
            <div class="image-wrapper" style="aspect-ratio: ${canvasWidth}/${canvasHeight}; max-width: 500px;">
              <img src="${displayUri}" class="report-image" />
              <svg viewBox="0 0 ${canvasWidth} ${canvasHeight}" class="report-svg">
                ${svgElements}
              </svg>
            </div>
            ${observationsHtml}
          </div>
        `;
      }
    } else {
      photosHtml = '<p>Nenhuma foto registrada nesta visita.</p>';
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Relatório de Visita Técnica</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #2C3E50;
            padding: 20px;
            background-color: #FFFFFF;
            line-height: 1.5;
          }
          .header-table {
            width: 100%;
            border-bottom: 3px solid #161D64;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .logo {
            font-size: 28px;
            font-weight: 800;
            color: #161D64;
            letter-spacing: -1px;
          }
          .report-title {
            text-align: right;
            font-size: 14px;
            text-transform: uppercase;
            color: #979797;
            font-weight: 700;
          }
          .section {
            margin-bottom: 25px;
          }
          .section-title {
            font-size: 13px;
            text-transform: uppercase;
            color: #5A609B;
            font-weight: 800;
            border-bottom: 1px solid #E8EBF2;
            padding-bottom: 4px;
            margin-bottom: 10px;
          }
          .grid-table {
            width: 100%;
            border-collapse: collapse;
          }
          .grid-table td {
            padding: 6px 0;
            font-size: 14px;
          }
          .grid-table .label {
            font-weight: 700;
            color: #5A609B;
            width: 120px;
          }
          .observations-box {
            background-color: #F8F9FD;
            border-left: 4px solid #161D64;
            padding: 12px;
            font-size: 14px;
            border-radius: 4px;
          }
          .photo-card {
            margin-top: 25px;
            padding: 15px;
            border: 1px solid #E8EBF2;
            border-radius: 8px;
          }
          .photo-card h3 {
            margin-top: 0;
            font-size: 15px;
            color: #161D64;
          }
          .image-wrapper {
            position: relative;
            display: block;
            width: 100%;
            margin: 0 auto;
            background-color: #000;
            border-radius: 6px;
            overflow: hidden;
          }
          .report-image {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: contain;
          }
          .report-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          .photo-comments {
            margin-top: 12px;
            font-size: 13px;
          }
          .photo-comments ul {
            margin: 4px 0 0 0;
            padding-left: 20px;
          }
          .photo-comments li {
            margin-bottom: 4px;
            list-style-type: none;
            position: relative;
          }
          .color-dot {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 5px;
            margin-right: 6px;
            border: 1px solid #979797;
            vertical-align: middle;
          }
          .page-break {
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <table class="header-table">
          <tr>
            <td class="logo">sketchF</td>
            <td class="report-title">Relatório Técnico de Visita</td>
          </tr>
        </table>

        <!-- Client & Visit Info -->
        <div class="section page-break">
          <div class="section-title">Informações Gerais</div>
          <table class="grid-table">
            <tr>
              <td class="label">Cliente:</td>
              <td>${visit.client_name}</td>
              <td class="label">Data da Visita:</td>
              <td>${formattedDate()}</td>
            </tr>
            <tr>
              <td class="label">Telefone:</td>
              <td>${visit.client_phone || 'Não informado'}</td>
              <td class="label">Ambiente:</td>
              <td>${visit.environment}</td>
            </tr>
            <tr>
              <td class="label">Endereço:</td>
              <td colspan="3">${visit.client_address || 'Não informado'}</td>
            </tr>
          </table>
        </div>

        <!-- General Observations -->
        <div class="section page-break">
          <div class="section-title">Observações Técnicas</div>
          <div class="observations-box">
            ${visit.observations ? visit.observations.replace(/\n/g, '<br/>') : 'Nenhuma observação geral registrada.'}
          </div>
        </div>

        <!-- Photos Section -->
        <div class="section">
          <div class="section-title">Registro Fotográfico e Medidas</div>
          ${photosHtml}
        </div>
      </body>
      </html>
    `;
  };

  return (
    <View style={styles.container}>
      <IconButton 
        icon="close" 
        onPress={() => navigation.navigate('Projects')} 
        style={styles.closeBtn}
      />

      <View style={styles.content}>
        <IconButton 
          icon="file-pdf-box" 
          iconColor={theme.colors.primary} 
          size={80} 
          style={styles.pdfIcon}
        />

        <Text style={tokens.typography.h1}>Relatório Pronto!</Text>
        <Text style={styles.subtitle}>
          O relatório da visita para o cliente {visit.client_name} foi gerado com sucesso.
        </Text>

        {generating ? (
          <ActivityIndicator color={theme.colors.primary} size="large" style={styles.loader} />
        ) : (
          <View style={styles.actionsContainer}>
            <Button
              mode="contained"
              icon="eye-outline"
              onPress={handleView}
              style={styles.actionBtn}
              labelStyle={styles.btnLabel}
            >
              Visualizar PDF
            </Button>

            <Button
              mode="outlined"
              icon="share-variant-outline"
              onPress={handleShare}
              style={styles.actionBtn}
              labelStyle={[styles.btnLabel, { color: theme.colors.primary }]}
            >
              Compartilhar
            </Button>
          </View>
        )}
      </View>

      <Button 
        mode="text" 
        onPress={() => navigation.navigate('Projects')}
        style={styles.backHomeBtn}
      >
        Voltar para a tela inicial
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'space-between',
    paddingBottom: tokens.spacing.xl,
  },
  closeBtn: {
    alignSelf: 'flex-start',
    marginTop: tokens.spacing.xl,
    marginLeft: tokens.spacing.md,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.xl,
    flex: 1,
    justifyContent: 'center',
  },
  pdfIcon: {
    margin: 0,
    marginBottom: tokens.spacing.md,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.secondary,
    textAlign: 'center',
    marginTop: tokens.spacing.sm,
    lineHeight: 22,
  },
  loader: {
    marginTop: tokens.spacing.xl,
  },
  actionsContainer: {
    width: '100%',
    marginTop: tokens.spacing.xl,
    gap: tokens.spacing.md,
  },
  actionBtn: {
    paddingVertical: tokens.spacing.xs,
    borderRadius: 24,
    width: '100%',
  },
  btnLabel: {
    fontWeight: '700',
    fontSize: 15,
  },
  backHomeBtn: {
    marginHorizontal: tokens.spacing.xl,
  },
});
