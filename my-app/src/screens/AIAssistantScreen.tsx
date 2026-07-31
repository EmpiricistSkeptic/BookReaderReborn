import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
  Modal,
  ScrollView,
  ListRenderItemInfo,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getConversations,
  createConversation,
  deleteConversation,
} from '../services/conversationService';

// --- ЭТАП 1. ТИПЫ И ENUM ---
export enum ConversationMode {
  DEFAULT = 'default',
  GRAMMAR = 'grammar',
  VOCABULARY = 'vocabulary',
  ROLEPLAY = 'roleplay',
  CONVERSATION = 'conversation',
  WRITING = 'writing',
}

export interface Conversation {
  id: number | string;
  title?: string;
  mode: ConversationMode;
  last_message?: LastMessage | null;
  messages_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PaginatedConversationsResponse {
  results: Conversation[];
  next: string | null;
  previous: string | null;
  count?: number;
}

// --- ЭТАП 2. МЕТАДАННЫЕ РЕЖИМОВ (MODE_INFO) ---
export interface ModeConfig {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
  description: string;
}

export const MODE_INFO: Record<ConversationMode, ModeConfig> = {
  [ConversationMode.DEFAULT]: {
    title: 'General Tutor',
    icon: 'school-outline',
    colors: ['#4a72d8', '#2a5298'],
    description: 'Ask anything about languages and get instant explanations.',
  },
  [ConversationMode.GRAMMAR]: {
    title: 'Grammar Lab',
    icon: 'library-outline',
    colors: ['#5C6BC0', '#3949AB'],
    description: 'Master grammar step by step with clear explanations.',
  },
  [ConversationMode.VOCABULARY]: {
    title: 'Vocabulary Builder',
    icon: 'book-outline',
    colors: ['#43A047', '#2E7D32'],
    description: 'Expand your word stock and learn phrases naturally.',
  },
  [ConversationMode.ROLEPLAY]: {
    title: 'Role Play',
    icon: 'people-outline',
    colors: ['#FF7043', '#E64A19'],
    description: 'Practice real-life situations and spoken confidence.',
  },
  [ConversationMode.CONVERSATION]: {
    title: 'Conversation Club',
    icon: 'chatbubbles-outline',
    colors: ['#26A69A', '#00695C'],
    description: 'Improve fluency through natural dialogue practice.',
  },
  [ConversationMode.WRITING]: {
    title: 'Writing Coach',
    icon: 'create-outline',
    colors: ['#AB47BC', '#7B1FA2'],
    description: 'Receive detailed feedback on texts, essays, and emails.',
  },
};

interface ConversationItemProps {
  item: Conversation;
  onPress: (id: number | string) => void;
  onDelete: () => void;
}

interface AIAssistantScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, any>) => void;
    [key: string]: any;
  };
}

// --- ЭТАП 3, 4 & 10. КАРТОЧКА ДИАЛОГА ---
const ConversationItem: React.FC<ConversationItemProps> = memo(({ item, onPress, onDelete }) => {
  const modeInfo = MODE_INFO[item.mode] || MODE_INFO[ConversationMode.DEFAULT];

  // Вспомогательная функция для получения текста сообщения
  const getLastMessageText = () => {
    if (item.last_message && item.last_message.text) {
      return item.last_message.text;
    }
    return item.messages_count ? `${item.messages_count} messages` : 'No messages yet';
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity onPress={onDelete} style={styles.deleteButton} activeOpacity={0.8}>
        <Animated.View style={{ transform: [{ translateX: trans }] }}>
          <Ionicons name="trash-outline" size={24} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.itemOuterContainer}>
      <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
        <TouchableOpacity
          style={styles.itemContainer}
          onPress={() => onPress(item.id)}
          activeOpacity={0.7}
        >
          {/* Иконка и градиент в зависимости от режима */}
          <LinearGradient colors={modeInfo.colors} style={styles.itemIcon}>
            <Ionicons name={modeInfo.icon} size={22} color="#fff" />
          </LinearGradient>

          <View style={styles.itemContent}>
            {/* Тег с названием режима */}
            <Text style={[styles.itemModeTag, { color: modeInfo.colors[0] }]}>
              {modeInfo.title}
            </Text>

            {/* Название диалога */}
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title || `Dialogue #${item.id}`}
            </Text>

            {/* Подзаголовок: Последнее сообщение или количество */}
            <Text style={styles.itemSubtitle} numberOfLines={1}>
              {getLastMessageText()}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </Swipeable>
    </View>
  );
});

