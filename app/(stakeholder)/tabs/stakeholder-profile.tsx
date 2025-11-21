// =============================================================
// File: app/(stakeholder)/tabs/stakeholder-profile.tsx
// Purpose: Stakeholder profile with aesthetic bottom-sheet editor
// Notes: Shows all infos; popup editor; safe-area; photo controls
// =============================================================

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  SafeAreaView,
  KeyboardAvoidingView,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { BASE_URL } from '../../../src/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_URL = BASE_URL;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const GREEN = '#2e7d32';
const LIGHT_GREEN_BG = '#f7fbf7';
const HANDLE_GREY = '#d9d9d9';

// Responsive widths
const LABEL_W = Math.min(140, Math.floor(screenWidth * 0.42));
const NOTIF_LABEL_W = Math.min(120, Math.floor(screenWidth * 0.38));

/* ------------ Compact read-only row (prevents clipping) ------------ */
function DisplayRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | undefined | null;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={GREEN} />
      <Text
        style={[styles.label, { flexBasis: LABEL_W, maxWidth: LABEL_W }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={styles.valueWrap}>
        <Text style={styles.valueText} numberOfLines={1} ellipsizeMode="tail">
          {value || '—'}
        </Text>
      </View>
    </View>
  );
}

/* --------------------------- Edit Sheet ---------------------------- */
function EditDetailsSheet({
  visible,
  initial,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: { name: string; mobile: string; address: string; farmLocation: string; email: string };
  saving: boolean;
  onClose: () => void;
  onSave: (draft: { name: string; mobile: string; address: string; farmLocation: string }) => void;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  const [name, setName] = useState(initial.name);
  const [mobile, setMobile] = useState(initial.mobile);
  const [address, setAddress] = useState(initial.address);
  const [farmLocation, setFarmLocation] = useState(initial.farmLocation);

  // Sync fields each time sheet opens with new data
  useEffect(() => {
    if (visible) {
      setName(initial.name);
      setMobile(initial.mobile);
      setAddress(initial.address);
      setFarmLocation(initial.farmLocation);
    }
  }, [visible, initial]);

  // Animate open/close
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: 240,
          useNativeDriver: true,
          easing: Easing.in(Easing.cubic),
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, backdrop]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      hardwareAccelerated
    >
      {/* Backdrop (tap to close) */}
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            sheetStyles.backdrop,
            {
              opacity: backdrop.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.6],
              }),
            },
          ]}
        />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[
          sheetStyles.sheet,
          { transform: [{ translateY }] },
        ]}
      >
        {/* Handle */}
        <View style={sheetStyles.handleWrap}>
          <View style={sheetStyles.handle} />
        </View>

        {/* Header */}
        <View style={sheetStyles.header}>
          <Text style={sheetStyles.headerTitle}>Edit Details</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close editor">
            <Ionicons name="close" size={22} color="#222" />
          </TouchableOpacity>
        </View>

        {/* Form (safe-area aware) */}
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: undefined })}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ paddingBottom: (insets.bottom || 16) + 80 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Email (read-only) */}
            <View style={sheetStyles.inputRow}>
              <Text style={sheetStyles.inputLabel}>Email</Text>
              <View style={sheetStyles.inputFieldRO}>
                <Ionicons name="mail-outline" size={18} color="#777" />
                <Text style={sheetStyles.readonlyText} numberOfLines={1}>
                  {initial.email || '—'}
                </Text>
              </View>
            </View>

            {/* Full Name */}
            <View style={sheetStyles.inputRow}>
              <Text style={sheetStyles.inputLabel}>Full Name</Text>
              <View style={sheetStyles.inputField}>
                <Ionicons name="person-outline" size={18} color={GREEN} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={sheetStyles.input}
                  placeholder="Enter Full Name"
                  placeholderTextColor="#9e9e9e"
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Mobile */}
            <View style={sheetStyles.inputRow}>
              <Text style={sheetStyles.inputLabel}>Mobile</Text>
              <View style={sheetStyles.inputField}>
                <Ionicons name="call-outline" size={18} color={GREEN} />
                <TextInput
                  value={mobile}
                  onChangeText={setMobile}
                  style={sheetStyles.input}
                  placeholder="09xxxxxxxxx"
                  placeholderTextColor="#9e9e9e"
                  keyboardType="phone-pad"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Address */}
            <View style={sheetStyles.inputRow}>
              <Text style={sheetStyles.inputLabel}>Address</Text>
              <View style={sheetStyles.inputField}>
                <Ionicons name="home-outline" size={18} color={GREEN} />
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  style={sheetStyles.input}
                  placeholder="Enter Address"
                  placeholderTextColor="#9e9e9e"
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Farm Location */}
            <View style={sheetStyles.inputRow}>
              <Text style={sheetStyles.inputLabel}>Farm Location</Text>
              <View style={sheetStyles.inputField}>
                <Ionicons name="map-outline" size={18} color={GREEN} />
                <TextInput
                  value={farmLocation}
                  onChangeText={setFarmLocation}
                  style={sheetStyles.input}
                  placeholder="Enter Farm Location"
                  placeholderTextColor="#9e9e9e"
                  returnKeyType="done"
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Footer actions (sticky, above gesture bar) */}
        <View
          style={[
            sheetStyles.footer,
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#fff',
              paddingBottom: Math.max(insets.bottom, 8),
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: '#e5e7eb',
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: -2 },
              elevation: 6,
            },
          ]}
        >
          <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose} disabled={saving}>
            <Text style={sheetStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[sheetStyles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={() => {
              if (!name.trim()) {
                Alert.alert('Missing name', 'Please enter your full name.');
                return;
              }
              onSave({
                name: name.trim(),
                mobile: mobile.trim(),
                address: address.trim(),
                farmLocation: farmLocation.trim(),
              });
            }}
            disabled={saving}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                <Text style={sheetStyles.saveText}>Saving…</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={sheetStyles.saveText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

/* ------------------------ Main Profile Screen ----------------------- */
export default function StakeholderProfileScreen() {
  const router = useRouter();
  const { user, token, logout, refreshMe } = useAuth();

  const [editing, setEditing] = useState(false); // controls sheet visibility
  const [saving, setSaving] = useState(false);

  // mirrors for initial sheet data
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [farmLocation, setFarmLocation] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');

  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageTimestamp, setImageTimestamp] = useState(Date.now());
  const [modalVisible, setModalVisible] = useState(false);
  const previousPhotoUrlRef = useRef<string | undefined | null>(null);

  // Load user to local mirrors
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAddress(user.address || '');
      setFarmLocation(user.farmLocation || '');
      setMobile(user.mobile || '');
      setEmail(user.email || '');
    }
  }, [user]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          setRefreshing(true);
          await refreshMe();
        } finally {
          if (mounted) setRefreshing(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [refreshMe])
  );

  // Force image reload if photo changes
  useEffect(() => {
    const currentPhotoUrl = user?.photoUrl;
    if (currentPhotoUrl !== previousPhotoUrlRef.current) {
      setImageTimestamp(Date.now());
      previousPhotoUrlRef.current = currentPhotoUrl;
    }
  }, [user?.photoUrl]);

  // Photo source (server or local preview)
  const fullPhotoUrl = profilePreview || user?.photoUrl || null;
  const profileSource = fullPhotoUrl
    ? { uri: fullPhotoUrl.startsWith('http') ? fullPhotoUrl : `${BASE_URL}${fullPhotoUrl}?t=${imageTimestamp}` }
    : null;

  // Upload photo
  const changePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Please allow photo library access.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const localUri = Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', '');
      setProfilePreview(localUri);
      setImageTimestamp(Date.now());

      setUploading(true);
      const fd = new FormData();
      fd.append('photo', {
        uri: localUri,
        name: `profile_${user?._id || 'user'}.jpg`,
        type: (asset as any).mimeType || 'image/jpeg',
      } as any);

      await axios.post(`${API_URL}/api/users/me/photo`, fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
        timeout: 30000,
      });

      await refreshMe();
      Alert.alert('Success', 'Profile photo updated!');
    } catch (err: any) {
      console.error('Upload error:', err?.response?.data || err?.message);
      Alert.alert('Upload failed', 'Failed to upload photo. Check connection/server logs.');
    } finally {
      setUploading(false);
      setProfilePreview(null);
    }
  };

  // Delete photo
  const deletePhoto = () => {
    if (!user?.photoUrl) {
      Alert.alert('No Photo', 'There is no custom profile picture to delete.');
      return;
    }
    Alert.alert('Confirm Deletion', 'Delete your profile picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            await axios.delete(`${API_URL}/api/auth/me/photo`, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 30000,
            });
            await refreshMe();
            setModalVisible(false);
            Alert.alert('Success', 'Profile picture deleted.');
          } catch (err: any) {
            console.error('Delete error:', err?.response?.data || err?.message || err);
            Alert.alert('Error', err?.response?.data?.error || err?.message || 'Failed to delete photo.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  // Save details (patch + refresh + close)
  const saveDetails = async (draft: { name: string; mobile: string; address: string; farmLocation: string }) => {
    try {
      setSaving(true);
      await axios.patch(
        `${API_URL}/api/auth/me`,
        {
          name: draft.name,
          mobile: draft.mobile,
          address: draft.address,
          farmLocation: draft.farmLocation,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshMe();
      setEditing(false);
      Alert.alert('Success', 'Profile details updated!');
    } catch (err: any) {
      console.error('Save details error:', err.response?.data);
      Alert.alert('Error', err.response?.data?.error || 'Failed to save details.');
    } finally {
      setSaving(false);
    }
  };

  const [pushNotif, setPushNotif] = useState(true);
  const [promoNotif, setPromoNotif] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 110, paddingTop: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await refreshMe();
                setRefreshing(false);
              }}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header arc */}
          <View style={styles.topArc} />
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Profile block */}
          <View style={styles.profileSection}>
            <View style={styles.profilePicWrapper}>
              <TouchableOpacity
                onPress={() => {
                  if (user?.photoUrl) setModalVisible(true);
                  else Alert.alert('No Photo', 'Tap the camera icon to upload a picture.');
                }}
                activeOpacity={0.8}
                style={styles.profilePicContainer}
              >
                {profileSource ? (
                  <Image key={imageTimestamp} source={profileSource} style={styles.profilePic} />
                ) : (
                  <View style={[styles.profilePic, styles.defaultAvatar]}>
                    <Ionicons name="person" size={60} color="#fff" />
                  </View>
                )}

                <TouchableOpacity
                  style={styles.editPhotoOverlay}
                  onPress={changePhoto}
                  activeOpacity={0.8}
                  disabled={uploading}
                >
                  <Ionicons name="camera-outline" size={24} color="#fff" />
                </TouchableOpacity>

                {(uploading || profilePreview) && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.name}>{user?.name ?? 'No Name Set'}</Text>
            <Text style={styles.email}>{user?.email || '—'}</Text>
          </View>

          {/* Account info */}
          <View style={styles.content}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Account</Text>
              <TouchableOpacity style={styles.editChip} onPress={() => setEditing(true)}>
                <Ionicons name="create-outline" size={16} color={GREEN} />
                <Text style={styles.editChipText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.box}>
              <DisplayRow label="Full Name" value={user?.name} icon="person-outline" />
              <View style={styles.divider} />
              <DisplayRow label="Email" value={user?.email} icon="mail-outline" />
              <View style={styles.divider} />
              <DisplayRow label="Mobile" value={user?.mobile} icon="call-outline" />
              <View style={styles.divider} />
              <DisplayRow label="Address" value={user?.address} icon="home-outline" />
              <View style={styles.divider} />
              <DisplayRow label="Farm Location" value={user?.farmLocation} icon="map-outline" />
            </View>

            {/* Notifications */}
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.box}>
              <View style={styles.row}>
                <Ionicons name="notifications-outline" size={20} color={GREEN} />
                <Text
                  style={[styles.label, { width: NOTIF_LABEL_W, flexShrink: 1 }]}
                  numberOfLines={1}
                >
                  Push Notifications
                </Text>
                <Switch
                  value={pushNotif}
                  onValueChange={setPushNotif}
                  style={styles.switch}
                  trackColor={{ false: '#ccc', true: '#a5d6a7' }}
                  thumbColor={pushNotif ? GREEN : '#f4f3f4'}
                />
              </View>
              <View style={styles.row}>
                <Ionicons name="megaphone-outline" size={20} color={GREEN} />
                <Text
                  style={[styles.label, { width: NOTIF_LABEL_W, flexShrink: 1 }]}
                  numberOfLines={1}
                >
                  Promotional Notifications
                </Text>
                <Switch
                  value={promoNotif}
                  onValueChange={setPromoNotif}
                  style={styles.switch}
                  trackColor={{ false: '#ccc', true: '#a5d6a7' }}
                  thumbColor={promoNotif ? GREEN : '#f4f3f4'}
                />
              </View>
            </View>

            {/* More */}
            <Text style={styles.sectionTitle}>More</Text>
            <View style={styles.box}>
              <TouchableOpacity style={styles.row} onPress={() => router.push('/about')}>
                <Ionicons name="information-circle-outline" size={20} color={GREEN} />
                <Text style={[styles.label, { flex: 1 }]} numberOfLines={1}>
                  About
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  await logout();
                  router.replace('/login');
                }}
                style={styles.row}
              >
                <Ionicons name="log-out-outline" size={20} color={GREEN} />
                <Text style={[styles.label, { flex: 1 }]} numberOfLines={1}>
                  Log Out
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Fullscreen Photo Modal */}
          <Modal
            animationType="fade"
            transparent
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={modalStyles.container}>
              <TouchableOpacity
                style={modalStyles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close-circle" size={40} color="#fff" />
              </TouchableOpacity>

              {profileSource ? (
                <Image source={profileSource} style={modalStyles.image} resizeMode="contain" />
              ) : (
                <View
                  style={[
                    modalStyles.image,
                    { justifyContent: 'center', alignItems: 'center' },
                  ]}
                >
                  <Ionicons name="person" size={200} color="#ccc" />
                  <Text style={{ color: '#fff', marginTop: 10 }}>
                    No custom profile picture set.
                  </Text>
                </View>
              )}

              {user?.photoUrl && (
                <TouchableOpacity
                  style={modalStyles.deleteButton}
                  onPress={deletePhoto}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="trash-outline" size={24} color="#fff" />
                  )}
                  <Text style={modalStyles.deleteText}>Delete Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Sheet Editor */}
      <EditDetailsSheet
        visible={editing}
        saving={saving}
        initial={{ name, mobile, address, farmLocation, email }}
        onClose={() => setEditing(false)}
        onSave={saveDetails}
      />
    </SafeAreaView>
  );
}

