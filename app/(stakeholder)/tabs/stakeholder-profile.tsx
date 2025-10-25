// =============================================================
// File: app/(stakeholder)/tabs/stakeholder-profile.tsx
// Purpose: Stakeholder profile screen with editable info & image
// =============================================================

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
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
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../../context/AuthContext';

export default function StakeholderProfileScreen() {
  const router = useRouter();
  const { user, updateUser, logout, refreshMe } = useAuth();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [farmLocation, setFarmLocation] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [pushNotif, setPushNotif] = useState(true);
  const [promoNotif, setPromoNotif] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const startEditing = () => {
    setName(user?.name ?? '');
    setAddress(user?.address ?? '');
    setFarmLocation(user?.farmLocation ?? '');
    setMobile(user?.mobile ?? '');
    setEmail(user?.email ?? '');
    setProfileImage(user?.profileImage ?? null);
    setEditing(true);
  };

  const handleSave = () => {
    Alert.alert('Confirm Changes?', 'Do you want to save the changes?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          await updateUser?.({ name, address, farmLocation, mobile, email, profileImage });
          setEditing(false);
        },
      },
    ]);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setProfileImage(result.assets[0].uri);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refreshMe()} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topArc} />

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.profileSection}>
        <View style={styles.profilePicWrapper}>
          <Image
            source={
              (editing ? profileImage : user?.profileImage)
                ? { uri: (editing ? profileImage : user?.profileImage) as string }
                : require('../../../assets/images/profile-pic.png')
            }
            style={styles.profilePic}
          />
          {editing && (
            <TouchableOpacity onPress={pickImage} style={styles.editPicIcon}>
              <Ionicons name="pencil" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.name}>{editing ? name : user?.name ?? 'No Name Set'}</Text>
      </View>

      <TouchableOpacity
        style={styles.editProfileLabel}
        onPress={() => (editing ? setEditing(false) : startEditing())}
      >
        <Ionicons name="create-outline" size={18} color="#2e7d32" />
        <Text style={styles.editLabelText}>{editing ? 'Cancel Edit' : 'Edit Profile'}</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.box}>
          {editing ? (
            <>
              <EditableRow label="Full Name" value={name} onChange={setName} icon="person-outline" />
              <EditableRow label="Address" value={address} onChange={setAddress} icon="home-outline" />
              <EditableRow
                label="Farm Location"
                value={farmLocation}
                onChange={setFarmLocation}
                icon="location-outline"
              />
              <EditableRow
                label="Mobile (+63)"
                value={mobile}
                onChange={setMobile}
                icon="call-outline"
                keyboardType="numeric"
              />
              <EditableRow
                label="Email"
                value={email}
                onChange={setEmail}
                icon="mail-outline"
                keyboardType="email-address"
              />
            </>
          ) : (
            <>
              <DisplayRow label={`Name: ${user?.name ?? '-'}`} icon="person-outline" />
              <DisplayRow label={`Address: ${user?.address ?? '-'}`} icon="home-outline" />
              <DisplayRow label={`Farm: ${user?.farmLocation ?? '-'}`} icon="location-outline" />
              <DisplayRow
                label={`Mobile: ${user?.mobile ? `+63${user?.mobile}` : '-'}`}
                icon="call-outline"
              />
              {user?.email && <DisplayRow label={`Email: ${user.email}`} icon="mail-outline" />}
            </>
          )}
        </View>

        {editing && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.box}>
          <View style={styles.row}>
            <Ionicons name="notifications-outline" size={20} color="#2e7d32" />
            <Text style={styles.label}>Push Notifications</Text>
            <Switch value={pushNotif} onValueChange={setPushNotif} style={styles.switch} />
          </View>
          <View style={styles.row}>
            <Ionicons name="megaphone-outline" size={20} color="#2e7d32" />
            <Text style={styles.label}>Promotional Notifications</Text>
            <Switch value={promoNotif} onValueChange={setPromoNotif} style={styles.switch} />
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
    </ScrollView>
  );
}

function DisplayRow({ label, icon }: { label: string; icon: any }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color="#2e7d32" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function EditableRow({
  label,
  value,
  onChange,
  icon,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  icon: any;
  keyboardType?: any;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color="#2e7d32" />
      <TextInput
        style={[styles.label, { borderBottomWidth: 1, borderColor: '#ccc' }]}
        value={value}
        onChangeText={onChange}
        placeholder={label}
        keyboardType={keyboardType}
        autoCapitalize="words"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topArc: { height: 120, backgroundColor: '#2e7d32', position: 'absolute', width: '100%', zIndex: -1 },
  backButton: { position: 'absolute', top: 60, left: 20, zIndex: 10 },
  profileSection: { marginTop: 70, alignItems: 'center', marginBottom: 16 },
  profilePicWrapper: { position: 'relative' },
  profilePic: { width: 110, height: 110, borderRadius: 55, borderColor: '#fff', borderWidth: 3 },
  editPicIcon: { position: 'absolute', right: 4, bottom: 4, backgroundColor: '#2e7d32', borderRadius: 12, padding: 4 },
  name: { fontSize: 21, fontWeight: 'bold', top: 12, color: '#000' },
  editProfileLabel: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 15 },
  editLabelText: { color: '#2e7d32', fontSize: 16, fontWeight: '600' },
  content: { paddingHorizontal: 21 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2e7d32', marginBottom: 6 },
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
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  label: { marginLeft: 12, fontSize: 16, color: '#333', flex: 1 },
  switch: { transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] },
  saveButton: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: '#2e7d32',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
});
