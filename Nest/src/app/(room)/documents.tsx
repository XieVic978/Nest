import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useSession } from "@/auth/ctx";
import { useRoom } from "@/features/rooms/RoomProvider";
import { useSharedNote } from "@/features/shared-data/useSharedNote";

const PIN_LENGTH = 4;

export default function DocumentsScreen() {
  const { nestJoinCode, room, user } = useRoom();
  const { resetDocumentPin, verifyDocumentPin } = useSession();
  const { error: noteError, loading: noteLoading, note, saveContent } = useSharedNote(room?.room.id ?? "", user?.id ?? "");
  const pinInput = useRef<TextInput>(null);
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [edited, setEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  // Tabs stay mounted while people move through Nest. Lock Documents whenever
  // this screen loses focus, then focus the PIN field when it is opened again.
  useFocusEffect(
    useCallback(() => {
      setUnlocked(false);
      setPin("");
      setError(null);
      setNotice(null);
      const timer = setTimeout(() => pinInput.current?.focus(), 250);

      return () => {
        clearTimeout(timer);
        Keyboard.dismiss();
        setUnlocked(false);
        setPin("");
        setResetVisible(false);
      };
    }, []),
  );

  useEffect(() => { if (!edited) setDraft(note?.content ?? ""); }, [edited, note?.content]);
  useEffect(() => {
    if (!unlocked || !edited) return;
    const timer = setTimeout(() => { setSaving(true); void saveContent(draft).then(() => setEdited(false)).catch((caught) => setError(caught instanceof Error ? caught.message : "Couldn’t save your note.")).finally(() => setSaving(false)); }, 650);
    return () => clearTimeout(timer);
  }, [draft, edited, saveContent, unlocked]);

  async function unlock() {
    Keyboard.dismiss();
    setChecking(true);
    setError(null);
    const result = await verifyDocumentPin(pin);
    setChecking(false);
    if (!result.ok) return setError(result.error);
    setPin("");
    setUnlocked(true);
  }

  function openReset() {
    Keyboard.dismiss();
    setResetError(null);
    setAccountPassword("");
    setNewPin("");
    setConfirmPin("");
    setResetVisible(true);
  }

  async function handleReset() {
    if (!accountPassword) return setResetError("Enter your account password.");
    if (!/^\d{4}$/.test(newPin)) return setResetError("Choose a four-digit Documents PIN.");
    if (newPin !== confirmPin) return setResetError("Your new PIN entries do not match.");

    Keyboard.dismiss();
    setResetting(true);
    setResetError(null);
    const result = await resetDocumentPin(accountPassword, newPin);
    setResetting(false);
    if (!result.ok) return setResetError(result.error);

    setResetVisible(false);
    setAccountPassword("");
    setNewPin("");
    setConfirmPin("");
    setPin("");
    setUnlocked(false);
    setNotice("PIN reset. Enter your new PIN to unlock Documents.");
    setTimeout(() => pinInput.current?.focus(), 250);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Notes</Text>
      {!unlocked ? (
        <>
          <Text style={styles.body}>Enter your four-digit Nest PIN to access your shared household note.</Text>
          <TextInput ref={pinInput} accessibilityLabel="Four digit PIN" autoFocus keyboardType="number-pad" maxLength={PIN_LENGTH} onChangeText={(value) => { setPin(value); setError(null); }} onSubmitEditing={() => void unlock()} placeholder="4-digit PIN" secureTextEntry style={styles.input} textContentType="oneTimeCode" value={pin} />
          <Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={styles.dismissKeyboard}><Text style={styles.dismissKeyboardText}>Done entering PIN</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={pin.length !== PIN_LENGTH || checking} onPress={() => void unlock()} style={[styles.button, (pin.length !== PIN_LENGTH || checking) && styles.disabled]}><Text style={styles.buttonText}>{checking ? "Checking…" : "Unlock documents"}</Text></Pressable>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <Pressable accessibilityRole="button" onPress={openReset} style={styles.resetLink}><Text style={styles.resetLinkText}>Forgot your PIN? Reset it</Text></Pressable>
        </>
      ) : (
        <>
          <Text style={styles.label}>PERMANENT NEST CODE</Text>
          <Pressable accessibilityLabel="Copy permanent Nest code" accessibilityRole="button" onPress={() => nestJoinCode && void Clipboard.setStringAsync(nestJoinCode)} style={styles.code}><Text style={styles.codeText}>{nestJoinCode ?? "Loading…"}</Text><Text style={styles.copy}>TAP TO COPY</Text></Pressable>
          <View style={styles.noteHeader}><View><Text style={styles.noteTitle}>Shared house note</Text><Text style={styles.noteSubtitle}>Everything saves automatically for your roommates.</Text></View><Text style={styles.saveState}>{saving ? "Saving…" : noteLoading ? "Loading…" : "Live"}</Text></View>
          {noteError ? <Text style={styles.error}>Couldn’t load the shared note: {noteError}</Text> : null}
          <TextInput accessibilityLabel="Shared house note" multiline onChangeText={(value) => { setDraft(value); setEdited(true); }} placeholder="Start writing anything your household needs to remember…" style={styles.noteInput} textAlignVertical="top" value={draft} />
        </>
      )}

      <Modal animationType="slide" onRequestClose={() => !resetting && setResetVisible(false)} transparent visible={resetVisible}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Reset Documents PIN</Text><Pressable accessibilityRole="button" disabled={resetting} onPress={() => setResetVisible(false)}><Text style={styles.close}>Close</Text></Pressable></View>
            <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
              <Text style={styles.modalBody}>Confirm your account password, then choose a new four-digit PIN.</Text>
              <Text style={styles.fieldLabel}>ACCOUNT PASSWORD</Text>
              <TextInput autoComplete="current-password" autoFocus onChangeText={(value) => { setAccountPassword(value); setResetError(null); }} placeholder="Your account password" secureTextEntry style={styles.input} textContentType="password" value={accountPassword} />
              <Text style={styles.fieldLabel}>NEW FOUR-DIGIT PIN</Text>
              <TextInput keyboardType="number-pad" maxLength={PIN_LENGTH} onChangeText={(value) => { setNewPin(value); setResetError(null); }} placeholder="••••" secureTextEntry style={styles.input} value={newPin} />
              <Text style={styles.fieldLabel}>CONFIRM NEW PIN</Text>
              <TextInput keyboardType="number-pad" maxLength={PIN_LENGTH} onChangeText={(value) => { setConfirmPin(value); setResetError(null); }} onSubmitEditing={() => void handleReset()} placeholder="••••" secureTextEntry style={styles.input} value={confirmPin} />
              <Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={styles.dismissKeyboard}><Text style={styles.dismissKeyboardText}>Done entering</Text></Pressable>
              {resetError ? <Text accessibilityRole="alert" style={styles.error}>{resetError}</Text> : null}
              <Pressable accessibilityRole="button" disabled={resetting} onPress={() => void handleReset()} style={[styles.button, resetting && styles.disabled]}><Text style={styles.buttonText}>{resetting ? "Resetting…" : "Reset PIN"}</Text></Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5EF", padding: 24, paddingTop: 72 },
  title: { fontSize: 30, fontWeight: "800", color: "#18251F", marginBottom: 12 },
  body: { color: "#64716B", lineHeight: 21, marginBottom: 20 },
  input: { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 12, padding: 15, fontSize: 16 },
  button: { backgroundColor: "#28634E", borderRadius: 12, padding: 15, marginTop: 12, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "800" }, disabled: { opacity: 0.5 },
  error: { color: "#B6453C", marginTop: 12, fontWeight: "600" }, notice: { color: "#28634E", marginTop: 12, fontWeight: "600" },
  dismissKeyboard: { alignSelf: "flex-end", paddingVertical: 10, paddingHorizontal: 2 }, dismissKeyboardText: { color: "#28634E", fontSize: 13, fontWeight: "800" },
  resetLink: { alignSelf: "flex-start", marginTop: 16 }, resetLinkText: { color: "#28634E", fontSize: 14, fontWeight: "800" },
  label: { color: "#64716B", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 20, marginBottom: 7 },
  code: { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 12, padding: 16 }, codeText: { color: "#18251F", fontSize: 22, fontWeight: "900", letterSpacing: 2 }, copy: { color: "#28634E", fontSize: 10, fontWeight: "800", marginTop: 5 }, noteHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10, marginTop: 24 }, noteTitle: { color: "#18251F", fontSize: 20, fontWeight: "900" }, noteSubtitle: { color: "#64716B", fontSize: 12, marginTop: 3 }, saveState: { color: "#28634E", fontSize: 12, fontWeight: "800" }, noteInput: { backgroundColor: "#FFFFFF", borderColor: "#E4E8E3", borderRadius: 14, borderWidth: 1, color: "#18251F", flex: 1, fontSize: 17, lineHeight: 25, minHeight: 260, padding: 16 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(12, 25, 18, 0.48)" }, modalCard: { maxHeight: "88%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, backgroundColor: "#F7F5EF" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }, modalTitle: { color: "#18251F", fontSize: 22, fontWeight: "900" }, close: { color: "#28634E", fontWeight: "900" },
  modalBody: { color: "#64716B", lineHeight: 21, marginBottom: 18 }, fieldLabel: { color: "#64716B", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 14, marginBottom: 7 },
});
