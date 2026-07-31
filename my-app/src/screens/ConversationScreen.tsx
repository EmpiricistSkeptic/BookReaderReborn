import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
  Animated,
  Alert,
  ListRenderItemInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getConversationDetails, sendMessage } from '../services/conversationService';

// Включение анимаций на Android при старте
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- ТИПЫ И ИНТЕРФЕЙСЫ ---
export interface Message {
  id: number | string;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  created_at?: string;
  [key: string]: any;
}

export interface ConversationDetails {
  id: number | string;
  title?: string;
  messages: Message[];
  [key: string]: any;
}

export interface SendMessageResponse {
  user_message: Message;
  bot_message?: Message;
  [key: string]: any;
}

export interface ConversationRouteParams {
  conversationId: number | string;
}

interface ConversationScreenProps {
  route: { params: ConversationRouteParams };
  navigation: {
    goBack: () => void;
    setOptions: (options: { title?: string; [key: string]: any }) => void;
    [key: string]: any;
  };
}

interface PromptItem {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}

interface ChatEmptyStateProps {
  onPromptPress: (promptText: string) => void;
}

interface ChatHeaderBannerProps {
  onBackPress?: () => void;
}

interface MessageBubbleProps {
  message: Message;
}

// --- КОМПОНЕНТЫ АВАТАРОВ ---
const AiAvatar: React.FC = memo(() => (
  <View style={styles.avatarWrapper}>
    <LinearGradient
      colors={['#6366f1', '#3b82f6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.aiAvatarGradient}
    >
      <Ionicons name="sparkles" size={13} color="#ffffff" style={styles.iconCentered} />
    </LinearGradient>
  </View>
));

const UserAvatar: React.FC = memo(() => (
  <View style={styles.avatarWrapper}>
    <LinearGradient
      colors={['#3b82f6', '#1d4ed8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.userAvatarGradient}
    >
      <Ionicons name="person" size={13} color="#ffffff" style={styles.iconCentered} />
    </LinearGradient>
  </View>
));

// --- КОМПОНЕНТ: Верхний фиксированный баннер ---
const ChatHeaderBanner: React.FC<ChatHeaderBannerProps> = memo(({ onBackPress }) => (
  <View style={styles.headerBannerContainer}>
    <LinearGradient
      colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']}
      style={styles.headerBannerGradient}
    >
      <View style={styles.headerBannerContent}>
        {onBackPress && (
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.headerBackButton}
            onPress={onBackPress}
          >
            <Ionicons name="chevron-back" size={20} color="#ffffff" style={{ paddingRight: 2 }} />
          </TouchableOpacity>
        )}

        <View style={styles.headerBannerAvatarWrapper}>
          <LinearGradient
            colors={['#6366f1', '#3b82f6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerBannerAvatar}
          >
            <Ionicons name="sparkles" size={18} color="#fff" style={styles.iconCentered} />
          </LinearGradient>
          <View style={styles.onlineStatusDot} />
        </View>

        <View style={styles.headerBannerTextGroup}>
          <View style={styles.headerBannerTitleRow}>
            <Text style={styles.headerBannerTitle}>AI Language Tutor</Text>
            <View style={styles.aiBadgeTag}>
              <Text style={styles.aiBadgeTagText}>PRO AI</Text>
            </View>
          </View>
          <Text style={styles.headerBannerSubtitle}>Online • Always ready to help you practice</Text>
        </View>
      </View>
    </LinearGradient>
  </View>
));

// --- КОМПОНЕНТ: Приветственный экран ---
const ChatEmptyState: React.FC<ChatEmptyStateProps> = memo(({ onPromptPress }) => {
  const prompts: PromptItem[] = [
    { icon: 'checkmark-done-circle-outline', text: 'Correct my sentence: "I goed to the cinema yesterday."' },
    { icon: 'help-circle-outline', text: 'What is the difference between "affect" and "effect"?' },
    { icon: 'book-outline', text: 'Give me an example of the Past Perfect tense.' },
  ];

  return (
    <View style={styles.emptyStateContainer}>
      <View style={styles.emptyStateContent}>
        <View style={styles.aiBadgeWrapper}>
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.35)', 'rgba(59, 130, 246, 0.05)']}
            style={styles.aiBadgeGlow}
          />
          <LinearGradient
            colors={['#6366f1', '#3b82f6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyStateAvatar}
          >
            <Ionicons name="sparkles" size={36} color="#fff" style={styles.iconCentered} />
          </LinearGradient>
        </View>

        <Text style={styles.emptyStateTitle}>AI Language Tutor</Text>
        <Text style={styles.emptyStateSubtitle}>
          Ask questions, correct grammar, or practice real-world language skills together.
        </Text>

        <View style={styles.promptsContainer}>
          <Text style={styles.promptsTitle}>SUGGESTED PROMPTS</Text>
          {prompts.map((prompt, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.75}
              style={styles.promptButton}
              onPress={() => onPromptPress(prompt.text)}
            >
              <View style={styles.promptIconBadge}>
                <Ionicons name={prompt.icon} size={18} color="#60a5fa" style={styles.iconCentered} />
              </View>
              <Text style={styles.promptText}>{prompt.text}</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255, 255, 255, 0.3)" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
});

// --- КОМПОНЕНТ: Индикатор набора текста ---
const TypingIndicator: React.FC = memo(() => {
  const animations = useRef<Animated.Value[]>([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const createAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 380, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 380, useNativeDriver: true }),
          ])
        ),
      ]);
    };

    const animGroup = Animated.parallel([
      createAnimation(animations[0], 0),
      createAnimation(animations[1], 150),
      createAnimation(animations[2], 300),
    ]);

    animGroup.start();
    return () => animGroup.stop();
  }, [animations]);

  return (
    <View style={[styles.aiMessageRow, { marginVertical: 6 }]}>
      <AiAvatar />
      <View style={[styles.messageBubble, styles.aiMessageBubble, styles.typingBubbleContainer]}>
        {animations.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.typingDot,
              {
                opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                transform: [
                  { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
                  { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] }) },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
});

// --- КОМПОНЕНТ: Пузырь сообщения ---
const MessageBubble: React.FC<MessageBubbleProps> = memo(({ message }) => {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageRow, isUser ? styles.userMessageRow : styles.aiMessageRow]}>
      {!isUser && <AiAvatar />}

      {isUser ? (
        <LinearGradient
          colors={['#3b82f6', '#1d4ed8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.messageBubble, styles.userMessageBubble]}
        >
          <Text style={styles.userMessageText}>{message.content}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.messageBubble, styles.aiMessageBubble]}>
          <Text style={styles.aiMessageText}>{message.content}</Text>
        </View>
      )}

      {isUser && <UserAvatar />}
    </View>
  );
});

