// src/screens/BookDetailScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../services/apiService';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

// ============================================================
// ТИПЫ
// ============================================================

interface UserProgress {
  last_read_chapter_order?: number;
  last_read_page?: number;
}

interface Chapter {
  id: number | string;
  order: number;
  title: string;
}

interface BookDetail {
  id: number | string;
  title: string;
  authors?: string;
  cover_url?: string | null;
  description?: string;
  chapter_count?: number;
  chapters: Chapter[];
  user_progress?: UserProgress | null;
}

type BookDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'BookDetail'>;

const BookDetailScreen: React.FC<BookDetailScreenProps> = ({ route, navigation }) => {
  const { bookId } = route.params;

  const [bookDetail, setBookDetail] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBookDetails = async () => {
      try {
        setLoading(true);
        const data = (await apiRequest(`/books/${bookId}/`)) as BookDetail;
        setBookDetail(data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load book data');
        Alert.alert('Error', e?.message || 'Failed to load book data');
      } finally {
        setLoading(false);
      }
    };

    fetchBookDetails();
  }, [bookId]);

  // =========================================================================================
  // ==== ИЗМЕНЕНИЕ №1 =======================================================================
  // =========================================================================================
  const handleContinueReading = () => {
    if (!bookDetail) return;

    // Определяем начальную главу и страницу. Если прогресса нет, начинаем с 1 главы, 1 страницы.
    const startChapterOrder = bookDetail.user_progress?.last_read_chapter_order || 1;
    const startPage = bookDetail.user_progress?.last_read_page || 1;

    console.log(`[Continue Reading] Navigating to Chapter: ${startChapterOrder}, Page: ${startPage}`);

    // Передаем оба параметра в читалку
    navigation.navigate('BookReader', {
      // Убедитесь, что имя экрана 'BookReaderScreen'
      bookId: bookDetail.id,
      initialChapterOrder: startChapterOrder,
      initialLastReadPage: startPage,
    });
  };

  // =========================================================================================
  // ==== ИЗМЕНЕНИЕ №2 =======================================================================
  // =========================================================================================
  const handleChapterPress = (chapter: Chapter) => {
    if (!bookDetail) return;

    // Проверяем, является ли выбранная глава той, на которой остановился пользователь
    const isLastReadChapter = chapter.order === bookDetail.user_progress?.last_read_chapter_order;
    // Если да - берем последнюю страницу, если нет - начинаем с первой.
    const startPage = isLastReadChapter ? bookDetail.user_progress?.last_read_page || 1 : 1;

    console.log(`[Chapter Press] Navigating to Chapter: ${chapter.order}, Page: ${startPage}`);

    navigation.navigate('BookReader', {
      // Убедитесь, что имя экрана 'BookReaderScreen'
      bookId: bookDetail.id,
      initialChapterOrder: chapter.order,
      initialLastReadPage: startPage,
    });
  };

  if (loading) {
    return (
      <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading book...</Text>
      </LinearGradient>
    );
  }

  if (error || !bookDetail) {
    return (
      <LinearGradient colors={['#c0392b', '#8e44ad']} style={styles.centerContainer}>
        <Ionicons name="close-circle-outline" size={60} color="rgba(255,255,255,0.7)" />
        <Text style={styles.errorText}>Failed to load book</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Return</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <TouchableOpacity style={styles.goBackButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.coverShadow}>
            {bookDetail.cover_url ? (
              <Image source={{ uri: bookDetail.cover_url }} style={styles.coverImage} />
            ) : (
              <View style={[styles.coverImage, styles.coverPlaceholder]}>
                <Ionicons name="book" size={50} color="rgba(255,255,255,0.7)" />
              </View>
            )}
          </View>
          <Text style={styles.title}>{bookDetail.title}</Text>
          <Text style={styles.author}>{bookDetail.authors || 'Author not specified'}</Text>

          <TouchableOpacity style={styles.continueButton} onPress={handleContinueReading}>
            <Ionicons
              name={bookDetail.user_progress ? 'play-circle-outline' : 'play-outline'}
              size={22}
              color="#fff"
            />
            <Text style={styles.continueButtonText}>
              {bookDetail.user_progress
                ? `Continue from chapter ${bookDetail.user_progress.last_read_chapter_order}`
                : 'Start reading'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{bookDetail.description || 'No description available.'}</Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Chapters ({bookDetail.chapter_count})</Text>
          {bookDetail.chapters.map((chapter) => {
            const isLastRead = chapter.order === bookDetail.user_progress?.last_read_chapter_order;

            return (
              <TouchableOpacity
                key={chapter.id}
                style={[styles.chapterItem, isLastRead && styles.chapterItemActive]}
                onPress={() => handleChapterPress(chapter)}
              >
                {isLastRead && (
                  <Ionicons name="eye-outline" size={18} color="#fff" style={styles.activeChapterIcon} />
                )}

                <Text style={styles.chapterOrder}>{chapter.order}.</Text>

                <Text style={[styles.chapterTitle, isLastRead && styles.chapterTitleActive]}>{chapter.title}</Text>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={isLastRead ? '#fff' : 'rgba(255,255,255,0.6)'}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  goBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 100,
    marginBottom: 30,
  },
  coverShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  coverImage: {
    width: 150,
    height: 220,
    borderRadius: 12,
  },
  coverPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
  },
  author: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  infoSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingBottom: 10,
  },
  description: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  chapterOrder: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    marginRight: 10,
  },
  chapterTitle: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  loadingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 16,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  chapterItemActive: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 8,
  },
  chapterTitleActive: {
    fontWeight: 'bold',
  },
  activeChapterIcon: {
    marginRight: 8,
  },
});

export default BookDetailScreen;