import { useEffect, useState } from "react";
import { router, type Href } from "expo-router";
import { Alert, Keyboard, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { toRoomError } from "@/features/rooms/errors";
import { useRoom } from "@/features/rooms/RoomProvider";
import { confirmAction } from "@/lib/confirmAction";

// Typed as Href because the generated route types don't always include the
// bare (room) group-index path.
const ROOM_HOME = "/(room)" as Href;

export default function ProfileScreen() {
  const { updateProfile, user, signOut } = useSession();
  const { leaveNest, room } = useRoom();
  const [fullName, setFullName] = useState(user?.profile?.fullName ?? "");
  const [venmo, setVenmo] = useState(user?.profile?.venmo ?? "");
  const [zelle, setZelle] = useState(user?.profile?.zelle ?? "");
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setFullName(user?.profile?.fullName ?? "");
    setVenmo(user?.profile?.venmo ?? "");
    setZelle(user?.profile?.zelle ?? "");
  }, [user]);

  const saveSettings = async () => {
    if (!fullName.trim()) {
      Alert.alert("Add your name", "Your name is required.");
      return;
    }
    setSaving(true);
    try {
      const result = await updateProfile({ fullName, phone: user?.profile?.phone, venmo, zelle });
      if (!result.ok) {
        Alert.alert("Couldn’t save settings", result.error);
        return;
      }
      Keyboard.dismiss();
      Alert.alert("Settings saved", "Your contact information has been updated.");
    } finally {
      setSaving(false);
    }
  };

  const leaveCurrentNest = async () => {
    setLeaving(true);
    try {
      await leaveNest();
      router.replace("/create-join");
    } catch (error) {
      Alert.alert("Could not leave Nest", toRoomError(error).message);
    } finally {
      setLeaving(false);
    }
  };

  const confirmLeave = () => confirmAction({
    title: "Leave this Nest?",
    message: "You will lose access to this Nest's shared information. You can join another Nest later with its code.",
    confirmText: "Leave Nest",
    destructive: true,
    onConfirm: leaveCurrentNest,
  });

  const signOutCurrentUser = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/(auth)/sign-in");
    } finally {
      setSigningOut(false);
    }
  };

  const confirmSignOut = () => confirmAction({
    title: "Sign out of Nest?",
    message: "You can log back in anytime with a code sent to your email.",
    confirmText: "Sign out",
    destructive: true,
    onConfirm: signOutCurrentUser,
  });

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><View><Text style={styles.title}>Settings</Text>{user?.email ? <Text style={styles.email}>{user.email}</Text> : null}</View><Pressable accessibilityRole="button" onPress={() => router.replace(room ? ROOM_HOME : "/create-join")} style={styles.backToNest}><Text style={styles.buttonText}>Back to Nest</Text></Pressable></View>
    <View style={styles.card}><Text style={styles.cardTitle}>Personal information</Text><Text style={styles.label}>NAME</Text><TextInput accessibilityLabel="Name" autoCapitalize="words" enterKeyHint="next" onChangeText={setFullName} placeholder="Your name" style={styles.input} value={fullName} /><Text style={styles.label}>VENMO</Text><TextInput accessibilityLabel="Venmo" autoCapitalize="none" autoCorrect={false} enterKeyHint="next" onChangeText={setVenmo} placeholder="@your-venmo" style={styles.input} value={venmo} /><Text style={styles.label}>ZELLE</Text><TextInput accessibilityLabel="Zelle" autoCapitalize="none" autoCorrect={false} enterKeyHint="done" onChangeText={setZelle} onSubmitEditing={Keyboard.dismiss} placeholder="Phone number or email" style={styles.input} value={zelle} /><Pressable accessibilityRole="button" disabled={saving} onPress={() => void saveSettings()} style={[styles.save, saving && styles.disabled]}><Text style={styles.saveText}>{saving ? "Saving…" : "Save changes"}</Text></Pressable></View>
    <View style={styles.footer}>{room ? <Pressable accessibilityRole="button" disabled={leaving} onPress={confirmLeave} style={[styles.leave, leaving && styles.disabled]}><Text style={styles.leaveText}>{leaving ? "Leaving…" : "Leave Nest"}</Text></Pressable> : null}<Pressable accessibilityRole="button" disabled={signingOut} onPress={confirmSignOut} style={[styles.signOut, signingOut && styles.disabled]}><Text style={styles.signOutText}>{signingOut ? "Signing out…" : "Sign out"}</Text></Pressable></View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F5EF" },
  screen: { flexGrow: 1, backgroundColor: "#F7F5EF", padding: 24, paddingTop: 36, paddingBottom: 32 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 30, fontWeight: "800", color: "#18251F" },
  email: { marginTop: 8, fontSize: 14, color: "#758079" },
  backToNest: {
    backgroundColor: "#28634E",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: { color: "white", fontWeight: "800" },
  card: { backgroundColor: "#FFFDF8", borderColor: "#E4E8E3", borderRadius: 16, borderWidth: 1, marginTop: 28, padding: 16 },
  cardTitle: { color: "#18251F", fontSize: 17, fontWeight: "800" },
  label: { color: "#64716B", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 7, marginTop: 18 },
  input: { backgroundColor: "#FFFFFF", borderColor: "#DDE3DC", borderRadius: 11, borderWidth: 1, color: "#18251F", fontSize: 15, padding: 13 },
  save: { alignItems: "center", backgroundColor: "#28634E", borderRadius: 12, marginTop: 22, padding: 14 },
  saveText: { color: "white", fontWeight: "800" },
  footer: { marginTop: "auto", paddingTop: 36 },
  signOut: {
    alignItems: "center",
    marginTop: 12,
    borderColor: "#C1443B",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  signOutText: { color: "#C1443B", fontWeight: "800" },
  leave: { alignItems: "center", borderColor: "#C1443B", borderWidth: 1, borderRadius: 12, paddingVertical: 12 },
  leaveText: { color: "#C1443B", fontWeight: "800" },
  disabled: { opacity: 0.55 },
});
