import React, { useContext, useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  TouchableOpacity,
  ListRenderItemInfo,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { BlurView } from 'expo-blur';
import { AuthContext } from '../contexts/AuthContext';
import { apiRequest } from '../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Импорты ваших экранов
import AIAssistantScreen from './AIAssistantScreen';
import DictionaryScreen from './DictionaryScreen';
import ProfileScreen from './ProfileScreen';

const { width } = Dimensions.get('window');

// ============================================================
// ТИПЫ
// ============================================================
// Если позже пришлёшь AuthContext.tsx и ApiService.tsx — уточню
// эти типы под реальную структуру (сейчас они "лучшее предположение"
// по тому, как поля используются в этом файле).

type IoniconName = keyof typeof Ionicons.glyphMap;

interface UserProgress {
  progress_percentage?: number;
  last_read_chapter_order?: number;
  last_read_page?: number;
}

interface Book {
  id: number | string;
  title: string;
  authors?: string;
  cover_url?: string | null;
  genres?: string;
  language?: string;
  book_format?: string;
  user_progress?: UserProgress | null;
}

interface BooksResponse {
  results?: Book[];
  [key: string]: unknown;
}

interface AuthUser {
  username?: string;
  [key: string]: unknown;
}

interface AuthContextValue {
  user?: AuthUser | null;
  [key: string]: unknown;
}

// Параметры экранов, на которые LibraryScreen делает navigate().
// Они принадлежат родительскому Stack Navigator (не этому Tab Navigator),
// поэтому здесь навигация типизирована свободно (any) — если пришлёшь
// файл со Stack Navigator'ом, свяжем типы точно.
interface LibraryNavigationParams {
  bookId: Book['id'];
  initialChapterOrder?: number;
  initialLastReadPage?: number;
}

type TabParamList = {
  Library: undefined;
  AIAssistant: undefined;
  Dictionary: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const TABBAR_HEIGHT = 48;
const BUTTON_SIZE = 56;

// ============================================================
// КОМПОНЕНТЫ ДЛЯ ЭКРАНА БИБЛИОТЕКИ
// ============================================================

interface InfoTagProps {
  icon: IoniconName;
  text?: string | null;
}

const InfoTag: React.FC<InfoTagProps> = ({ icon, text }) => {
  if (!text || text.trim() === '') return null;
  return (
    <View style={styles.tag}>
      <Ionicons name={icon} size={12} color="rgba(255,255,255,0.8)" />
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
};

interface BookItemProps {
  item: Book;
  index: number;
  onPress: (item: Book) => void;
  onDelete: (id: Book['id']) => void;
}

const BookItem: React.FC<BookItemProps> = ({ item, index, onPress, onDelete }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rowRef = useRef<Swipeable>(null);

  const progressPercentage = item.user_progress?.progress_percentage || 0;
  const isCompleted = progressPercentage >= 100;
  const isNew = !item.user_progress;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 100, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const confirmDelete = () => {
    rowRef.current?.close();
    Alert.alert('Deletion confirmation', `Are you sure you want to delete the book: "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
    ]);
  };

  const handlePressIn = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }).start();

  const renderRightActions = () => (
    <TouchableOpacity onPress={confirmDelete} style={styles.deleteAction}>
      <Ionicons name="trash-outline" size={24} color="#fff" />
    </TouchableOpacity>
  );

  const firstGenre = item.genres?.split(',')[0].trim();

  return (
    <Animated.View
      style={[
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
        styles.bookItemShadow,
      ]}
    >
      <Swipeable ref={rowRef} renderRightActions={renderRightActions} overshootRight={false} rightThreshold={60}>
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={() => onPress(item)}>
          <LinearGradient colors={['rgba(255, 255, 255, 0.3)', 'rgba(67, 97, 158, 0.3)']} style={styles.bookItemBorder}>
            <LinearGradient colors={['#2A2D4A', '#1C2533']} style={styles.bookItem}>
              <View style={styles.bookCover}>
                {isNew && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                )}
                {item.cover_url ? (
                  <Image source={{ uri: item.cover_url }} style={styles.bookCoverImage} />
                ) : (
                  <View style={styles.bookCoverPlaceholder}>
                    <Ionicons name="book" size={30} color="rgba(255,255,255,0.7)" />
                  </View>
                )}
              </View>
              <View style={styles.bookInfo}>
                <Text style={styles.bookTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.bookAuthor} numberOfLines={1}>
                  {item.authors || 'Unknown author'}
                </Text>
                <View style={styles.tagsContainer}>
                  <InfoTag icon="cube-outline" text={item.book_format} />
                  <InfoTag icon="globe-outline" text={item.language?.toUpperCase()} />
                  <InfoTag icon="pricetag-outline" text={firstGenre} />
                </View>
                {item.user_progress && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          isCompleted && styles.progressFillCompleted,
                          { width: `${progressPercentage}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{`${Math.round(progressPercentage)}%`}</Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          </LinearGradient>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
};

// ============================================================
// LibraryScreen (бывший HomeContent)
// ============================================================

interface LibraryScreenProps {
  // navigation типизирован свободно, т.к. 'BookReader'/'BookDetail'
  // принадлежат родительскому Stack Navigator, которого нет в этом файле.
  navigation: {
    navigate: (screen: 'BookReader' | 'BookDetail', params: LibraryNavigationParams) => void;
  };
}

function LibraryScreen({ navigation }: LibraryScreenProps) {
  const { user } = useContext(AuthContext) as AuthContextValue;
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const insets = useSafeAreaInsets();

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/books/', 'GET') as BooksResponse;
      setBooks(data.results && Array.isArray(data.results) ? data.results : []);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load book list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleBookPress = (book: Book) => {
    navigation.navigate(book.user_progress ? 'BookReader' : 'BookDetail', {
      bookId: book.id,
      initialChapterOrder: book.user_progress?.last_read_chapter_order,
      initialLastReadPage: book.user_progress?.last_read_page,
    });
  };

  const handleUploadBook = async () => {
    setShowUploadModal(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/epub+zip', 'application/x-fictionbook+xml', 'application/zip'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets) return;
      const file = result.assets[0];
      setUploading(true);
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);
      const response = (await apiRequest('/books/upload/', 'POST', formData)) as { message?: string };
      Alert.alert('Success!', response.message || 'Book uploaded successfully');
      await fetchBooks();
    } catch (error: any) {
      Alert.alert('Loading error', error?.message || 'An error occurred.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteBook = async (bookId: Book['id']) => {
    try {
      await apiRequest(`/books/${bookId}/`, 'DELETE');
      setBooks((prevBooks) => prevBooks.filter((book) => book.id !== bookId));
    } catch (error: any) {
      Alert.alert('Deletion error', error?.message || 'Failed to delete book.');
    }
  };

  const renderListContent = () => {
    if (loading && books.length === 0) {
      return (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.centeredText}>Loading library...</Text>
        </View>
      );
    }
    if (!loading && books.length === 0) {
      return (
        <View style={styles.centeredContainer}>
          <Ionicons name="library-outline" size={60} color="rgba(255,255,255,0.5)" />
          <Text style={styles.emptyTitle}>Your library is empty</Text>
          <Text style={styles.emptySubtitle}>Upload the book to start reading</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={() => setShowUploadModal(true)}>
            <Ionicons name="add" size={24} color="#2a5298" />
            <Text style={styles.uploadButtonText}>Upload a book</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <FlatList<Book>
        data={books}
        renderItem={({ item, index }: ListRenderItemInfo<Book>) => (
          <BookItem item={item} index={index} onPress={handleBookPress} onDelete={handleDeleteBook} />
        )}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: TABBAR_HEIGHT + insets.bottom + 20, paddingTop: 10 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchBooks} tintColor="#fff" />}
      />
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.container}>
        <View style={styles.header}>
          <LinearGradient colors={['#4e7ac7', '#385a94']} style={styles.logoCircle}>
            <Text style={styles.logoIcon}>📖</Text>
          </LinearGradient>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>Booklingo</Text>
          </View>
          <Text style={styles.subtitle}>Hello, {user?.username || 'reader'}!</Text>
          <LinearGradient
            colors={['#fff', 'rgba(255,255,255,0)']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 0 }}
            style={styles.subtitleUnderline}
          />
        </View>
        <View style={styles.listContainer}>
          <View style={styles.booksHeader}>
            <Text style={styles.booksTitle}>My Library</Text>
            <TouchableOpacity style={styles.addButtonShadow} onPress={() => setShowUploadModal(true)}>
              <LinearGradient colors={['#8E9EAB', '#DAD4E4']} style={styles.addButton}>
                <Ionicons name="add" size={28} color="#1e3c72" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
          {renderListContent()}
        </View>
        <Modal
          visible={showUploadModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowUploadModal(false)}
        >
          <BlurView intensity={50} tint="dark" style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Download the book</Text>
              <Text style={styles.modalSubtitle}>Supported formats: FB2, EPUB, ZIP.</Text>
              <TouchableOpacity style={styles.modalButton} onPress={handleUploadBook}>
                <Ionicons name="document-attach-outline" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>Select file</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowUploadModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Modal>
        {uploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.uploadingText}>Loading book...</Text>
          </View>
        )}
      </LinearGradient>
    </GestureHandlerRootView>
  );
}

// ============================================================
// ОСНОВНОЙ ЭКСПОРТИРУЕМЫЙ КОМПОНЕНТ: НАВИГАТОР С ВКЛАДКАМИ
// ============================================================

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }: { route: RouteProp<TabParamList, keyof TabParamList> }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: TABBAR_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          },
        ],
        tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => {
          const icons: Record<keyof TabParamList, IoniconName> = {
            Library: 'home',
            AIAssistant: 'sparkles',
            Dictionary: 'book',
            Profile: 'person-circle',
          };
          const outlineIcons: Record<keyof TabParamList, IoniconName> = {
            Library: 'home-outline',
            AIAssistant: 'sparkles-outline',
            Dictionary: 'book-outline',
            Profile: 'person-circle-outline',
          };
          const routeName = route.name as keyof TabParamList;
          const iconName = focused ? icons[routeName] : outlineIcons[routeName];
          return (
            <View
              style={[
                styles.tabIconContainer,
                focused && styles.tabIconContainerActive,
                { marginTop: -((BUTTON_SIZE - TABBAR_HEIGHT) / 2) },
              ]}
            >
              <Ionicons name={iconName} size={focused ? 28 : 26} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.7)',
      })}
    >
      {/* Здесь мы определяем все наши экраны, которые будут иметь нижний таб-бар. */}
      {/* Имена теперь чистые и уникальные в рамках этого навигатора. */}
      <Tab.Screen name="Library" component={LibraryScreen as unknown as React.ComponentType} />
      <Tab.Screen name="AIAssistant" component={AIAssistantScreen} />
      <Tab.Screen name="Dictionary" component={DictionaryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default MainTabs;

// --- Стили (без изменений) ---
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 25, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
  logoCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 5 },
  logoIcon: { fontSize: 40 },
  headerTextBlock: { backgroundColor: 'rgba(0, 0, 0, 0.15)', paddingHorizontal: 25, paddingVertical: 5, borderRadius: 12, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  subtitle: { fontSize: 18, color: 'rgba(255,255,255,0.85)' },
  subtitleUnderline: { height: 2, width: 60, marginTop: 6, borderRadius: 1, opacity: 0.7 },
  listContainer: { flex: 1, paddingHorizontal: 20 },
  booksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20 },
  booksTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  addButtonShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 8, borderRadius: 25 },
  addButton: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  bookItemShadow: { marginBottom: 15, shadowColor: '#9c1b1bff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
  bookItemBorder: { borderRadius: 14, padding: 1.5 },
  bookItem: { flexDirection: 'row', borderRadius: 12, padding: 15, alignItems: 'center' },
  bookCover: { width: 60, height: 90, borderRadius: 8, marginRight: 15, overflow: 'visible', backgroundColor: 'rgba(0, 0, 0, 0.2)' },
  bookCoverImage: { width: '100%', height: '100%', borderRadius: 8 },
  bookCoverPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  bookInfo: { flex: 1, alignSelf: 'stretch' },
  bookTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
  bookAuthor: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 8 },
  tagText: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 11, fontWeight: '600', marginLeft: 4, textTransform: 'capitalize' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto' },
  progressBar: { flex: 1, height: 6, backgroundColor: 'rgba(165, 144, 144, 0.4)', borderRadius: 3, borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.5)' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  progressFillCompleted: { backgroundColor: '#2ecc71' },
  progressText: { color: '#fff', fontSize: 11, fontWeight: '600', minWidth: 30, textAlign: 'right' },
  newBadge: { position: 'absolute', top: -6, right: -8, backgroundColor: '#e74c3c', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, zIndex: 1, transform: [{ rotate: '10deg' }], elevation: 5, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 1, height: 2 } },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  deleteAction: { backgroundColor: '#e74c3c', justifyContent: 'center', alignItems: 'center', flex: 1, borderRadius: 14 },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  centeredText: { color: '#fff', fontSize: 16, marginTop: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#fff', marginTop: 20, marginBottom: 10, textAlign: 'center' },
  emptySubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 30 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  uploadButtonText: { color: '#2a5298', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: 30, width: width * 0.85, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#2a5298', marginBottom: 10 },
  modalSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 30, lineHeight: 20 },
  modalButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a5298', paddingVertical: 15, borderRadius: 12, justifyContent: 'center', width: '100%' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 10 },
  modalCancelButton: { paddingVertical: 15 },
  modalCancelButtonText: { color: '#666', fontSize: 16 },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  uploadingText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 15 },
  tabBar: { position: 'absolute', bottom: 12, left: 12, right: 12, backgroundColor: 'rgba(30, 60, 114, 0.95)', borderTopWidth: 0, elevation: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  tabIconContainer: { width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_SIZE / 2, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent', alignSelf: 'center' },
  tabIconContainerActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
});