import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function UploadGroceryScreen() {
  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: .7 });
    if (!result.canceled) {
      router.push({
        pathname: "/(room)/review-grocery",
        params: {
          photoUri: result.assets[0]?.uri,
          photoName: result.assets[0]?.fileName ?? "Receipt photo",
        },
      });
    }
  };
  return <SafeAreaView style={styles.screen}><View><Text style={styles.title}>Upload grocery list</Text><Text style={styles.body}>Choose a receipt photo or enter every grocery item manually. You will assign each item on the next screen.</Text><Pressable onPress={() => void choosePhoto()} style={styles.primary}><Text style={styles.primaryText}>Choose receipt photo</Text></Pressable><Pressable onPress={() => router.push("/(room)/review-grocery")} style={styles.secondary}><Text style={styles.secondaryText}>Enter items manually</Text></Pressable><Pressable onPress={() => router.back()}><Text style={styles.cancel}>Cancel</Text></Pressable></View></SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F7F5EF", justifyContent: "center", padding: 24 }, title: { color: "#18251F", fontSize: 28, fontWeight: "900" }, body: { color: "#64716B", lineHeight: 21, marginTop: 10, marginBottom: 22 }, primary: { alignItems: "center", backgroundColor: "#28634E", borderRadius: 12, padding: 15 }, primaryText: { color: "white", fontWeight: "800" }, secondary: { alignItems: "center", borderColor: "#28634E", borderRadius: 12, borderWidth: 1, marginTop: 11, padding: 15 }, secondaryText: { color: "#28634E", fontWeight: "800" }, cancel: { color: "#64716B", fontWeight: "800", textAlign: "center", marginTop: 20 } });
