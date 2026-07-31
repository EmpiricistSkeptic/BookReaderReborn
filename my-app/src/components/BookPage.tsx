import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, TextStyle } from 'react-native';
import TextChunk from './TextChunk';

// --- ИНТЕРФЕЙСЫ ---
export interface StructuredItem {
  type: 'chunk' | 'paragraph_break' | string;
  originalIndex: number;
  content?: string;
  [key: string]: any;
}

export interface ThemeConfig {
  type: string;
  bg: [string, string];
  text: string;
  tint: string;
  disabled: string;
  ui_bg: string;
}

export interface ChunkTranslationState {
  isTranslating: boolean;
  text: string | null;
  error: string | null;
}

export interface BookPageProps {
  pageContent: StructuredItem[];
  onWordPress: (word: string, chunk: StructuredItem, wordIndexInChunk: number) => void;
  theme: ThemeConfig;
  fontSize: number;
  lineHeight: number;
  onChunkTranslate: (chunk: StructuredItem) => void;
  chunkTranslations: Record<number, ChunkTranslationState>;
  onSpeak: (text: string, identifier: string | number, languageCode: string) => void;
  speakingIdentifier: string | number | null;
  bookLanguage: string;
}

const ParagraphBreak: React.FC = () => <View style={styles.paragraphBreak} />;

const BookPage: React.FC<BookPageProps> = ({
  pageContent,
  onWordPress,
  theme,
  fontSize,
  lineHeight,
  onChunkTranslate,
  chunkTranslations,
  onSpeak,
  speakingIdentifier,
  bookLanguage,
}) => {
  const textStyle: TextStyle = useMemo(() => ({
    color: theme.text,
    fontSize: fontSize,
    lineHeight: lineHeight,
  }), [theme.text, fontSize, lineHeight]);

  return (
    <ScrollView
      style={styles.pageContainer}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {pageContent.map((item) => {
        if (item.type === 'chunk' && item.content) {
          return (
            <TextChunk
              key={`chunk-${item.originalIndex}`}

              // Основные пропсы
              content={item.content}
              onWordPress={onWordPress}
              style={textStyle}
              chunkIndex={item.originalIndex}

              // Пропсы для перевода
              theme={theme}
              onTranslateRequest={() => onChunkTranslate(item)}
              translationState={chunkTranslations[item.originalIndex]}

              // TTS: Пробрасываем пропсы для озвучивания в TextChunk
              onSpeak={onSpeak}
              speakingIdentifier={speakingIdentifier}
              bookLanguage={bookLanguage}
            />
          );
        }
        if (item.type === 'paragraph_break') {
          return <ParagraphBreak key={`break-${item.originalIndex}`} />;
        }
        return null;
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 35,
    paddingBottom: 20,
  },
  paragraphBreak: {
    width: '100%',
    height: 16,
  },
});

export default React.memo(BookPage);