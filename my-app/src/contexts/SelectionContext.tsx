import React, {
  createContext,
  useMemo,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
  useContext,
} from "react";

export interface SelectedWord {
  chunkIndex: number;
  wordIndex: number;
}

interface SelectionContextType {
  selectedWord: SelectedWord | null;
  setSelectedWord: Dispatch<SetStateAction<SelectedWord | null>>;
}

interface SelectionProviderProps {
  children: ReactNode;
}

export const SelectionContext = createContext<
  SelectionContextType | undefined
>(undefined);

export function SelectionProvider({
  children,
}: SelectionProviderProps) {
  const [selectedWord, setSelectedWord] =
    useState<SelectedWord | null>(null);

  const value = useMemo(
    () => ({
      selectedWord,
      setSelectedWord,
    }),
    [selectedWord]
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}


export function useSelection(): SelectionContextType {
  const context = useContext(SelectionContext);

  if (!context) {
    throw new Error("useSelection must be used inside SelectionProvider");
  }

  return context;
}