// --- ГЛАВНЫЙ ЭКРАН AIAssistantScreen ---
export default function AIAssistantScreen({ navigation }: AIAssistantScreenProps) {
  const insets = useSafeAreaInsets();

  // Состояния
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [isMoreLoading, setIsMoreLoading] = useState<boolean>(false);

  // Модальное окно выбора режима
  const [isModeModalVisible, setIsModeModalVisible] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Функция загрузки
  const loadConversations = async (page = 1) => {
    if (page > 1 && isMoreLoading) return;
    if (page === 1) setLoading(true);
    else setIsMoreLoading(true);

    try {
      const data: PaginatedConversationsResponse = await getConversations(page);

      if (data && Array.isArray(data.results)) {
        setConversations((prev) => {
          if (page === 1) return data.results;
          const existingIds = new Set(prev.map((item) => item.id));
          const newItems = data.results.filter((item) => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });

        setHasNextPage(data.next !== null);
        setCurrentPage(page);
      } else {
        if (page === 1) setConversations([]);
        setHasNextPage(false);
      }
    } catch (error) {
      console.error('Error loading dialogs:', error);
      Alert.alert('Error', 'Failed to load dialogues.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsMoreLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadConversations(1);
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadConversations(1);
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isMoreLoading && !loading) {
      loadConversations(currentPage + 1);
    }
  };

  // ЭТАП 5 & 6. СОЗДАНИЕ ДИАЛОГА С ВЫБРАННЫМ РЕЖИМОМ
  const handleSelectModeAndCreate = async (mode: ConversationMode) => {
    setIsCreating(true);
    try {
      // Отправляем выбранный режим в функцию сервиса
      const newConversation: Conversation = await createConversation(mode);
      setIsModeModalVisible(false);
      navigation.navigate('Conversation', { conversationId: newConversation.id });
    } catch (error) {
      console.error('Error creating dialog:', error);
      Alert.alert('Error', 'Failed to create conversation in this mode.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (conversationId: number | string) => {
    Alert.alert('Delete dialogue?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteConversation(conversationId);
            setConversations((prev) => prev.filter((c) => c.id !== conversationId));
          } catch (error) {
            console.error('Error deleting dialog:', error);
            Alert.alert('Error', 'Failed to delete dialog. Try again.');
          }
        },
      },
    ]);
  };

  if (loading && conversations.length === 0) {
    return (
      <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
      </LinearGradient>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.container}>
        {/* ЭТАП 9. ХЕДЕР (AI Teacher) */}
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.headerTitle}>AI Teacher</Text>
          <Text style={styles.headerSubtitle}>Choose a learning mode or continue practicing</Text>
          <View style={styles.headerDecorator} />
        </View>

        {/* СПИСОК РАЗГОВОРОВ */}
        <FlatList<Conversation>
          data={conversations}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }: ListRenderItemInfo<Conversation>) => (
            <ConversationItem
              item={item}
              onPress={(conversationId) => navigation.navigate('Conversation', { conversationId })}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          /* ЭТАП 8. EMPTY STATE */
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="sparkles-outline" size={80} color="rgba(255,255,255,0.4)" />
              <Text style={styles.emptyText}>Start Your Journey</Text>
              <Text style={styles.emptySubText}>
                Choose an AI learning mode and start your first lesson!
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: insets.bottom + 110 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={() =>
            isMoreLoading ? <ActivityIndicator style={{ marginVertical: 20 }} color="#fff" /> : null
          }
        />

        {/* FAB КНОПКА ОТКРЫТИЯ ВЫБОРА РЕЖИМА */}
        <TouchableOpacity
          onPress={() => setIsModeModalVisible(true)}
          style={[styles.fabContainer, { bottom: insets.bottom + 60 }]}
          activeOpacity={0.8}
        >
          <LinearGradient colors={['#4a72d8', '#2a5298']} style={styles.fab}>
            <Ionicons name="add" size={36} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* ЭТАП 5 & 7. МОДАЛЬНОЕ ОКНО ВЫБОРА РЕЖИМА (BOTTOM SHEET MODAL) */}
        <Modal
          visible={isModeModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsModeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setIsModeModalVisible(false)}
            />

            <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>Choose AI Mode</Text>
                <Text style={styles.modalSubtitle}>Select how you want to learn today</Text>
              </View>

              {isCreating ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color="#4a72d8" />
                  <Text style={styles.modalLoadingText}>Preparing your lesson...</Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.modalScrollView}
                  showsVerticalScrollIndicator={false}
                >
                  {(Object.keys(MODE_INFO) as ConversationMode[]).map((modeKey) => {
                    const info = MODE_INFO[modeKey];
                    return (
                      <TouchableOpacity
                        key={modeKey}
                        style={styles.modeCard}
                        onPress={() => handleSelectModeAndCreate(modeKey)}
                        activeOpacity={0.7}
                      >
                        <LinearGradient colors={info.colors} style={styles.modeIconContainer}>
                          <Ionicons name={info.icon} size={24} color="#fff" />
                        </LinearGradient>
                        <View style={styles.modeTextContainer}>
                          <Text style={styles.modeCardTitle}>{info.title}</Text>
                          <Text style={styles.modeCardDescription}>{info.description}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#aaa" />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </GestureHandlerRootView>
  );
}

// --- СТИЛИ ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingBottom: 20,
    paddingHorizontal: 25,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'left',
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'left',
    marginTop: 6,
  },
  headerDecorator: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1,
    marginTop: 20,
    width: '35%',
  },
  itemOuterContainer: {
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    padding: 14,
    overflow: 'hidden',
  },
  itemIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemContent: {
    flex: 1,
    paddingRight: 8,
  },
  itemModeTag: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  itemSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 3,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: '30%',
    opacity: 0.85,
  },
  emptyText: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 20,
  },
  emptySubText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 75,
    borderRadius: 16,
    marginLeft: 10,
  },
  /* СТИЛИ МОДАЛЬНОГО ОКНА (BOTTOM SHEET) */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '80%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  modalScrollView: {
    marginBottom: 10,
  },
  modalLoadingContainer: {
    paddingVertical: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 15,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  modeTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  modeCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modeCardDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 3,
    lineHeight: 16,
  },
});