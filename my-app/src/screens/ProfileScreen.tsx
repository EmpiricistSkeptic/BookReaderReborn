import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { AuthContext } from '../contexts/AuthContext';
import { apiRequest } from '../services/apiService';

const { width } = Dimensions.get('window');

// --- ТИПЫ И ИНТЕРФЕЙСЫ ---
export interface SelectOption {
  value: string;
  label: string;
}

export interface UserProfile {
  id?: number | string;
  native_language?: string;
  language_to_learn?: string;
  current_level?: string;
  avatar_url?: string;
  created_at?: string;
  is_google_user?: boolean;
  [key: string]: any;
}

export interface ProfileUpdates {
  native_language?: string;
  language_to_learn?: string;
  current_level?: string;
  avatar?: ImagePicker.ImagePickerAsset;
}

export type ModalType = 'native' | 'learn' | '';

interface AuthUser {
  id: number | string;
  first_name?: string;
  username?: string;
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  signOut: () => void;
}

// --- КОНСТАНТЫ ---
const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'ru', label: 'Russian' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'id', label: 'Indonesian' },
];

const LEVEL_OPTIONS: SelectOption[] = [
  { value: 'A1', label: 'A1 - Beginner' },
  { value: 'A2', label: 'A2 - Elementary' },
  { value: 'B1', label: 'B1 - Intermediate' },
  { value: 'B2', label: 'B2 - Upper Intermediate' },
  { value: 'C1', label: 'C1 - Advanced' },
  { value: 'C2', label: 'C2 - Proficient' },
];

export default function ProfileScreen() {
  const { user, signOut } = useContext(AuthContext) as AuthContextType;

  // Динамический URL для профиля пользователя
  const profileUrl = user?.id ? `/profile/${user.id}/` : '';

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);
  const [showLevelModal, setShowLevelModal] = useState<boolean>(false);
  const [modalType, setModalType] = useState<ModalType>('');

  useEffect(() => {
    if (profileUrl) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [profileUrl]);

  const loadProfile = async () => {
    if (!profileUrl) return;
    try {
      const profileData: UserProfile = await apiRequest(profileUrl, 'GET');
      console.log(profileData);
      setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: ProfileUpdates) => {
    if (!profileUrl) return;
    setUpdating(true);
    try {
      const formData = new FormData();

      if (updates.native_language) {
        formData.append('native_language', updates.native_language);
      }
      if (updates.language_to_learn) {
        formData.append('language_to_learn', updates.language_to_learn);
      }
      if (updates.current_level) {
        formData.append('current_level', updates.current_level);
      }
      if (updates.avatar) {
        formData.append('avatar', {
          uri: updates.avatar.uri,
          type: updates.avatar.mimeType || updates.avatar.type || 'image/jpeg',
          name: updates.avatar.fileName || 'avatar.jpg',
        } as any);
      }

      const updatedProfile: UserProfile = await apiRequest(profileUrl, 'PATCH', formData);
      console.log(updatedProfile);  
      setProfile(updatedProfile);
      Alert.alert('Success', 'Profile updated');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Error', 'Permission is required to access the gallery');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await updateProfile({ avatar: result.assets[0] });
    }
  };

  const handleLanguageSelect = (language: string) => {
    const updates: ProfileUpdates = {};
    if (modalType === 'native') {
      updates.native_language = language;
    } else if (modalType === 'learn') {
      updates.language_to_learn = language;
    }
    updateProfile(updates);
    setShowLanguageModal(false);
  };

  const handleLevelSelect = (level: string) => {
    updateProfile({ current_level: level });
    setShowLevelModal(false);
  };

  const getLabelForValue = (options: SelectOption[], value: string): string => {
    const option = options.find((opt) => opt.value === value);
    return option ? option.label : value;
  };

  const handleSignOut = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: signOut, style: 'destructive' },
    ]);
  };

  if (loading) {
    return (
      <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#fff" />
              </View>
            )}
            <View style={styles.avatarEditIcon}>
              <Ionicons name="camera" size={16} color="#2a5298" />
            </View>
          </TouchableOpacity>

          <Text style={styles.userName}>
            {user?.first_name || user?.username || 'User'}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Profile Settings */}
        <View style={styles.settingsContainer}>
          <Text style={styles.sectionTitle}>Study Settings</Text>

          {/* Native Language */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              setModalType('native');
              setShowLanguageModal(true);
            }}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="globe-outline" size={24} color="#2a5298" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Native language</Text>
              <Text style={styles.settingValue}>
                {profile?.native_language
                  ? getLabelForValue(LANGUAGE_OPTIONS, profile.native_language)
                  : 'Not selected'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          {/* Language to Learn */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              setModalType('learn');
              setShowLanguageModal(true);
            }}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="book-outline" size={24} color="#2a5298" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Language being studied</Text>
              <Text style={styles.settingValue}>
                {profile?.language_to_learn
                  ? getLabelForValue(LANGUAGE_OPTIONS, profile.language_to_learn)
                  : 'Not selected'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          {/* Current Level */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowLevelModal(true)}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="bar-chart-outline" size={24} color="#2a5298" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Current level</Text>
              <Text style={styles.settingValue}>
                {profile?.current_level
                  ? getLabelForValue(LEVEL_OPTIONS, profile.current_level)
                  : 'Not selected'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>

        {/* Account Info */}
        <View style={styles.settingsContainer}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Ionicons name="calendar-outline" size={24} color="#2a5298" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Registration date</Text>
              <Text style={styles.settingValue}>
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('ru-RU')
                  : 'Unknown'}
              </Text>
            </View>
          </View>

          {profile?.is_google_user && (
            <View style={styles.settingItem}>
              <View style={styles.settingIcon}>
                <Ionicons name="logo-google" size={24} color="#2a5298" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Google account</Text>
                <Text style={styles.settingValue}>Connected</Text>
              </View>
            </View>
          )}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={24} color="#ff4444" />
          <Text style={styles.signOutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modalType === 'native' ? 'Native language' : 'Language being studied'}
            </Text>
            <ScrollView style={styles.modalList}>
              {LANGUAGE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.modalItem}
                  onPress={() => handleLanguageSelect(option.value)}
                >
                  <Text style={styles.modalItemText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowLanguageModal(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Level Selection Modal */}
      <Modal
        visible={showLevelModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLevelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Current level</Text>
            <ScrollView style={styles.modalList}>
              {LEVEL_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.modalItem}
                  onPress={() => handleLevelSelect(option.value)}
                >
                  <Text style={styles.modalItemText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowLevelModal(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {updating && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="large" color="#2a5298" />
            <Text style={styles.uploadingText}>Updating...</Text>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: width * 0.25,
    height: width * 0.25,
    borderRadius: (width * 0.25) / 2,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarPlaceholder: {
    width: width * 0.25,
    height: width * 0.25,
    borderRadius: (width * 0.25) / 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarEditIcon: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  settingsContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  settingValue: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,68,68,0.2)',
    borderRadius: 12,
    paddingVertical: 15,
    marginHorizontal: 20,
    marginBottom: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
  },
  signOutText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2a5298',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalCancelButton: {
    paddingVertical: 15,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalCancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 30,
    alignItems: 'center',
  },
  uploadingText: {
    color: '#2a5298',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
  },
});