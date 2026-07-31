// src/utils/parseContentToWords.ts

export type ParsedWord =
  | {
      type: "word";
      text: string;
      wordIndex: number;
    }
  | {
      type: "space";
      text: string;
    };

export function parseContentToWords(
  text: string
): ParsedWord[] {
  if (!text) {
    return [];
  }

  const parts = text.split(/(\s+)/);

  let wordCounter = 0;

  return parts
    .filter((part) => part.length > 0)
    .map((part) => {
      const isWord = part.trim().length > 0;

      if (isWord) {
        return {
          type: "word",
          text: part,
          wordIndex: wordCounter++,
        };
      }

      return {
        type: "space",
        text: part,
      };
    });
}