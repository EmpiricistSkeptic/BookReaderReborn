import React, { useState, useEffect, useRef, useCallback, useMemo, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Animated,
  StatusBar,
  Dimensions,
  ListRenderItemInfo,
  GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import BottomSheet from '@gorhom/bottom-sheet';

import { apiRequest } from '../services/apiService';
import { AuthContext } from '../contexts/AuthContext';
import { SelectionContext } from '../contexts/SelectionContext';
import TranslationBottomSheet, { TranslationResult, ChunkTranslationState, ThemeConfig } from '../components/TranslationBottomSheet';
import { processTextToStructuredChunks } from '../utils/textProcessor';
import BookPage from '../components/BookPage';
import Paginator, { StructuredItem, PageStyle } from '../components/Paginator';

// --- Константы ---
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const TAP_TIME_THRESHOLD = 250;
const TAP_POS_THRESHOLD = 10;
const PROGRESS_SAVE_DEBOUNCE_MS = 1500;
const SETTINGS_SAVE_DEBOUNCE_MS = 1000;

export type ThemeName = 'light' | 'sepia' | 'dark';

const themes: Record<ThemeName, ThemeConfig> = {
  light: { type: 'color', bg: ['#f5f5f5', '#e8e8e8'], text: '#2c3e50', tint: '#34495e', disabled: '#b0b9c1', ui_bg: 'rgba(255, 255, 255, 0.95)' },
  sepia: { type: 'color', bg: ['#f4ecd8', '#e9dec7'], text: '#5b4636', tint: '#7b6656', disabled: '#ab9a8e', ui_bg: 'rgba(244, 236, 216, 0.95)' },
  dark: { type: 'color', bg: ['#2c3e50', '#212f3c'], text: '#ecf0f1', tint: '#bdc3c7', disabled: '#7f8c8d', ui_bg: 'rgba(44, 62, 80, 0.95)' },
};

type Page = StructuredItem[];

interface ChapterInfo {
  id: number | string;
  title: string;
  content: string;
  book_language?: string;
  total_pages?: number;
  [key: string]: unknown;
}

interface ChapterResponse {
  chapter: ChapterInfo;
  total_chapters: number;
  [key: string]: unknown;
}

interface UserProfileSettings {
  reading_theme?: ThemeName;
  reading_font_size?: number;
  [key: string]: unknown;
}

interface AuthUser {
  id?: number | string;
  [key: string]: unknown;
}

interface AuthContextValue {
  user?: AuthUser | null;
  [key: string]: unknown;
}

interface SelectionValue {
  chunkIndex: number;
  wordIndex: number;
}

interface SelectionContextValue {
  setSelectedWord: (value: SelectionValue | null) => void;
  [key: string]: unknown;
}

interface BookReaderRouteParams {
  bookId: number | string;
  initialChapterOrder: number;
  initialLastReadPage?: number;
}

interface BookReaderScreenProps {
  route: { params: BookReaderRouteParams };
  navigation: { goBack: () => void };
}

interface ReadingPositionSnapshot {
  anchorOriginalIndex: number | null;
  progress: number;
}

const BookReaderScreen: React.FC<BookReaderScreenProps> = ({ route, navigation }) => {
  const { user } = useContext(AuthContext) as AuthContextValue;
  const { bookId, initialChapterOrder, initialLastReadPage = 1 } = route.params;
  const { setSelectedWord } = useContext(SelectionContext) as SelectionContextValue;

  // --- Состояния ---
  const [chapterData, setChapterData] = useState<ChapterResponse | null>(null);
  const [structuredContent, setStructuredContent] = useState<StructuredItem[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentOrder, setCurrentOrder] = useState<number>(initialChapterOrder);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPaginating, setIsPaginating] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [theme, setTheme] = useState<ThemeName>('light');
  const [fontSize, setFontSize] = useState<number>(16);
  const lineHeight = useMemo(() => fontSize * 1.6, [fontSize]);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [chunkTranslations, setChunkTranslations] = useState<Record<number, ChunkTranslationState>>({});
  const [translationService, setTranslationService] = useState<'microsoft' | 'deepl' | 'deepseek'>('deepseek');
  const [speakingIdentifier, setSpeakingIdentifier] = useState<string | null>(null);

  // --- Рефы ---
  const flatListRef = useRef<FlatList<Page>>(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const bottomSheetRef = useRef<BottomSheet>(null);
  const touchStartTimestamp = useRef<number>(0);
  const touchStartPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isInitialChapterLoad = useRef<boolean>(true);
  const pendingPositionRestoreRef = useRef<ReadingPositionSnapshot | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressToSaveRef = useRef<{ order: number; page: number }>({ order: currentOrder, page: currentPage });
  const settingsDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('reading_theme');
        const savedFontSize = await AsyncStorage.getItem('reading_font_size');
        if (savedTheme) setTheme(savedTheme as ThemeName);
        if (savedFontSize) setFontSize(parseInt(savedFontSize, 10));

        if (user?.id) {
          const profile = (await apiRequest(`/profile/${user.id}/`)) as UserProfileSettings;
          if (profile.reading_theme && profile.reading_theme !== savedTheme) {
            setTheme(profile.reading_theme);
            await AsyncStorage.setItem('reading_theme', profile.reading_theme);
          }
          if (profile.reading_font_size && profile.reading_font_size !== parseInt(savedFontSize ?? '', 10)) {
            setFontSize(profile.reading_font_size);
            await AsyncStorage.setItem('reading_font_size', String(profile.reading_font_size));
          }
        }
      } catch (error) {
        console.error('Failed to load user settings:', error);
      }
    };

    loadSettings();
    fetchChapter(initialChapterOrder);

    return () => {
      Speech.stop();
      if (settingsDebounceTimeoutRef.current) {
        clearTimeout(settingsDebounceTimeoutRef.current);
      }
    };
  }, []);


  const fetchChapter = useCallback(
    async (order: number) => {
      Speech.stop();
      setSpeakingIdentifier(null);

      setLoading(true);
      isInitialChapterLoad.current = true;
      pendingPositionRestoreRef.current = null;
      setStructuredContent([]);
      setPages([]);
      setChunkTranslations({});
      try {
        const data = (await apiRequest(`/books/${bookId}/chapter_content/?chapter=${order}`)) as ChapterResponse;
        const processedContent = processTextToStructuredChunks(data.chapter.content) as StructuredItem[];

        setStructuredContent(processedContent);
        setChapterData(data);
        setCurrentOrder(order);
        setCurrentPage(1);
        setIsPaginating(true);
      } catch (e) {
        Alert.alert('Error', `Failed to load chapter ${order}.`);
      } finally {
        setLoading(false);
      }
    },
    [bookId]
  );

  useEffect(() => {
    Animated.timing(controlsOpacity, { toValue: controlsVisible ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [controlsVisible, controlsOpacity]);

  const saveProgress = useCallback(
    async (order: number, page: number) => {
      if (!order || !page || page <= 0) return;
      try {
        await apiRequest(`/books/${bookId}/update_progress/`, 'POST', {
          chapter_order: order,
          last_read_page: page,
        });
      } catch (e: any) {
        console.error(`Failed to save progress: ${e.message}`);
      }
    },
    [bookId]
  );

  const saveSettings = useCallback(
    async (settings: UserProfileSettings) => {
      if (!user?.id) return;
      try {
        await apiRequest(`/profile/${user.id}/`, 'PATCH', settings);
      } catch (error) {
        console.error('Failed to save settings to server:', error);
      }
    },
    [user]
  );

  const handleThemeChange = useCallback(
    async (newTheme: ThemeName) => {
      if (newTheme === theme) return;

      setTheme(newTheme);
      await AsyncStorage.setItem('reading_theme', newTheme);
      saveSettings({ reading_theme: newTheme });
    },
    [theme, saveSettings]
  );

  const captureCurrentReadingPosition = useCallback(() => {
    if (pages.length === 0) {
      pendingPositionRestoreRef.current = null;
      return;
    }

    const currentPageIndex = Math.max(
      0,
      Math.min(currentPage - 1, pages.length - 1)
    );

    const currentPageContent = pages[currentPageIndex];

    const firstChunk = currentPageContent?.find(
      (item) => item.type === 'chunk'
    );

    const progress =
      pages.length > 1
        ? currentPageIndex / (pages.length - 1)
        : 0;

    pendingPositionRestoreRef.current = {
      anchorOriginalIndex: firstChunk?.originalIndex ?? null,
      progress,
    };
  }, [currentPage, pages]);

  const handleFontSizeChange = useCallback(
    (newSize: number) => {
      const clampedSize = Math.max(12, Math.min(28, newSize));

      if (clampedSize === fontSize) return;

      // Сохраняем текущее место до изменения размера текста.
      captureCurrentReadingPosition();

      setFontSize(clampedSize);

      // Новый размер текста требует повторной пагинации.
      if (structuredContent.length > 0) {
        setIsPaginating(true);
      }

      AsyncStorage.setItem(
        'reading_font_size',
        String(clampedSize)
      ).catch((error) => {
        console.error(
          'Failed to save font size locally:',
          error
        );
      });

      if (settingsDebounceTimeoutRef.current) {
        clearTimeout(settingsDebounceTimeoutRef.current);
      }

      settingsDebounceTimeoutRef.current = setTimeout(() => {
        saveSettings({
          reading_font_size: clampedSize,
        });
      }, SETTINGS_SAVE_DEBOUNCE_MS);
    },
    [
      fontSize,
      structuredContent.length,
      captureCurrentReadingPosition,
      saveSettings,
    ]
  );

  useEffect(() => {
    progressToSaveRef.current = { order: currentOrder, page: currentPage };
    if (isInitialChapterLoad.current) return;
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      saveProgress(currentOrder, currentPage);
    }, PROGRESS_SAVE_DEBOUNCE_MS);
  }, [currentPage, currentOrder, saveProgress]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      saveProgress(progressToSaveRef.current.order, progressToSaveRef.current.page);
    };
  }, [saveProgress]);

  const findRestoredPageIndex = useCallback(
    (
      paginatedPages: Page[],
      snapshot: ReadingPositionSnapshot
    ): number => {
      if (paginatedPages.length === 0) return 0;

      const progressPageIndex = Math.round(
        snapshot.progress * (paginatedPages.length - 1)
      );

      if (snapshot.anchorOriginalIndex === null) {
        return progressPageIndex;
      }

      const matchingPageIndexes: number[] = [];

      paginatedPages.forEach((page, pageIndex) => {
        const containsAnchor = page.some(
          (item) =>
            item.originalIndex === snapshot.anchorOriginalIndex
        );

        if (containsAnchor) {
          matchingPageIndexes.push(pageIndex);
        }
      });

      if (matchingPageIndexes.length === 0) {
        return progressPageIndex;
      }

      // Если чанк встречается на нескольких страницах,
      // выбираем страницу, ближайшую к прежнему проценту чтения.
      return matchingPageIndexes.reduce(
        (closestIndex, candidateIndex) => {
          const closestDistance = Math.abs(
            closestIndex - progressPageIndex
          );

          const candidateDistance = Math.abs(
            candidateIndex - progressPageIndex
          );

          return candidateDistance < closestDistance
            ? candidateIndex
            : closestIndex;
        },
        matchingPageIndexes[0]
      );
    },
    []
  );

  const handlePaginated = useCallback(
    (paginatedPages: Page[]) => {
      const totalPages = paginatedPages.length;

      let targetPageIndex = 0;

      if (totalPages > 0) {
        if (
          isInitialChapterLoad.current &&
          currentOrder === initialChapterOrder
        ) {
          // Первое открытие изначальной главы:
          // используем сохранённую сервером страницу.
          targetPageIndex = Math.max(
            0,
            Math.min(initialLastReadPage - 1, totalPages - 1)
          );
        } else if (pendingPositionRestoreRef.current) {
          // Повторная пагинация после изменения шрифта:
          // восстанавливаем место по чанку и проценту.
          targetPageIndex = findRestoredPageIndex(
            paginatedPages,
            pendingPositionRestoreRef.current
          );
        } else {
          // Запасной вариант для непредвиденной перепагинации.
          targetPageIndex = Math.max(
            0,
            Math.min(currentPage - 1, totalPages - 1)
          );
        }
      }

      setPages(paginatedPages);
      setIsPaginating(false);

      if (
        totalPages > 0 &&
        chapterData?.chapter?.id &&
        chapterData.chapter.total_pages !== totalPages
      ) {
        apiRequest(
          `/books/${bookId}/chapters/${chapterData.chapter.id}/update_total_pages/`,
          'POST',
          {
            total_pages: totalPages,
          }
        ).catch((error) => {
          console.error(
            'Failed to update total_pages on backend:',
            error
          );
        });
      }

      setTimeout(() => {
        if (!flatListRef.current || totalPages === 0) {
          pendingPositionRestoreRef.current = null;
          return;
        }

        const safePageIndex = Math.max(
          0,
          Math.min(targetPageIndex, totalPages - 1)
        );

        flatListRef.current.scrollToIndex({
          index: safePageIndex,
          animated: false,
        });

        setCurrentPage(safePageIndex + 1);

        isInitialChapterLoad.current = false;
        pendingPositionRestoreRef.current = null;
      }, 50);
    },
    [
      initialLastReadPage,
      initialChapterOrder,
      currentOrder,
      currentPage,
      bookId,
      chapterData,
      findRestoredPageIndex,
    ]
  );

  const getItemLayout = (_: ArrayLike<Page> | null | undefined, index: number) => ({
    length: screenWidth,
    offset: screenWidth * index,
    index,
  });

  const handleSpeak = useCallback(
    (text: string, identifier: string | number, languageCode?: string) => {
      const idStr = String(identifier);
      Speech.stop();

      if (speakingIdentifier === idStr) {
        setSpeakingIdentifier(null);
        return;
      }

      setSpeakingIdentifier(idStr);

      Speech.speak(text, {
        language: languageCode,
        onDone: () => setSpeakingIdentifier(null),
        onStopped: () => setSpeakingIdentifier(null),
        onError: (error) => {
          console.error('Speech synthesis error:', error);
          setSpeakingIdentifier(null);
          Alert.alert('Error', 'The text could not be reproduced.');
        },
      });
    },
    [speakingIdentifier]
  );

  const handleWordPress = useCallback(
    async (word: string, chunk: StructuredItem, wordIndexInChunk: number) => {
      setSelectedWord({ chunkIndex: chunk.originalIndex, wordIndex: wordIndexInChunk });
      const cleanedWord = word.trim().replace(/[.,!?;:"]+$/, '');
      if (cleanedWord.length === 0) {
        setSelectedWord(null);
        return;
      }

      bottomSheetRef.current?.expand();
      setIsTranslating(true);
      setTranslationResult(null);
      try {
        const result = (await apiRequest('/translate/', 'POST', {
          text: cleanedWord,
          book: bookId,
          service: translationService,
        })) as TranslationResult;
        setTranslationResult(result);
      } catch (e: any) {
        setTranslationResult({ error: e?.response?.data?.error || 'Failed to complete the translation.' });
      } finally {
        setIsTranslating(false);
      }
    },
    [bookId, translationService, setSelectedWord]
  );

  const handleChunkTranslate = useCallback(
    async (chunk: StructuredItem) => {
      const chunkIndex = chunk.originalIndex;
      if (chunkTranslations[chunkIndex]?.text) return;

      setChunkTranslations((prev) => ({ ...prev, [chunkIndex]: { isTranslating: true, text: null, error: null } }));

      try {
        const result = (await apiRequest('/translate/', 'POST', {
          text: chunk.content,
          book: bookId,
          service: translationService,
        })) as TranslationResult;
        setChunkTranslations((prev) => ({
          ...prev,
          [chunkIndex]: { isTranslating: false, text: result.translated_text ?? null, error: null },
        }));
      } catch (e: any) {
        setChunkTranslations((prev) => ({
          ...prev,
          [chunkIndex]: { isTranslating: false, text: null, error: e?.response?.data?.error || 'Translation error.' },
        }));
      }
    },
    [bookId, translationService, chunkTranslations]
  );

  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) setSelectedWord(null);
    },
    [setSelectedWord]
  );

  const handleTouchStart = (event: GestureResponderEvent) => {
    touchStartTimestamp.current = Date.now();
    touchStartPosition.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    const timeDiff = Date.now() - touchStartTimestamp.current;
    const posDiff = Math.hypot(
      event.nativeEvent.pageX - touchStartPosition.current.x,
      event.nativeEvent.pageY - touchStartPosition.current.y
    );
    if (timeDiff < TAP_TIME_THRESHOLD && posDiff < TAP_POS_THRESHOLD) {
      bottomSheetRef.current?.close();
      setControlsVisible((prev) => !prev);
    }
  };

  const changeChapter = useCallback(
    async (newChapterOrder: number) => {
      if (loading) return;
      await saveProgress(currentOrder, currentPage);
      fetchChapter(newChapterOrder);
    },
    [loading, currentOrder, currentPage, fetchChapter, saveProgress]
  );

  const goToNextChapter = () =>
    !loading && chapterData && currentOrder < chapterData.total_chapters && changeChapter(currentOrder + 1);
  const goToPrevChapter = () => !loading && currentOrder > 1 && changeChapter(currentOrder - 1);

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const newPageNumber = Math.round(event.nativeEvent.contentOffset.x / screenWidth) + 1;
      if (newPageNumber > 0 && newPageNumber !== currentPage) setCurrentPage(newPageNumber);
    },
    [currentPage]
  );

  const currentTheme = themes[theme];
  const totalChapters = chapterData?.total_chapters || 0;
  const progressPercent = pages.length > 0 ? (currentPage / pages.length) * 100 : 0;

  const pageStyle: PageStyle = useMemo(
    () => ({
      width: screenWidth - 40,
      height: screenHeight - 85 - 120,
      fontSize,
      lineHeight,
    }),
    [fontSize, lineHeight]
  );

  const renderPage = useCallback(
    ({ item }: ListRenderItemInfo<Page>) => (
      <View style={{ width: screenWidth }}>
        <BookPage
          pageContent={item}
          onWordPress={handleWordPress}
          theme={currentTheme}
          fontSize={fontSize}
          lineHeight={lineHeight}
          onChunkTranslate={handleChunkTranslate}
          chunkTranslations={chunkTranslations}
          onSpeak={handleSpeak}
          speakingIdentifier={speakingIdentifier}
          bookLanguage={chapterData?.chapter?.book_language || 'en-US'}
        />
      </View>
    ),
    [handleWordPress, currentTheme, fontSize, lineHeight, handleChunkTranslate, chunkTranslations, handleSpeak, speakingIdentifier, chapterData]
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <LinearGradient colors={currentTheme.bg} style={styles.container}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />

        {isPaginating && <Paginator structuredContent={structuredContent} pageStyle={pageStyle} onPaginated={handlePaginated} />}

        <View style={styles.contentArea} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {loading ? (
            <ActivityIndicator size="large" color={currentTheme.tint} />
          ) : isPaginating ? (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="large" color={currentTheme.tint} />
              <Text style={[styles.statusText, { color: currentTheme.tint }]}>Formatting page...</Text>
            </View>
          ) : (
            <FlatList<Page>
              ref={flatListRef}
              data={pages}
              renderItem={renderPage}
              keyExtractor={(_, index) => `page-${index}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              getItemLayout={getItemLayout}
              removeClippedSubviews={true}
              windowSize={5}
              initialNumToRender={1}
              maxToRenderPerBatch={3}
              extraData={{ theme, fontSize, pages: pages.length, chunkTranslations, speakingIdentifier }}
            />
          )}
        </View>

        <Animated.View
          style={[styles.header, { backgroundColor: currentTheme.ui_bg, opacity: controlsOpacity, pointerEvents: controlsVisible ? 'auto' : 'none' }]}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color={currentTheme.tint} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: currentTheme.tint }]} numberOfLines={1}>
              {chapterData?.chapter.title || 'Loading...'}
            </Text>
            <Text style={[styles.progressText, { color: currentTheme.tint }]}>
              Chapter {currentOrder} of {totalChapters || '...'}
            </Text>
          </View>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="bookmark-outline" size={22} color={currentTheme.tint} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={[styles.footer, { backgroundColor: currentTheme.ui_bg, opacity: controlsOpacity, pointerEvents: controlsVisible ? 'auto' : 'none' }]}
        >
          <View style={styles.footerContent}>
            <View style={styles.progressFooterContainer}>
              <Text style={[styles.progressFooterText, { color: currentTheme.tint }]}>
                Page {currentPage} of {pages.length}
              </Text>
              <View style={styles.progressFooterBar}>
                <View style={[styles.progressFooterFill, { width: `${progressPercent}%`, backgroundColor: currentTheme.tint }]} />
              </View>
            </View>
            <View style={styles.serviceSelectorContainer}>
              <TouchableOpacity
                style={[styles.serviceButton, translationService === 'deepl' && styles.serviceButtonActive]}
                onPress={() => setTranslationService('deepl')}
              >
                <Text style={[styles.serviceButtonText, { color: currentTheme.tint }]}>DeepL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.serviceButton, translationService === 'microsoft' && styles.serviceButtonActive]}
                onPress={() => setTranslationService('microsoft')}
              >
                <Text style={[styles.serviceButtonText, { color: currentTheme.tint }]}>Microsoft</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.serviceButton, translationService === 'deepseek' && styles.serviceButtonActive]}
                onPress={() => setTranslationService('deepseek')}
              >
                <Text style={[styles.serviceButtonText, { color: currentTheme.tint }]}>DeepSeek</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.settings}>
              <TouchableOpacity onPress={() => handleFontSizeChange(fontSize - 1)} style={styles.iconButton}>
                <Text style={[styles.fontSetting, { color: currentTheme.tint }]}>A-</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleThemeChange('light')} style={[styles.themeButton, theme === 'light' && styles.themeButtonActive]}>
                <View style={[styles.themeCircle, { backgroundColor: '#f5f5f5' }]} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleThemeChange('sepia')} style={[styles.themeButton, theme === 'sepia' && styles.themeButtonActive]}>
                <View style={[styles.themeCircle, { backgroundColor: '#f4ecd8' }]} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleThemeChange('dark')} style={[styles.themeButton, theme === 'dark' && styles.themeButtonActive]}>
                <View style={[styles.themeCircle, { backgroundColor: '#2c3e50' }]} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleFontSizeChange(fontSize + 1)} style={styles.iconButton}>
                <Text style={[styles.fontSetting, { color: currentTheme.tint }]}>A+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={goToPrevChapter} disabled={loading || currentOrder <= 1} style={styles.navButtonLeft}>
            <Ionicons name="chevron-back" size={24} color={currentOrder > 1 ? currentTheme.tint : currentTheme.disabled} />
            <Text style={[styles.navText, { color: currentOrder > 1 ? currentTheme.tint : currentTheme.disabled }]}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToNextChapter} disabled={loading || !chapterData || currentOrder >= totalChapters} style={styles.navButtonRight}>
            <Text style={[styles.navText, { color: !chapterData || currentOrder < totalChapters ? currentTheme.tint : currentTheme.disabled }]}>Next</Text>
            <Ionicons name="chevron-forward" size={24} color={!chapterData || currentOrder < totalChapters ? currentTheme.tint : currentTheme.disabled} />
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>

      {/* --- ИНТЕРАКТИВНЫЕ КОМПОНЕНТЫ ЗА ПРЕДЕЛАМИ ГРАДИЕНТА --- */}
      <TranslationBottomSheet
        bottomSheetRef={bottomSheetRef}
        isTranslating={isTranslating}
        translationResult={translationResult}
        theme={currentTheme}
        onChange={handleSheetChanges}
        onSpeak={handleSpeak}
        bookLanguage={chapterData?.chapter?.book_language || 'en-US'}
      />
    </GestureHandlerRootView>
  );
};

// --- СТИЛИ ---
const styles = StyleSheet.create({
  container: { flex: 1 },
  contentArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusText: { marginTop: 15, fontSize: 16 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 85,
    paddingTop: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    zIndex: 10,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    paddingBottom: 25,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    zIndex: 10,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  headerInfo: { alignItems: 'center', flex: 1, marginHorizontal: 10 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  progressText: { fontSize: 12 },
  iconButton: { padding: 10 },
  footerContent: { flex: 1, justifyContent: 'space-between', paddingBottom: 5, paddingTop: 5 },
  progressFooterContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  progressFooterText: { fontSize: 12, minWidth: 80, textAlign: 'center' },
  progressFooterBar: { flex: 1, height: 3, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 1.5 },
  progressFooterFill: { height: '100%', borderRadius: 1.5 },
  serviceSelectorContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, height: 25 },
  serviceButton: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1.5, borderColor: 'transparent' },
  serviceButtonActive: { borderColor: '#3498db', backgroundColor: 'rgba(52, 152, 219, 0.1)' },
  serviceButtonText: { fontSize: 12, fontWeight: '500' },
  settings: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  fontSetting: { fontSize: 18, fontWeight: 'bold' },
  themeButton: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  themeButtonActive: { borderColor: '#3498db' },
  themeCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  navButtonLeft: { position: 'absolute', left: 10, bottom: 45, flexDirection: 'row', alignItems: 'center' },
  navButtonRight: { position: 'absolute', right: 10, bottom: 45, flexDirection: 'row', alignItems: 'center' },
  navText: { fontSize: 16 },
});

export default BookReaderScreen;