// --- ГЛАВНЫЙ ЭКРАН ConversationScreen ---
export default function ConversationScreen({ route, navigation }: ConversationScreenProps) {
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');

  const flatListRef = useRef<FlatList<Message>>(null);

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const loadConversation = useCallback(async () => {
    try {
      const data: ConversationDetails = await getConversationDetails(conversationId);
      if (data && Array.isArray(data.messages)) {
        setMessages(data.messages);
      }
      if (data.title) {
        navigation.setOptions({ title: data.title });
      }
    } catch (error) {
      console.error('Error loading dialog:', error);
      Alert.alert('Error', 'Failed to load conversation.');
    } finally {
      setLoading(false);
    }
  }, [conversationId, navigation]);

  useEffect(() => {
    setLoading(true);
    loadConversation();
  }, [loadConversation]);

  // Инвертированный массив (новые сообщения в начале)
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = async () => {
    if (input.trim().length === 0 || sending) return;
    const userMessageContent = input.trim();
    setInput('');

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSending(true);

    const isFirstMessage = messages.length === 0;
    const tempId = `optimistic-${Date.now()}`;
    const optimisticUserMessage: Message = {
      id: tempId,
      role: 'user',
      content: userMessageContent,
    };

    setMessages((prev) => [...prev, optimisticUserMessage]);

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });

    try {
      const response: SendMessageResponse = await sendMessage(conversationId, userMessageContent);
      await loadConversation();

      if (isFirstMessage && response?.user_message?.content) {
        const newTitle = response.user_message.content.substring(0, 20) + '...';
        navigation.setOptions({ title: newTitle });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message.');
      setInput(userMessageContent);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handlePromptPress = useCallback((promptText: string) => {
    setInput(promptText);
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Message>) => <MessageBubble message={item} />,
    []
  );

  if (loading) {
    return (
      <LinearGradient colors={['#121d33', '#1e3c72']} style={styles.centered}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </LinearGradient>
    );
  }

  const topSafeArea = insets.top > 0 ? insets.top : Platform.OS === 'ios' ? 12 : 8;
  
  // Рассчитываем точное смещение для iOS и Android
  const keyboardOffset = Platform.OS === 'ios' ? (headerHeight > 0 ? headerHeight : topSafeArea) : 0;

  return (
    <LinearGradient
      colors={['#101b2e', '#1a335d', '#1e3c72']}
      style={[styles.container, { paddingTop: topSafeArea }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardOffset}
      >
        {/* Хедер висит фиксированно вверху */}
        <ChatHeaderBanner onBackPress={handleBackPress} />

        {messages.length === 0 && !sending ? (
          <ChatEmptyState onPromptPress={handlePromptPress} />
        ) : (
          <FlatList<Message>
            ref={flatListRef}
            data={invertedMessages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            inverted={true}
            ListHeaderComponent={sending ? <TypingIndicator /> : null}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 20,
              paddingTop: 4,
            }}
          />
        )}

        {/* Панель ввода сообщений */}
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask your AI teacher..."
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              multiline
            />
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.sendButton,
                input.trim().length === 0 && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={input.trim().length === 0 || sending}
            >
              <LinearGradient
                colors={
                  input.trim().length > 0
                    ? ['#3b82f6', '#2563eb']
                    : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                }
                style={styles.sendButtonGradient}
              >
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={input.trim().length > 0 ? '#ffffff' : 'rgba(255,255,255,0.3)'}
                  style={styles.iconCentered}
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
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
  iconCentered: {
    textAlign: 'center',
  },

  // --- HEADER BANNER ---
  headerBannerContainer: {
    marginBottom: 8,
    marginTop: 4,
    marginHorizontal: 16,
  },
  headerBannerGradient: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  headerBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerBannerAvatarWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  headerBannerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#22c55e',
    borderWidth: 1.5,
    borderColor: '#101b2e',
  },
  headerBannerTextGroup: {
    flex: 1,
  },
  headerBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  aiBadgeTag: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.3)',
  },
  aiBadgeTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#a5b4fc',
    letterSpacing: 0.5,
  },
  headerBannerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 1,
  },

  // --- EMPTY STATE STYLES ---
  emptyStateContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyStateContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  aiBadgeWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  aiBadgeGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  emptyStateAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: '90%',
  },
  promptsContainer: {
    marginTop: 28,
    width: '100%',
  },
  promptsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.45)',
    marginBottom: 10,
    letterSpacing: 1.2,
    textAlign: 'left',
    paddingLeft: 4,
  },
  promptButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  promptIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  promptText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },

  // --- MESSAGES & AVATARS ---
  messageRow: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-end',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  aiMessageRow: {
    justifyContent: 'flex-start',
  },
  avatarWrapper: {
    marginBottom: 2,
  },
  aiAvatarGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  userAvatarGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },

  // --- BUBBLES ---
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  userMessageBubble: {
    borderRadius: 18,
    borderBottomRightRadius: 4,
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  aiMessageBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  userMessageText: {
    fontSize: 14.5,
    color: '#ffffff',
    fontWeight: '500',
    lineHeight: 21,
  },
  aiMessageText: {
    fontSize: 14.5,
    color: 'rgba(255, 255, 255, 0.95)',
    lineHeight: 21,
  },

  // --- TYPING INDICATOR ---
  typingBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#60a5fa',
    marginHorizontal: 3,
  },

  // --- INPUT AREA ---
  inputContainer: {
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: 'rgba(16, 27, 46, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    color: '#ffffff',
    fontSize: 14.5,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: 8,
    marginRight: 6,
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});