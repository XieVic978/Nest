import * as Clipboard from "expo-clipboard";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useSession } from "@/auth/ctx";
import { useRoom } from "@/features/rooms/RoomProvider";
import { type SharedNote, useSharedNotes } from "@/features/shared-data/useSharedNotes";

const PIN_LENGTH = 4;

export default function NotesScreen() {
  const { nestJoinCode, room, user } = useRoom();
  const { resetDocumentPin, verifyDocumentPin } = useSession();
  const { create, error: notesError, loading: notesLoading, notes, remove, save } = useSharedNotes(room?.room.id ?? "", user?.id ?? "");
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
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<SharedNote | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Tabs remain mounted. Always lock Notes as soon as this tab loses focus.
  useFocusEffect(useCallback(() => {
    setUnlocked(false); setPin(""); setError(null); setNotice(null);
    const timer = setTimeout(() => pinInput.current?.focus(), 250);
    return () => { clearTimeout(timer); Keyboard.dismiss(); setUnlocked(false); setPin(""); setResetVisible(false); setEditorVisible(false); };
  }, []));

  async function unlock() {
    Keyboard.dismiss(); setChecking(true); setError(null);
    const result = await verifyDocumentPin(pin);
    setChecking(false);
    if (!result.ok) return setError(result.error);
    setPin(""); setUnlocked(true);
  }

  function openReset() {
    Keyboard.dismiss(); setResetError(null); setAccountPassword(""); setNewPin(""); setConfirmPin(""); setResetVisible(true);
  }

  async function handleReset() {
    if (!accountPassword) return setResetError("Enter your account password.");
    if (!/^\d{4}$/.test(newPin)) return setResetError("Choose a four-digit Notes PIN.");
    if (newPin !== confirmPin) return setResetError("Your new PIN entries do not match.");
    Keyboard.dismiss(); setResetting(true); setResetError(null);
    const result = await resetDocumentPin(accountPassword, newPin);
    setResetting(false);
    if (!result.ok) return setResetError(result.error);
    setResetVisible(false); setAccountPassword(""); setNewPin(""); setConfirmPin(""); setPin(""); setUnlocked(false);
    setNotice("PIN reset. Enter your new PIN to unlock Notes.");
    setTimeout(() => pinInput.current?.focus(), 250);
  }

  function openNote(note?: SharedNote) {
    Keyboard.dismiss(); setEditingNote(note ?? null); setNoteTitle(note?.title ?? ""); setNoteContent(note?.content ?? ""); setEditorVisible(true);
  }

  async function saveNote() {
    if (!noteTitle.trim() && !noteContent.trim()) return Alert.alert("Add a note", "Write a title or some note content first.");
    Keyboard.dismiss(); setSavingNote(true);
    try {
      if (editingNote) await save(editingNote.id, { title: noteTitle, content: noteContent });
      else await create({ title: noteTitle, content: noteContent });
      setEditorVisible(false);
    } catch (caught) {
      Alert.alert("Couldn’t save note", caught instanceof Error ? caught.message : "Please try again.");
    } finally { setSavingNote(false); }
  }

  function confirmDelete(note: SharedNote) {
    Alert.alert("Delete note?", `Delete “${note.title}”? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void remove(note.id).catch((caught) => Alert.alert("Couldn’t delete note", caught instanceof Error ? caught.message : "Please try again.")) },
    ]);
  }

  async function copyNestCode() {
    if (!nestJoinCode) return;
    await Clipboard.setStringAsync(nestJoinCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2_000);
  }

  return <View style={styles.screen}>
    <Text style={styles.title}>Notes</Text>
    {!unlocked ? <>
      <Text style={styles.body}>Enter your four-digit Nest PIN to access shared notes and your permanent Nest code.</Text>
      <TextInput ref={pinInput} accessibilityLabel="Four digit PIN" autoFocus keyboardType="number-pad" maxLength={PIN_LENGTH} onChangeText={(value) => { setPin(value); setError(null); }} onSubmitEditing={() => void unlock()} placeholder="4-digit PIN" secureTextEntry style={styles.input} textContentType="oneTimeCode" value={pin} />
      <Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={styles.dismissKeyboard}><Text style={styles.dismissKeyboardText}>Done entering PIN</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={pin.length !== PIN_LENGTH || checking} onPress={() => void unlock()} style={[styles.button, (pin.length !== PIN_LENGTH || checking) && styles.disabled]}><Text style={styles.buttonText}>{checking ? "Checking…" : "Unlock notes"}</Text></Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Pressable accessibilityRole="button" onPress={openReset} style={styles.resetLink}><Text style={styles.resetLinkText}>Forgot your PIN? Reset it</Text></Pressable>
    </> : <>
      <View style={styles.notesHeader}><View><Text style={styles.sectionTitle}>Shared notes</Text><Text style={styles.sectionBody}>A shared space for your household.</Text></View><Pressable accessibilityRole="button" onPress={() => openNote()} style={styles.newNoteButton}><Text style={styles.newNoteText}>+ New</Text></Pressable></View>
      {notesError ? <Text style={styles.error}>Couldn’t load notes: {notesError}</Text> : null}
      {!notesLoading && !notes.length ? <View style={styles.emptyNotes}><Text style={styles.emptyNotesTitle}>No notes yet</Text><Text style={styles.emptyNotesBody}>Keep house details, plans, and reminders together.</Text><Pressable accessibilityRole="button" onPress={() => openNote()} style={styles.button}><Text style={styles.buttonText}>Create first note</Text></Pressable></View> : null}
      {notes.map((note) => <Pressable key={note.id} accessibilityRole="button" onPress={() => openNote(note)} style={styles.noteCard}><Text numberOfLines={1} style={styles.noteTitle}>{note.title}</Text><Text numberOfLines={2} style={styles.notePreview}>{note.content || "No additional text"}</Text><Text style={styles.noteDate}>Updated {new Date(note.updatedAt).toLocaleDateString()}</Text></Pressable>)}
      <Text style={styles.label}>PERMANENT NEST CODE</Text>
      <Pressable accessibilityLabel="Copy permanent Nest code" accessibilityRole="button" onPress={() => void copyNestCode()} style={({ pressed }) => [styles.code, pressed && styles.codePressed]}><View><Text style={styles.codeText}>{nestJoinCode ?? "Loading…"}</Text><Text style={styles.copy}>{codeCopied ? "COPIED ✓" : "TAP TO COPY"}</Text></View><Text style={styles.copyIcon}>⧉</Text></Pressable>
    </>}

    <PinResetModal visible={resetVisible} busy={resetting} password={accountPassword} newPin={newPin} confirmPin={confirmPin} error={resetError} onClose={() => setResetVisible(false)} onPassword={setAccountPassword} onNewPin={setNewPin} onConfirmPin={setConfirmPin} onReset={() => void handleReset()} />
    <NoteEditor visible={editorVisible} note={editingNote} title={noteTitle} content={noteContent} busy={savingNote} onClose={() => setEditorVisible(false)} onTitle={setNoteTitle} onContent={setNoteContent} onSave={() => void saveNote()} onDelete={() => { if (editingNote) { setEditorVisible(false); confirmDelete(editingNote); } }} />
  </View>;
}

function PinResetModal({ visible, busy, password, newPin, confirmPin, error, onClose, onPassword, onNewPin, onConfirmPin, onReset }: { visible: boolean; busy: boolean; password: string; newPin: string; confirmPin: string; error: string | null; onClose: () => void; onPassword: (value: string) => void; onNewPin: (value: string) => void; onConfirmPin: (value: string) => void; onReset: () => void }) {
  return <Modal animationType="slide" onRequestClose={() => !busy && onClose()} transparent visible={visible}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}><View accessibilityViewIsModal style={styles.modalCard}><ModalHeader title="Reset Notes PIN" onClose={onClose} disabled={busy} /><ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"><Text style={styles.modalBody}>Confirm your account password, then choose a new four-digit PIN.</Text><Text style={styles.fieldLabel}>ACCOUNT PASSWORD</Text><TextInput autoComplete="current-password" autoFocus onChangeText={onPassword} placeholder="Your account password" secureTextEntry style={styles.input} textContentType="password" value={password} /><Text style={styles.fieldLabel}>NEW FOUR-DIGIT PIN</Text><TextInput keyboardType="number-pad" maxLength={PIN_LENGTH} onChangeText={onNewPin} placeholder="••••" secureTextEntry style={styles.input} value={newPin} /><Text style={styles.fieldLabel}>CONFIRM NEW PIN</Text><TextInput keyboardType="number-pad" maxLength={PIN_LENGTH} onChangeText={onConfirmPin} onSubmitEditing={onReset} placeholder="••••" secureTextEntry style={styles.input} value={confirmPin} /><Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={styles.dismissKeyboard}><Text style={styles.dismissKeyboardText}>Done entering</Text></Pressable>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={busy} onPress={onReset} style={[styles.button, busy && styles.disabled]}><Text style={styles.buttonText}>{busy ? "Resetting…" : "Reset PIN"}</Text></Pressable></ScrollView></View></KeyboardAvoidingView></Modal>;
}

function NoteEditor({ visible, note, title, content, busy, onClose, onTitle, onContent, onSave, onDelete }: { visible: boolean; note: SharedNote | null; title: string; content: string; busy: boolean; onClose: () => void; onTitle: (value: string) => void; onContent: (value: string) => void; onSave: () => void; onDelete: () => void }) {
  return <Modal animationType="slide" onRequestClose={() => !busy && onClose()} transparent visible={visible}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}><View accessibilityViewIsModal style={styles.modalCard}><ModalHeader title={note ? "Edit note" : "New note"} onClose={onClose} disabled={busy} /><ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"><Text style={styles.fieldLabel}>TITLE</Text><TextInput autoFocus maxLength={160} onChangeText={onTitle} placeholder="Note title" style={styles.input} value={title} /><Text style={styles.fieldLabel}>NOTE</Text><TextInput multiline onChangeText={onContent} placeholder="Write something for your roommates…" style={[styles.input, styles.noteInput]} textAlignVertical="top" value={content} /><Pressable accessibilityRole="button" onPress={Keyboard.dismiss} style={styles.dismissKeyboard}><Text style={styles.dismissKeyboardText}>Done typing</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={onSave} style={[styles.button, busy && styles.disabled]}><Text style={styles.buttonText}>{busy ? "Saving…" : "Save note"}</Text></Pressable>{note ? <Pressable accessibilityRole="button" disabled={busy} onPress={onDelete} style={styles.deleteButton}><Text style={styles.deleteText}>Delete note</Text></Pressable> : null}</ScrollView></View></KeyboardAvoidingView></Modal>;
}

function ModalHeader({ title, onClose, disabled }: { title: string; onClose: () => void; disabled: boolean }) { return <View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable accessibilityRole="button" disabled={disabled} onPress={onClose}><Text style={styles.close}>Close</Text></Pressable></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F5EF", padding: 24, paddingTop: 72 }, title: { fontSize: 30, fontWeight: "800", color: "#18251F", marginBottom: 12 }, body: { color: "#64716B", lineHeight: 21, marginBottom: 20 }, input: { backgroundColor: "white", borderWidth: 1, borderColor: "#E4E8E3", borderRadius: 12, padding: 15, fontSize: 16 }, button: { backgroundColor: "#28634E", borderRadius: 12, padding: 15, marginTop: 12, alignItems: "center" }, buttonText: { color: "white", fontWeight: "800" }, disabled: { opacity: 0.5 }, error: { color: "#B6453C", marginTop: 12, fontWeight: "600" }, notice: { color: "#28634E", marginTop: 12, fontWeight: "600" }, dismissKeyboard: { alignSelf: "flex-end", paddingVertical: 10, paddingHorizontal: 2 }, dismissKeyboardText: { color: "#28634E", fontSize: 13, fontWeight: "800" }, resetLink: { alignSelf: "flex-start", marginTop: 16 }, resetLinkText: { color: "#28634E", fontSize: 14, fontWeight: "800" }, notesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }, sectionTitle: { color: "#18251F", fontSize: 21, fontWeight: "900" }, sectionBody: { color: "#64716B", fontSize: 13, marginTop: 3 }, newNoteButton: { backgroundColor: "#28634E", borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 }, newNoteText: { color: "#FFFFFF", fontWeight: "900" }, emptyNotes: { alignItems: "center", borderRadius: 16, borderColor: "#E4E8E3", borderWidth: 1, backgroundColor: "#FFFFFF", padding: 20 }, emptyNotesTitle: { color: "#18251F", fontSize: 17, fontWeight: "900" }, emptyNotesBody: { color: "#64716B", textAlign: "center", lineHeight: 19, marginTop: 6 }, noteCard: { borderRadius: 14, borderColor: "#E4E8E3", borderWidth: 1, backgroundColor: "#FFFFFF", padding: 14, marginBottom: 9 }, noteTitle: { color: "#18251F", fontSize: 16, fontWeight: "900" }, notePreview: { color: "#64716B", lineHeight: 18, marginTop: 5 }, noteDate: { color: "#89938E", fontSize: 11, fontWeight: "700", marginTop: 8 }, label: { color: "#64716B", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 20, marginBottom: 7 }, code: { alignItems: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#B7D7C4", borderRadius: 12, flexDirection: "row", justifyContent: "space-between", padding: 16 }, codePressed: { backgroundColor: "#E3F2E8", transform: [{ scale: 0.98 }] }, codeText: { color: "#18251F", fontSize: 22, fontWeight: "900", letterSpacing: 2 }, copy: { color: "#28634E", fontSize: 10, fontWeight: "800", marginTop: 5 }, copyIcon: { color: "#28634E", fontSize: 24, fontWeight: "800" }, modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(12, 25, 18, 0.48)" }, modalCard: { maxHeight: "88%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, backgroundColor: "#F7F5EF" }, modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }, modalTitle: { color: "#18251F", fontSize: 22, fontWeight: "900" }, close: { color: "#28634E", fontWeight: "900" }, modalBody: { color: "#64716B", lineHeight: 21, marginBottom: 18 }, fieldLabel: { color: "#64716B", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 14, marginBottom: 7 }, noteInput: { minHeight: 180 }, deleteButton: { alignItems: "center", borderColor: "#B6453C", borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 12, marginBottom: 8 }, deleteText: { color: "#B6453C", fontWeight: "900" },
});
