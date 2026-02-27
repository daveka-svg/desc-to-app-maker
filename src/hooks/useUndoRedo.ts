import { useState, useCallback, useRef } from 'react';

/**
 * Simple undo/redo history for text content.
 * Keeps a stack of states and allows moving back/forward.
 */

interface UseUndoRedoReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => string | undefined;
  redo: () => string | undefined;
  pushState: (value: string) => void;
  clear: () => void;
}

export function useUndoRedo(maxHistory: number = 50): UseUndoRedoReturn {
  const historyRef = useRef<string[]>(['']);
  const indexRef = useRef(0);
  const [, forceRender] = useState(0);

  const pushState = useCallback((value: string) => {
    const history = historyRef.current;
    const index = indexRef.current;

    // Don't push if same as current
    if (history[index] === value) return;

    // Truncate any forward history
    historyRef.current = history.slice(0, index + 1);
    historyRef.current.push(value);

    // Limit history size
    if (historyRef.current.length > maxHistory) {
      historyRef.current = historyRef.current.slice(-maxHistory);
    }

    indexRef.current = historyRef.current.length - 1;
    forceRender((n) => n + 1);
  }, [maxHistory]);

  const undo = useCallback((): string | undefined => {
    if (indexRef.current > 0) {
      indexRef.current -= 1;
      forceRender((n) => n + 1);
      return historyRef.current[indexRef.current];
    }
    return undefined;
  }, []);

  const redo = useCallback((): string | undefined => {
    if (indexRef.current < historyRef.current.length - 1) {
      indexRef.current += 1;
      forceRender((n) => n + 1);
      return historyRef.current[indexRef.current];
    }
    return undefined;
  }, []);

  const clear = useCallback(() => {
    historyRef.current = [''];
    indexRef.current = 0;
    forceRender((n) => n + 1);
  }, []);

  return {
    canUndo: indexRef.current > 0,
    canRedo: indexRef.current < historyRef.current.length - 1,
    undo,
    redo,
    pushState,
    clear,
  };
}
