import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type EvaluationValue = number | 'good' | 'bad';

type EvaluationsByThread = Record<string, Record<string, EvaluationValue>>;

const STORAGE_KEY = 'solmail-thread-evaluations';

//enables storage of evaluations and recommendations -- persistent across states (e.g. will not lose scoring information between refreshes)
function loadFromStorage(): {
  byThread: EvaluationsByThread;
  recommendationsByThread: Record<string, string[]>;
} {
  if (typeof window === 'undefined') {
    return { byThread: {}, recommendationsByThread: {} };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        byThread?: EvaluationsByThread;
        recommendationsByThread?: Record<string, string[]>;
      };
      return {
        byThread: parsed.byThread ?? {},
        recommendationsByThread: parsed.recommendationsByThread ?? {},
      };
    }
  } catch {
    // ignore
  }
  return { byThread: {}, recommendationsByThread: {} };
}

function saveToStorage(
  byThread: EvaluationsByThread,
  recommendationsByThread: Record<string, string[]>,
) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ byThread, recommendationsByThread }),
    );
  } catch {
    // ignore (e.g. quota, private mode)
  }
}

//A single object that holds everything the rest of the app needs for thread evaluations (version, getters, and setter)
type ThreadEvaluationContextValue = {
  /** Bumped when any evaluation is set; pass to memoized list/display so they re-render and show updated tag. */
  evaluationVersion: number;
  /** Map of messageId -> score | 'good' | 'bad' for use with getEmailStatus(..., aiEvaluationResults). */
  getEvaluationsForThread: (threadId: string | null) => Map<string, EvaluationValue>;
  /** Recommendations for the latest scored message in the thread (for StatusTag popover). */
  getRecommendationsForThread: (threadId: string | null) => string[];
  setThreadEvaluation: (
    threadId: string,
    messageId: string,
    value: EvaluationValue,
    recommendations?: string[],
  ) => void;
};

const ThreadEvaluationContext = createContext<ThreadEvaluationContextValue | null>(
  null,
);

//component that owns the state (byThread, recommendationsByThread, evaluationVersion) and puts that value into the context so all descendants can use it
//wraps the mail UI (e.g. in mail.tsx), so the whole mail app is “inside” this context
export function ThreadEvaluationProvider({ children }: { children: ReactNode }) {
  const [byThread, setByThread] = useState<EvaluationsByThread>(() =>
    loadFromStorage().byThread,
  );
  const [recommendationsByThread, setRecommendationsByThread] = useState<
    Record<string, string[]>
  >(() => loadFromStorage().recommendationsByThread);
  const [evaluationVersion, setEvaluationVersion] = useState(0);

  useEffect(() => {
    saveToStorage(byThread, recommendationsByThread);
  }, [byThread, recommendationsByThread]);

  const setThreadEvaluation = useCallback(
    (
      threadId: string,
      messageId: string,
      value: EvaluationValue,
      recommendations?: string[],
    ) => {
      setByThread((prev) => {
        const thread = prev[threadId] ?? {};
        return {
          ...prev,
          [threadId]: { ...thread, [messageId]: value },
        };
      });
      if (recommendations != null) {
        setRecommendationsByThread((prev) => ({
          ...prev,
          [threadId]: recommendations,
        }));
      }
      setEvaluationVersion((v) => v + 1);
    },
    [],
  );

  const getRecommendationsForThread = useCallback(
    (threadId: string | null): string[] => {
      if (!threadId) return [];
      return recommendationsByThread[threadId] ?? [];
    },
    [recommendationsByThread],
  );

  const getEvaluationsForThread = useCallback(
    (threadId: string | null): Map<string, EvaluationValue> => {
      if (!threadId) return new Map<string, EvaluationValue>();
      const thread = byThread[threadId];
      if (!thread) return new Map<string, EvaluationValue>();
      return new Map(Object.entries(thread));
    },
    [byThread],
  );

  const value = useMemo(
    () => ({
      evaluationVersion,
      getEvaluationsForThread,
      getRecommendationsForThread,
      setThreadEvaluation,
    }),
    [
      evaluationVersion,
      getEvaluationsForThread,
      getRecommendationsForThread,
      setThreadEvaluation,
    ],
  );

  return (
    <ThreadEvaluationContext.Provider value={value}>
      {children}
    </ThreadEvaluationContext.Provider>
  );
}

export function useThreadEvaluationContext(): ThreadEvaluationContextValue {
  const ctx = useContext(ThreadEvaluationContext);
  if (!ctx) {
    throw new Error(
      'useThreadEvaluationContext must be used within ThreadEvaluationProvider',
    );
  }
  return ctx;
}

/** Returns Map<messageId, score | 'good' | 'bad'> for the thread for use with getEmailStatus(..., aiEvaluationResults). */
export function useThreadEvaluations(
  threadId: string | null,
): Map<string, EvaluationValue> {
  const { getEvaluationsForThread } = useThreadEvaluationContext();
  return useMemo(
    () => getEvaluationsForThread(threadId),
    [getEvaluationsForThread, threadId],
  );
}

export function useSetThreadEvaluation() {
  const { setThreadEvaluation } = useThreadEvaluationContext();
  return setThreadEvaluation;
}

/** Returns recommendations for the thread's latest scored message (for StatusTag popover). */
export function useThreadRecommendations(threadId: string | null): string[] {
  const { getRecommendationsForThread } = useThreadEvaluationContext();
  return useMemo(
    () => getRecommendationsForThread(threadId),
    [getRecommendationsForThread, threadId],
  );
}
