import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { useRoom } from "@/features/rooms/RoomProvider";
import { uploadAndScanReceipt } from "@/features/expenses/receiptScan";

export default function UploadGroceryScreen() {
  const { room } = useRoom();
  const [scanning, setScanning] = useState(false);
  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: .7 });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (asset?.uri && room) {
      setScanning(true);
      try {
        const { imagePath, receipt } = await uploadAndScanReceipt(room.room.id, asset.uri);
        const params: Record<string, string> = { photoUri: asset.uri, photoName: asset.fileName ?? "Receipt photo", imagePath, items: JSON.stringify(receipt.items) };
        if (receipt.merchant) params.title = receipt.merchant;
        if (receipt.purchasedAt) params.date = receipt.purchasedAt;
        router.push({ pathname: "/(room)/review-grocery", params });
      } catch (error) {
        Alert.alert("Couldn’t scan receipt", error instanceof Error ? `${error.message}\n\nYou can still add items manually.` : "You can still add items manually.");
      } finally {
        setScanning(false);
      }
    }
  };
  return <SafeAreaView style={styles.screen}><View><Text style={styles.title}>Upload grocery list</Text><Text style={styles.body}>Choose a receipt photo and Nest will write out editable grocery items for you to assign. You can also enter them manually.</Text><Pressable disabled={scanning} onPress={() => void choosePhoto()} style={[styles.primary, scanning && styles.disabled]}>{scanning ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Choose receipt photo</Text>}</Pressable>{scanning ? <Text style={styles.scanning}>Reading your receipt…</Text> : null}<Pressable disabled={scanning} onPress={() => router.push("/(room)/review-grocery")} style={styles.secondary}><Text style={styles.secondaryText}>Enter items manually</Text></Pressable><Pressable disabled={scanning} onPress={() => router.back()}><Text style={styles.cancel}>Cancel</Text></Pressable></View></SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#FFFCF5", justifyContent: "center", padding: 24 }, title: { color: "#24374B", fontFamily: "Georgia", fontSize: 34, fontWeight: "700" }, body: { color: "#6B7785", lineHeight: 21, marginTop: 10, marginBottom: 22 }, primary: { alignItems: "center", backgroundColor: "#4975A8", borderRadius: 14, padding: 15 }, primaryText: { color: "white", fontWeight: "800" }, disabled: { opacity: .6 }, scanning: { color: "#4975A8", fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: 10 }, secondary: { alignItems: "center", borderColor: "#4975A8", borderRadius: 14, borderWidth: 1, marginTop: 11, padding: 15 }, secondaryText: { color: "#4975A8", fontWeight: "800" }, cancel: { color: "#6B7785", fontWeight: "800", textAlign: "center", marginTop: 20 } });
