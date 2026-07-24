// src/utils/textProcessor.ts

export type StructuredChunk =
  | {
      type: "chunk";
      content: string;
      originalIndex: number;
    }
  | {
      type: "paragraph_break";
      originalIndex: number;
    };

export function processTextToStructuredChunks(
  paragraphs: string[]
): StructuredChunk[] {
  if (!paragraphs.length) {
    return [];
  }

  const structuredData: StructuredChunk[] = [];

  const sentenceBoundaryRegex = /(?<=[.?!])\s+/;

  let elementCounter = 0;

  paragraphs.forEach((paragraph) => {
    if (!paragraph.trim()) {
      return;
    }

    const sentences = paragraph
      .trim()
      .split(sentenceBoundaryRegex);

    sentences.forEach((sentence) => {
      if (sentence.trim()) {
        structuredData.push({
          type: "chunk",
          content: sentence.trim(),
          originalIndex: elementCounter++,
        });
      }
    });

    structuredData.push({
      type: "paragraph_break",
      originalIndex: elementCounter++,
    });
  });

  if (
    structuredData.length &&
    structuredData.at(-1)?.type === "paragraph_break"
  ) {
    structuredData.pop();
  }

  return structuredData;
}