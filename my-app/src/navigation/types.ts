export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;

  Home: undefined;

  BookDetail: { bookId: string | number };
  BookReader: {
    bookId: string | number;
    initialChapterOrder: number;
    initialLastReadPage?: number;
  };
  CardList: undefined;
  Conversation: { conversationId: string | number };
};