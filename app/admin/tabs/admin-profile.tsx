// =============================================================
// File: app/admin/tabs/admin-profile.tsx
// Purpose: Admin profile screen with account info, settings,
//          and tap-to-change profile photo (uploads to backend)
// =============================================================

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Modal, // ADDED: For image viewing
  Dimensions, // ADDED: For modal styles
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { BASE_URL } from '../../../src/api';

const API_URL = BASE_URL;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window'); // ADDED

// Define the default profile picture asset (Used as a fallback type only)
const DEFAULT_AVATAR = require('../../../assets/images/profile-pic.png');

export default function AdminProfileScreen() {
  const router = useRouter();
  const { user, token, refreshMe, logout } = useAuth();
  const [pushNotif, setPushNotif] = useState(true);
  const [promoNotif, setPromoNotif] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false); // NEW STATE for delete action
  const [imageTimestamp, setImageTimestamp] = useState(Date.now());
  const [modalVisible, setModalVisible] = useState(false); // ADDED: State for image viewer modal
  const previousPhotoUrlRef = useRef<string | undefined | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (token) {
        refreshMe().catch((err) => {
          if (isMounted) console.error('Error refreshing user on focus:', err);
        });
      }
      return () => {
        isMounted = false;
      };
    }, [token, refreshMe])
  );

  useEffect(() => {
    const currentPhotoUrl = user?.photoUrl;
    if (currentPhotoUrl !== previousPhotoUrlRef.current) {
      setImageTimestamp(Date.now());
      previousPhotoUrlRef.current = currentPhotoUrl;
    }
  }, [user?.photoUrl]);

  const name = user?.name || '—';
  const email = user?.email || '—';
  const mobile = user?.mobile || '—';
  const address = user?.address || '—';
  const farmLocation = user?.farmLocation || '—';

  // Photo Source logic: Uses DEFAULT_AVATAR if no user photoUrl is set
  const buildPhotoUrl = (u?: string | null) => {
    if (!u) return null;
    const raw = u.startsWith('http') ? u : `${API_URL}${u}`;
    return `${raw}?t=${imageTimestamp}`;
  };
  
  const fullPhotoUrl = buildPhotoUrl(user?.photoUrl);

  const profileSource = fullPhotoUrl
    ? { uri: fullPhotoUrl }
    : null; // Use null here to trigger the Ionicons default avatar view

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

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setUploading(true);

      const form = new FormData();
      form.append(
        'photo',
        {
          uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
          name: `profile_${user?._id || 'user'}.jpg`,
          type: (asset as any).mimeType ?? 'image/jpeg',
        } as any
      );

      await axios.post(`${API_URL}/api/users/me/photo`, form, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
        timeout: 30000,
      });

      await refreshMe();
      Alert.alert('Success', 'Profile photo updated!');
    } catch (err: any) {
      console.error('Upload error (axios):', err?.response?.data || err?.message || err);
      if (err?.message === 'Network Error') {
        Alert.alert('Upload failed', 'Cannot connect to the server. Check your connection/server.');
      } else if (err?.code === 'ECONNABORTED') {
        Alert.alert('Upload failed', 'The request timed out. Please try again.');
      } else {
        Alert.alert('Upload failed', err?.response?.data?.message || err?.message || 'Try again.');
      }
    } finally {
      setUploading(false);
    }
  };
  
  // NEW FUNCTION: Handles the deletion of the profile picture
  const deletePhoto = () => {
    if (!user?.photoUrl) {
      Alert.alert('No Photo', 'There is no custom profile picture to delete.');
      return;
    }
    
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete your profile picture? This action cannot be undone and your default avatar will be shown.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              // Assuming a DELETE route exists for user photo
              await axios.delete(`${API_URL}/api/auth/me/photo`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 30000,
              });
              
              await refreshMe(); // Refreshes user data, setting photoUrl to null/empty
              setModalVisible(false); // Close modal on success
              Alert.alert('Success', 'Profile picture deleted.');
            } catch (err: any) {
              console.error('Delete error:', err?.response?.data || err?.message || err);
              Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to delete photo.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topArc} />
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.profileSection}>
        <View style={styles.profilePicContainer}>
          {/* CONDITIONAL TAPPING: Only enable viewing/modal if a photo is set */}
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
              // NEW: Facebook-style default avatar
              <View style={[styles.profilePic, styles.defaultAvatar]}>
                <Ionicons name="person" size={60} color="#fff" />
              </View>
            )}
            
            {/* Edit/Upload button overlay over the image */}
            <TouchableOpacity 
                style={styles.editPhotoOverlay}
                onPress={changePhoto}
                activeOpacity={0.8}
                disabled={uploading}
          >
              <Ionicons name="camera-outline" size={18} color="#fff" />
          </TouchableOpacity>

          {/* Delete Profile Picture Overlay (Only rendered inside modal now) */}
          
          {uploading && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>
        

        <Text style={[styles.name, { color: '#000' }]}>{name}</Text> {/* Set name to black */}
        <Text style={[styles.email, { color: '#555' }]}>{email}</Text> {/* Set email to dark gray */}
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.box}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/personal-info')}>
            <Ionicons name="person-outline" size={20} color="#2e7d32" />
            <Text style={styles.label}>Personal Information</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <InfoRow icon="call-outline" label="Mobile" value={mobile} />
          <InfoRow icon="home-outline" label="Address" value={address} />
          <InfoRow icon="map-outline" label="Farm Location" value={farmLocation} />
        </View>

        {/* Notifications Block */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.box}>
          <View style={styles.row}>
            <Ionicons name="notifications-outline" size={20} color="#2e7d32" />
            <Text style={styles.label}>Push Notifications</Text>
            <Switch
              value={pushNotif}
              onValueChange={setPushNotif}
              style={styles.switch}
              trackColor={{ false: '#ccc', true: '#a5d6a7' }}
              thumbColor={pushNotif ? '#2e7d32' : '#f4f3f4'}
            />
          </View>
          
        </View>

        <Text style={styles.sectionTitle}>More</Text>
        <View style={styles.box}>
          <TouchableOpacity style={styles.row} onPress={() => router.push('/about')}>
            <Ionicons name="information-circle-outline" size={20} color="#2e7d32" />
            <Text style={styles.label}>About</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#2e7d32" />
            <Text style={styles.label}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* NEW: Profile Picture View Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={modalStyles.container}>
          <TouchableOpacity style={modalStyles.closeButton} onPress={() => setModalVisible(false)}>
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
          {/* Modal Content: Full Image */}
          {profileSource ? (
            <Image 
              source={profileSource}
              style={modalStyles.image} 
              resizeMode="contain" 
            />
          ) : (
            // Fallback for modal if source is somehow null, though theoretically blocked by conditional tap
            <View style={[modalStyles.image, { justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={200} color="#ccc" />
              <Text style={{ color: '#fff', marginTop: 10 }}>No custom profile picture set.</Text>
            </View>
          )}

          {/* Delete Button inside the Modal (only if photo exists) */}
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
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color="#2e7d32" />
      <Text style={[styles.label, { flex: 0.6 }]}>{label}</Text>
      <Text style={{ fontSize: 15, color: '#222', flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topArc: {
    height: 120,
    backgroundColor: '#2e7d32',
    position: 'absolute',
    width: '100%',
    zIndex: -1,
  },
  backButton: { position: 'absolute', top: 60, left: 20, zIndex: 10 },
  profileSection: { marginTop: 70, alignItems: 'center', marginBottom: 18 },
  profilePicContainer: { 
      position: 'relative', 
      width: 100, 
      height: 100, 
      borderRadius: 50
  },
  editPhotoOverlay: { 
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#2e7d32',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#fff',
      zIndex: 10,
  },
  deletePhotoOverlay: { // NEW STYLE for delete icon overlay
      position: 'absolute',
      left: 0,  // Positioned to the left edge
      bottom: 0, // Positioned to the bottom edge
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#FF4D4D', // Red color for delete
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#fff',
      zIndex: 10,
  },
  profilePic: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderColor: '#fff',
    borderWidth: 3,
  },
  defaultAvatar: { // STYLE FOR IONICONS DEFAULT
    backgroundColor: '#ccc', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  uploadOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 21, fontWeight: 'bold', marginTop: 12, color: '#000' }, // SET TO BLACK
  email: { fontSize: 14, color: '#555', marginTop: 2 }, // SET TO DARK GRAY
  deleteText: { fontSize: 13, color: '#FF4D4D', fontWeight: 'bold', marginTop: 5 }, // REMOVED (now an icon)
  tapHint: { fontSize: 12, color: '#777', marginTop: 6 }, // Text hint style
  content: { paddingHorizontal: 21 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 6,
    marginTop: 6,
  },
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
    gap: 8,
    marginBottom: 11,
  },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 6 },
  label: { marginLeft: 6, fontSize: 16, color: '#333', flex: 1 },
  switch: { transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] },
});

// NEW: Styles for the Profile Picture Viewer Modal
const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)', // Dark transparent background
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30, // Adjust for iOS notch
    right: 20,
    zIndex: 1,
  },
  image: {
    width: screenWidth,
    height: screenHeight,
  },
  deleteButton: { // NEW style for delete button inside modal
    position: 'absolute',
    bottom: 30,
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
  }
});
