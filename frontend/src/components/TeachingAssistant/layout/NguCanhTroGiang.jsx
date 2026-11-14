import { createContext, useContext, useMemo, useState } from 'react';
import { assistantData } from '../data/duLieuTroGiang';
import { useAsyncData } from '../components/shared/DungChung';

const AssistantContext = createContext(null);
const EMPTY_WORKSPACE = {
  staffId: null,
  classes: [],
  periods: [],
  grants: [],
  requests: [],
  submissions: [],
};

export function AssistantProvider({ children: content }) {
  const {
    data: loadedData,
    loading,
    error: loadError,
    reload: reloadData,
  } = useAsyncData(() => assistantData.getWorkspace());
  const data = useMemo(() => ({ ...EMPTY_WORKSPACE, ...loadedData }), [loadedData]);
  const [query, setQuery] = useState('');

  const context = useMemo(
    () => ({ data, reloadData, loading, loadError, query, setQuery }),
    [data, reloadData, loading, loadError, query]
  );
  return <AssistantContext.Provider value={context}>{content}</AssistantContext.Provider>;
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error('useAssistant must be used within AssistantProvider.');
  return context;
}
