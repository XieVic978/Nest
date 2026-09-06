import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, InputAccessoryView, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { useRoom } from "@/features/rooms/RoomProvider";
import { useSharedNote } from "@/features/shared-data/useSharedNote";

const PIN_LENGTH = 4;
const KEYBOARD_ACCESSORY_ID = "nest-notes-keyboard-done";

export default function NotesScreen() {
  const { nestJoinCode, room, user } = useRoom();
  const { resetDocumentPin, verifyDocumentPin } = useSession();
  const { error: noteError, loading: noteLoading, note, saveContent } = useSharedNote(room?.room.id ?? "", user?.id ?? "");
  const pinInput = useRef<TextInput>(null);
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [draft, setDraft] = useState("");
  const [edited, setEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useFocusEffect(useCallback(() => {
    setUnlocked(false); setPin(""); setError(null); setNotice(null);
    const timer = setTimeout(() => pinInput.current?.focus(), 250);
    return () => { clearTimeout(timer); Keyboard.dismiss(); setUnlocked(false); setPin(""); setResetVisible(false); };
  }, []));

  // Receive live changes from other roommates unless this person is actively
  // typing. Their draft always wins until it is saved.
  useEffect(() => {
    if (!edited) setDraft(note?.content ?? "");
  }, [edited, note?.content]);

  useEffect(() => {
    if (!unlocked || !edited) return;
    const timer = setTimeout(() => {
      setSaving(true);
      void saveContent(draft)
        .then(() => setEdited(false))
        .catch((caught) => setError(caught instanceof Error ? caught.message : "Couldn’t save your note."))
        .finally(() => setSaving(false));
    }, 650);
    return () => clearTimeout(timer);
  }, [draft, edited, saveContent, unlocked]);

  async function unlock(pinToVerify = pin) {
    Keyboard.dismiss(); setChecking(true); setError(null);
    const result = await verifyDocumentPin(pinToVerify);
    setChecking(false);
    if (!result.ok) return setError(result.error);
    setPin(""); setUnlocked(true);
  }

  async function copyCode() {
    if (!nestJoinCode) return;
    await Clipboard.setStringAsync(nestJoinCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2_000);
  }

  function handlePinChange(value: string) {
    setPin(value);
    setError(null);
    if (value.length === PIN_LENGTH && !checking) void unlock(value);
  }

  function openReset() { Keyboard.dismiss(); setPassword(""); setNewPin(""); setConfirmPin(""); setResetError(null); setResetVisible(true); }

  async function resetPin() {
    if (!password) return setResetError("Enter your account password.");
    if (!/^\d{4}$/.test(newPin)) return setResetError("Choose a four-digit Notes PIN.");
    if (newPin !== confirmPin) return setResetError("Your new PIN entries do not match.");
    Keyboard.dismiss(); setResetting(true); setResetError(null);
    const result = await resetDocumentPin(password, newPin);
    setResetting(false);
    if (!result.ok) return setResetError(result.error);
    setResetVisible(false); setUnlocked(false); setPin(""); setNotice("PIN reset. Enter your new PIN to unlock Notes.");
    setTimeout(() => pinInput.current?.focus(), 250);
  }

  return <View style={styles.screen}>
    <Text style={styles.title}>Notes</Text>
    {!unlocked ? <>
      <Text style={styles.body}>Enter your four-digit Nest PIN to open your shared household note.</Text>
      <TextInput ref={pinInput} accessibilityLabel="Four digit PIN" autoFocus inputAccessoryViewID={KEYBOARD_ACCESSORY_ID} keyboardType="number-pad" maxLength={PIN_LENGTH} onChangeText={handlePinChange} placeholder="4-digit PIN" secureTextEntry style={styles.input} textContentType="oneTimeCode" value={pin} />
      {checking ? <Text style={styles.checking}>Checking PIN…</Text> : <Text style={styles.pinHint}>Notes open automatically after the fourth digit.</Text>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Pressable accessibilityRole="button" onPress={openReset} style={styles.resetLink}><Text style={styles.resetText}>Forgot your PIN? Reset it</Text></Pressable>
    </> : <>
      <Text style={styles.codeLabel}>PERMANENT NEST CODE</Text>
      <Pressable accessibilityLabel="Copy permanent Nest code" accessibilityRole="button" onPress={() => void copyCode()} style={({ pressed }) => [styles.codeCard, pressed && styles.codePressed]}><View><Text style={styles.codeText}>{nestJoinCode ?? "Loading…"}</Text><Text style={styles.copyText}>{codeCopied ? "COPIED ✓" : "TAP TO COPY"}</Text></View><Text style={styles.copyIcon}>⧉</Text></Pressable>
      <View style={styles.noteHeader}><View><Text style={styles.noteTitle}>Shared house note</Text><Text style={styles.noteSubtitle}>Everything saves automatically for your roommates.</Text></View><Text style={styles.saveState}>{saving ? "Saving…" : noteLoading ? "Loading…" : "Live"}</Text></View>
      {noteError ? <Text style={styles.error}>Couldn’t load the shared note: {noteError}</Text> : null}
      <TextInput accessibilityLabel="Shared house note" inputAccessoryViewID={KEYBOARD_ACCESSORY_ID} multiline onChangeText={(value) => { setDraft(value); setEdited(true); }} placeholder="Start writing anything your household needs to remember…" style={styles.noteInput} textAlignVertical="top" value={draft} />
    </>}

    <Modal animationType="slide" onRequestClose={() => !resetting && setResetVisible(false)} transparent visible={resetVisible}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}><View accessibilityViewIsModal style={styles.modalCard}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Reset Notes PIN</Text><Pressable disabled={resetting} onPress={() => setResetVisible(false)}><Text style={styles.close}>Close</Text></Pressable></View><ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"><Text style={styles.body}>Confirm your account password, then choose a new four-digit PIN.</Text><Text style={styles.label}>ACCOUNT PASSWORD</Text><TextInput autoFocus autoComplete="current-password" inputAccessoryViewID={KEYBOARD_ACCESSORY_ID} onChangeText={setPassword} placeholder="Your account password" secureTextEntry style={styles.input} textContentType="password" value={password} /><Text style={styles.label}>NEW FOUR-DIGIT PIN</Text><TextInput inputAccessoryViewID={KEYBOARD_ACCESSORY_ID} keyboardType="number-pad" maxLength={PIN_LENGTH} onChangeText={setNewPin} placeholder="••••" secureTextEntry style={styles.input} value={newPin} /><Text style={styles.label}>CONFIRM NEW PIN</Text><TextInput inputAccessoryViewID={KEYBOARD_ACCESSORY_ID} keyboardType="number-pad" maxLength={PIN_LENGTH} onChangeText={setConfirmPin} onSubmitEditing={() => void resetPin()} placeholder="••••" secureTextEntry style={styles.input} value={confirmPin} />{resetError ? <Text style={styles.error}>{resetError}</Text> : null}<Pressable disabled={resetting} onPress={() => void resetPin()} style={[styles.button, resetting && styles.disabled]}><Text style={styles.buttonText}>{resetting ? "Resetting…" : "Reset PIN"}</Text></Pressable></ScrollView></View></KeyboardAvoidingView></Modal>
    {Platform.OS === "ios" ? <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}><View style={styles.keyboardToolbar}><Pressable accessibilityLabel="Done typing" accessibilityRole="button" hitSlop={8} onPress={Keyboard.dismiss} style={styles.keyboardDone}><Text style={styles.keyboardDoneText}>Done</Text></Pressable></View></InputAccessoryView> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5EF", padding: 24, paddingTop: 72 }, title: { color: "#18251F", fontSize: 30, fontWeight: "800", marginBottom: 12 }, body: { color: "#64716B", lineHeight: 21, marginBottom: 20 }, input: { backgroundColor: "#FFFFFF", borderColor: "#E4E8E3", borderRadius: 12, borderWidth: 1, fontSize: 16, padding: 15 }, button: { alignItems: "center", backgroundColor: "#28634E", borderRadius: 12, marginTop: 12, padding: 15 }, buttonText: { color: "#FFFFFF", fontWeight: "800" }, disabled: { opacity: 0.5 }, error: { color: "#B6453C", fontWeight: "600", marginTop: 12 }, notice: { color: "#28634E", fontWeight: "600", marginTop: 12 }, checking: { color: "#28634E", fontWeight: "800", marginTop: 12 }, pinHint: { color: "#758079", fontSize: 13, marginTop: 12 }, keyboardToolbar: { alignItems: "flex-end", backgroundColor: "#F7F5EF", borderTopColor: "#D8DDD8", borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 8 }, keyboardDone: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12 }, keyboardDoneText: { color: "#28634E", fontSize: 16, fontWeight: "800" }, resetLink: { alignSelf: "flex-start", marginTop: 16 }, resetText: { color: "#28634E", fontSize: 14, fontWeight: "800" }, codeLabel: { color: "#64716B", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 7 }, codeCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#B7D7C4", borderRadius: 12, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: 16 }, codePressed: { backgroundColor: "#E3F2E8", transform: [{ scale: 0.98 }] }, codeText: { color: "#18251F", fontSize: 22, fontWeight: "900", letterSpacing: 2 }, copyText: { color: "#28634E", fontSize: 10, fontWeight: "800", marginTop: 5 }, copyIcon: { color: "#28634E", fontSize: 24, fontWeight: "800" }, noteHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10, marginTop: 24 }, noteTitle: { color: "#18251F", fontSize: 20, fontWeight: "900" }, noteSubtitle: { color: "#64716B", fontSize: 12, marginTop: 3 }, saveState: { color: "#28634E", fontSize: 12, fontWeight: "800" }, noteInput: { backgroundColor: "#FFFFFF", borderColor: "#E4E8E3", borderRadius: 14, borderWidth: 1, color: "#18251F", flex: 1, fontSize: 17, lineHeight: 25, minHeight: 260, padding: 16 }, modalBackdrop: { backgroundColor: "rgba(12, 25, 18, 0.48)", flex: 1, justifyContent: "flex-end" }, modalCard: { backgroundColor: "#F7F5EF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%", padding: 24 }, modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }, modalTitle: { color: "#18251F", fontSize: 22, fontWeight: "900" }, close: { color: "#28634E", fontWeight: "900" }, label: { color: "#64716B", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 7, marginTop: 14 },
});
