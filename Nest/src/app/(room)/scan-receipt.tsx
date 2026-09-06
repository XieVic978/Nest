import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Step 1 of the receipt flow: capture a photo (or bail to manual entry).
// Handles the three permission states gracefully and offers retake / use photo.
export default function ScanReceiptScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  function goToReview(uri: string | null) {
    router.replace({
      pathname: "/(room)/review-receipt",
      params: uri ? { photoUri: uri } : {},
    });
  }

  async function capture() {
    if (!cameraRef.current) return;
    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (photo?.uri) setPhotoUri(photo.uri);
    } catch {
      // If capture fails, let the user retry or enter manually.
      setPhotoUri(null);
    } finally {
      setCapturing(false);
    }
  }

  // Permission still loading.
  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#28634E" />
      </SafeAreaView>
    );
  }

  // Permission not yet granted.
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.body}>
          Nest uses the camera to scan receipts. You can also add a receipt by
          hand without the camera.
        </Text>
        {permission.canAskAgain ? (
          <Pressable onPress={() => void requestPermission()} style={styles.primary}>
            <Text style={styles.primaryText}>Allow camera</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => void Linking.openSettings()} style={styles.primary}>
            <Text style={styles.primaryText}>Open settings</Text>
          </Pressable>
        )}
        <Pressable onPress={() => goToReview(null)} style={styles.secondary}>
          <Text style={styles.secondaryText}>Enter receipt manually</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.link}>
          <Text style={styles.linkText}>Cancel</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Photo captured: review / retake / use.
  if (photoUri) {
    return (
      <SafeAreaView style={styles.previewScreen} edges={["top", "bottom"]}>
        <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="contain" />
        <View style={styles.previewBar}>
          <Pressable onPress={() => setPhotoUri(null)} style={styles.secondaryDark}>
            <Text style={styles.secondaryDarkText}>Retake</Text>
          </Pressable>
          <Pressable onPress={() => goToReview(photoUri)} style={styles.primary}>
            <Text style={styles.primaryText}>Use photo</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Live camera.
  return (
    <View style={styles.cameraScreen}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.pill}>
            <Text style={styles.pillText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => goToReview(null)} style={styles.pill}>
            <Text style={styles.pillText}>Enter manually</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>Line up the whole receipt, then tap the button.</Text>
        <View style={styles.shutterRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            onPress={() => void capture()}
            disabled={capturing}
            style={styles.shutter}
          >
            {capturing ? <ActivityIndicator color="#28634E" /> : <View style={styles.shutterInner} />}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: "#F7F5EF", alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  title: { color: "#18251F", fontSize: 24, fontWeight: "800", textAlign: "center" },
  body: { color: "#64716B", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  primary: { backgroundColor: "#28634E", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, alignItems: "center", alignSelf: "stretch" },
  primaryText: { color: "white", fontWeight: "800" },
  secondary: { borderWidth: 1, borderColor: "#28634E", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, alignItems: "center", alignSelf: "stretch" },
  secondaryText: { color: "#28634E", fontWeight: "800" },
  link: { padding: 8 },
  linkText: { color: "#64716B", fontWeight: "700" },
  cameraScreen: { flex: 1, backgroundColor: "#000" },
  camera: { ...StyleSheet.absoluteFill },
  overlay: { flex: 1, justifyContent: "space-between", padding: 20 },
  topBar: { flexDirection: "row", justifyContent: "space-between" },
  pill: { backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  pillText: { color: "white", fontWeight: "800", fontSize: 13 },
  hint: { color: "white", textAlign: "center", fontSize: 13, fontWeight: "600", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
  shutterRow: { alignItems: "center" },
  shutter: { width: 74, height: 74, borderRadius: 37, backgroundColor: "white", alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: "rgba(255,255,255,0.5)" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "white" },
  previewScreen: { flex: 1, backgroundColor: "#101410" },
  preview: { flex: 1, width: "100%" },
  previewBar: { flexDirection: "row", gap: 12, padding: 20 },
  secondaryDark: { flex: 1, borderWidth: 1, borderColor: "white", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  secondaryDarkText: { color: "white", fontWeight: "800" },
});
