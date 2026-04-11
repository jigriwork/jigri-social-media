import { useState, useCallback, useEffect } from 'react';
import { useSearchUsers } from '@/lib/react-query/queriesAndMutations';

export const useMentions = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<{ start: number, end: number } | null>(null);
  
  // Throttle search parameter to prevent spamming
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 200);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: searchResults, isFetching } = useSearchUsers(debouncedSearch);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>, text: string) => {
    const cursor = e.target.selectionStart ?? text.length;
    
    // Find the word currently being typed
    const textBeforeCursor = text.slice(0, cursor);
    const words = textBeforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1];

    if (currentWord.startsWith('@') && currentWord.length > 0) {
      setSearchTerm(currentWord.slice(1));
      setIsDropdownVisible(true);
      setCursorPosition({
        start: cursor - currentWord.length,
        end: cursor
      });
    } else {
      setIsDropdownVisible(false);
      setSearchTerm("");
    }
  }, []);

  const closeDropdown = useCallback(() => {
    setIsDropdownVisible(false);
  }, []);

  const insertMention = useCallback((username: string, text: string) => {
    if (!cursorPosition) return text;
    
    const textBefore = text.slice(0, cursorPosition.start);
    const textAfter = text.slice(cursorPosition.end);
    
    // Add the space so they can keep typing
    const newText = `${textBefore}@${username} ${textAfter}`;
    
    setIsDropdownVisible(false);
    setSearchTerm("");
    
    return newText;
  }, [cursorPosition]);

  return {
    searchTerm,
    isDropdownVisible,
    searchResults: searchResults || [],
    isFetching,
    handleTextChange,
    insertMention,
    closeDropdown
  };
};
