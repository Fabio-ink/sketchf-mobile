import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const IMAGES_DIR = `${FileSystem.documentDirectory}sketchf_images/`;

const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }
};

export const saveAndCompressImage = async (tempUri) => {
  try {
    await ensureDirExists();

    const manipResult = await ImageManipulator.manipulateAsync(
      tempUri,
      [{ resize: { width: 1080 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    const fileName = `img_${Date.now()}.jpg`;
    const permanentUri = IMAGES_DIR + fileName;

    await FileSystem.copyAsync({
      from: manipResult.uri,
      to: permanentUri,
    });

    return permanentUri;
  } catch (error) {
    throw error;
  }
};

export const removeImage = async (uri) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(uri);
    }
  } catch (error) {
  }
};

export const readImageAsBase64 = async (uri) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('Arquivo não encontrado no armazenamento local.');
    }
    const base64Data = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64Data;
  } catch (error) {
    throw error;
  }
};