/* ------------------------------ Styles ------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  topArc: {
    height: 120,
    backgroundColor: GREEN,
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: -1,
  },
  backButton: { position: 'absolute', top: 60, left: 20, zIndex: 10 },

  profileSection: { marginTop: 70, alignItems: 'center', marginBottom: 18 },
  profilePicWrapper: { position: 'relative' },
  profilePic: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderColor: '#fff',
    borderWidth: 3,
  },
  defaultAvatar: { backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  profilePicContainer: {
    position: 'relative',
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  editPhotoOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 10,
  },
  uploadOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 21,
    fontWeight: 'bold',
    marginTop: 12,
    color: '#000',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  email: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 12,
  },

  content: { paddingHorizontal: 21 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: GREEN,
    marginBottom: 6,
    marginTop: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GREEN,
    backgroundColor: '#fff',
  },
  editChipText: { color: GREEN, fontWeight: '600' },

  box: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 17,
    shadowColor: '#0F9334',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 11,
    minHeight: 40,
    minWidth: 0,
  },

  divider: { height: 1, backgroundColor: '#eee', marginVertical: 6 },

  label: { marginLeft: 6, fontSize: 16, color: '#333', flexShrink: 1 },

  valueWrap: { flex: 1, minWidth: 0 },

  valueText: {
    fontSize: 14,
    color: '#222',
    textAlign: 'right',
  },

  switch: { transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }], marginLeft: 'auto' },
});

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 1,
  },
  image: {
    width: screenWidth,
    height: screenHeight,
  },
  deleteButton: {
    position: 'absolute',
    bottom: 150,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FF4D4D',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  deleteText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

const sheetStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: screenHeight * 0.82,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 6,
    paddingHorizontal: 16,
    // bottom padding handled by sticky footer
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  handleWrap: { alignItems: 'center', paddingTop: 4, paddingBottom: 8 },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: HANDLE_GREY,
  },
  header: {
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  inputRow: { marginTop: 12 },
  inputLabel: { fontSize: 13, color: '#374151', marginBottom: 6 },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT_GREEN_BG,
    borderWidth: 1,
    borderColor: '#a5d6a7',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  inputFieldRO: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  input: { flex: 1, fontSize: 14, color: '#111827', paddingVertical: 0 },
  readonlyText: { flex: 1, fontSize: 14, color: '#374151' },
  footer: {
    paddingTop: 8,
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c7d8c8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  cancelText: { color: '#374151', fontWeight: '700' },
  saveBtn: {
    flex: 2,
    borderRadius: 999,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginLeft: -10,
    flexDirection: 'row',
  },
  saveText: { color: '#fff', fontWeight: '700', paddingHorizontal: 4, marginLeft: 2, paddingVertical:2},
});
