import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { noteService } from '../services/noteService.js';
import { useAuth } from './AuthContext.jsx';
import { useWorkspace } from './WorkspaceContext.jsx';

const NoteContext = createContext();

export const NoteProvider = ({ children }) => {
  const { user } = useAuth();
  const { activeWorkspaceId: currentWorkspaceId, workspaces } = useWorkspace();

  const [notes, setNotes] = useState([]);
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeNote, setActiveNote] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Active Scope: 'personal' or specific workspace ID
  const [activeScope, setActiveScope] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('elvo_notes_scope');
        if (saved) return saved;
      }
    } catch {}
    return currentWorkspaceId && currentWorkspaceId !== 'my-work' ? currentWorkspaceId : 'personal';
  });

  const setScope = useCallback((type, wsId) => {
    let nextScope = 'personal';
    if (type === 'workspace') {
      nextScope = wsId || (workspaces && workspaces.length > 0 ? workspaces[0]._id : 'personal');
    }

    setActiveScope(nextScope);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('elvo_notes_scope', nextScope);
      }
    } catch {}

    // Immediately clear state to prevent stale note flash while new scope loads
    setNotes([]);
    setCollections([]);
    setActiveCollectionIdState(null);
    setActiveTag(null);
  }, [workspaces]);

  // Sync with WorkspaceContext if user switches workspace in sidebar and is on a workspace page
  useEffect(() => {
    if (currentWorkspaceId && currentWorkspaceId !== 'my-work') {
      // If user had workspace scope selected or switched workspace, sync scope
      if (activeScope !== 'personal') {
        setActiveScope(currentWorkspaceId);
      }
    }
  }, [currentWorkspaceId, activeScope]);

  // Active View Tab: 'all' | 'pinned' | 'favorites' | 'archived' | 'trash'
  const [activeView, setActiveViewState] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('elvo_notes_view');
        if (['all', 'pinned', 'favorites', 'archived', 'trash'].includes(saved)) {
          return saved;
        }
      }
    } catch {}
    return 'all';
  });

  const setActiveView = useCallback((v) => {
    setActiveViewState(v);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('elvo_notes_view', v);
      }
    } catch {}
  }, []);

  // Collection Filter
  const [activeCollectionId, setActiveCollectionIdState] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem('elvo_notes_collection') || null;
      }
    } catch {}
    return null;
  });

  const setActiveCollectionId = useCallback((cId) => {
    setActiveCollectionIdState(cId);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (cId) {
          window.localStorage.setItem('elvo_notes_collection', cId);
        } else {
          window.localStorage.removeItem('elvo_notes_collection');
        }
      }
    } catch {}
  }, []);

  const [activeTag, setActiveTag] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sort State
  const [sortByField, setSortByField] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const sortBy = `${sortByField}_${sortOrder}`;
  const setSortBy = useCallback((val) => {
    if (val && val.includes('_')) {
      const [field, order] = val.split('_');
      setSortByField(field);
      setSortOrder(order);
    } else if (val) {
      setSortByField(val);
    }
  }, []);

  // View Mode: 'grid' or 'list'
  const [viewMode, setViewModeState] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem('elvo_notes_view_mode') || 'grid';
      }
    } catch {}
    return 'grid';
  });

  const setViewMode = useCallback((mode) => {
    setViewModeState(mode);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('elvo_notes_view_mode', mode);
      }
    } catch {}
  }, []);

  // Autosave status: 'idle' | 'saving' | 'saved' | 'failed'
  const [autosaveStatus, setAutosaveStatus] = useState('idle');
  const autosaveTimerRef = useRef(null);
  const pendingUpdatesRef = useRef({});
  const saveReqIdRef = useRef(0);

  // Fetch Collections
  const fetchCollections = useCallback(async () => {
    if (!user) return;
    try {
      const params = {
        workspaceId: activeScope === 'personal' ? 'personal' : activeScope,
      };
      const response = await noteService.getCollections(params);
      if (response.success) {
        setCollections(response.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch note collections:', err);
    }
  }, [user, activeScope]);

  // Fetch Notes
  const fetchNotes = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        workspaceId: activeScope === 'personal' ? 'personal' : activeScope,
        view: activeView,
        sort: sortByField,
        order: sortOrder,
      };
      if (activeCollectionId) {
        params.collectionId = activeCollectionId;
      }
      if (activeTag) {
        params.tag = activeTag;
      }
      if (searchQuery && searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const response = await noteService.getNotes(params);
      if (response.success) {
        setNotes(response.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      setError(err.response?.data?.message || 'Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, [user, activeScope, activeView, activeCollectionId, activeTag, searchQuery, sortByField, sortOrder]);

  // Refetch when dependencies change
  useEffect(() => {
    if (user) {
      fetchNotes();
      fetchCollections();
    } else {
      setNotes([]);
      setCollections([]);
      setActiveNote(null);
      setIsEditorOpen(false);
    }
  }, [user, fetchNotes, fetchCollections]);

  // Open note in editor
  const openNote = useCallback(async (noteOrId) => {
    if (!noteOrId) return;
    if (typeof noteOrId === 'string') {
      try {
        const response = await noteService.getNoteById(noteOrId);
        if (response.success) {
          setActiveNote(response.data);
          setIsEditorOpen(true);
          setAutosaveStatus('saved');
        }
      } catch (err) {
        console.error('Failed to load note details:', err);
      }
    } else {
      setActiveNote(noteOrId);
      setIsEditorOpen(true);
      setAutosaveStatus('saved');
    }
  }, []);

  const closeEditor = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setIsEditorOpen(false);
    setActiveNote(null);
    setAutosaveStatus('idle');
    pendingUpdatesRef.current = {};
    fetchNotes();
  }, [fetchNotes]);

  // Create Note
  const createNote = useCallback(
    async (initialData = {}) => {
      try {
        const payload = {
          title: initialData.title || 'Untitled Note',
          content: initialData.content || { type: 'doc', content: [] },
          plainTextPreview: initialData.plainTextPreview || '',
          workspaceId: activeScope === 'personal' ? null : activeScope,
          collectionId: initialData.collectionId || (activeCollectionId !== 'unfiled' ? activeCollectionId : null),
          tags: initialData.tags || (activeTag ? [activeTag] : []),
          isPinned: Boolean(initialData.isPinned),
          isFavorite: Boolean(initialData.isFavorite),
        };

        const response = await noteService.createNote(payload);
        if (response.success && response.data) {
          const newNote = response.data;
          setNotes((prev) => {
            const exists = prev.some((n) => n._id === newNote._id);
            return exists ? prev : [newNote, ...prev];
          });
          setActiveNote(newNote);
          setIsEditorOpen(true);
          setAutosaveStatus('saved');
          return newNote;
        }
        return null;
      } catch (err) {
        console.error('Failed to create note:', err);
        throw err;
      }
    },
    [activeScope, activeCollectionId, activeTag]
  );

  // Debounced Autosave for Note Content
  const saveNoteContent = useCallback(
    async (noteId, updates) => {
      if (!noteId) return;

      // Optimistically update note in activeNote and notes state
      setActiveNote((prev) => (prev && prev._id === noteId ? { ...prev, ...updates } : prev));
      setNotes((prev) => prev.map((n) => (n._id === noteId ? { ...n, ...updates } : n)));

      pendingUpdatesRef.current = {
        ...pendingUpdatesRef.current,
        ...updates,
      };

      setAutosaveStatus('saving');

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      return new Promise((resolve) => {
        autosaveTimerRef.current = setTimeout(async () => {
          const reqId = ++saveReqIdRef.current;
          try {
            const dataToSave = { ...pendingUpdatesRef.current };
            const response = await noteService.updateNote(noteId, dataToSave);
            // Ignore response if newer request dispatched
            if (reqId === saveReqIdRef.current) {
              if (response.success) {
                setAutosaveStatus('saved');
                setActiveNote((prev) => (prev && prev._id === noteId ? response.data : prev));
                setNotes((prev) => prev.map((n) => (n._id === noteId ? response.data : n)));
                pendingUpdatesRef.current = {};
                resolve({ success: true, data: response.data });
              } else {
                setAutosaveStatus('failed');
                resolve({ success: false, error: 'Update failed' });
              }
            }
          } catch (err) {
            if (reqId === saveReqIdRef.current) {
              console.error('Autosave error:', err);
              setAutosaveStatus('failed');
              resolve({ success: false, error: err.message });
            }
          }
        }, 500);
      });
    },
    []
  );

  const retryLastSave = useCallback(async () => {
    if (!activeNote?._id) return;
    const updates = { ...pendingUpdatesRef.current };
    return saveNoteContent(activeNote._id, updates);
  }, [activeNote, saveNoteContent]);

  const setNoteCollection = useCallback(async (noteId, collectionId) => {
    try {
      const response = await noteService.updateNote(noteId, { collectionId });
      if (response.success) {
        setActiveNote((prev) => (prev && prev._id === noteId ? response.data : prev));
        setNotes((prev) => prev.map((n) => (n._id === noteId ? response.data : n)));
        fetchCollections();
      }
    } catch (err) {
      console.error('Failed to set note collection:', err);
    }
  }, [fetchCollections]);

  const setNoteTags = useCallback(async (noteId, tags) => {
    try {
      const response = await noteService.updateNote(noteId, { tags });
      if (response.success) {
        setActiveNote((prev) => (prev && prev._id === noteId ? response.data : prev));
        setNotes((prev) => prev.map((n) => (n._id === noteId ? response.data : n)));
      }
    } catch (err) {
      console.error('Failed to set note tags:', err);
    }
  }, []);

  // Toggle Pin
  const togglePin = useCallback(async (noteId, currentVal) => {
    try {
      const newVal = !currentVal;
      setNotes((prev) => prev.map((n) => (n._id === noteId ? { ...n, isPinned: newVal } : n)));
      if (activeNote && activeNote._id === noteId) {
        setActiveNote((prev) => ({ ...prev, isPinned: newVal }));
      }
      await noteService.updateNote(noteId, { isPinned: newVal });
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      fetchNotes();
    }
  }, [activeNote, fetchNotes]);

  // Toggle Favorite
  const toggleFavorite = useCallback(async (noteId, currentVal) => {
    try {
      const newVal = !currentVal;
      setNotes((prev) => prev.map((n) => (n._id === noteId ? { ...n, isFavorite: newVal } : n)));
      if (activeNote && activeNote._id === noteId) {
        setActiveNote((prev) => ({ ...prev, isFavorite: newVal }));
      }
      await noteService.updateNote(noteId, { isFavorite: newVal });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      fetchNotes();
    }
  }, [activeNote, fetchNotes]);

  // Archive Note
  const archiveNote = useCallback(async (noteId) => {
    try {
      await noteService.archiveNote(noteId);
      setNotes((prev) => prev.filter((n) => n._id !== noteId));
      if (activeNote && activeNote._id === noteId) {
        closeEditor();
      }
    } catch (err) {
      console.error('Failed to archive note:', err);
    }
  }, [activeNote, closeEditor]);

  // Restore Note
  const restoreNote = useCallback(async (noteId) => {
    try {
      await noteService.restoreNote(noteId);
      setNotes((prev) => prev.filter((n) => n._id !== noteId));
      if (activeNote && activeNote._id === noteId) {
        closeEditor();
      }
      fetchNotes();
    } catch (err) {
      console.error('Failed to restore note:', err);
    }
  }, [activeNote, closeEditor, fetchNotes]);

  // Trash Note
  const trashNote = useCallback(async (noteId) => {
    try {
      await noteService.trashNote(noteId);
      setNotes((prev) => prev.filter((n) => n._id !== noteId));
      if (activeNote && activeNote._id === noteId) {
        closeEditor();
      }
    } catch (err) {
      console.error('Failed to trash note:', err);
    }
  }, [activeNote, closeEditor]);

  // Permanent Delete
  const deleteNotePermanently = useCallback(async (noteId) => {
    try {
      await noteService.deleteNotePermanently(noteId);
      setNotes((prev) => prev.filter((n) => n._id !== noteId));
      if (activeNote && activeNote._id === noteId) {
        closeEditor();
      }
    } catch (err) {
      console.error('Failed to permanently delete note:', err);
    }
  }, [activeNote, closeEditor]);

  // Empty Trash
  const emptyTrash = useCallback(async () => {
    try {
      const params = {
        workspaceId: activeScope === 'personal' ? 'personal' : activeScope,
      };
      const response = await noteService.emptyTrash(params);
      if (response.success) {
        setNotes([]);
      }
      return response;
    } catch (err) {
      console.error('Failed to empty trash:', err);
      throw err;
    }
  }, [activeScope]);

  // Link Task
  const linkTask = useCallback(async (noteId, taskId) => {
    try {
      const response = await noteService.linkTask(noteId, taskId);
      if (response.success) {
        const updated = response.data;
        setActiveNote(updated);
        setNotes((prev) => prev.map((n) => (n._id === noteId ? updated : n)));
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Failed to link task' };
    }
  }, []);

  // Unlink Task
  const unlinkTask = useCallback(async (noteId, taskId) => {
    try {
      const response = await noteService.unlinkTask(noteId, taskId);
      if (response.success) {
        const updated = response.data;
        setActiveNote(updated);
        setNotes((prev) => prev.map((n) => (n._id === noteId ? updated : n)));
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Failed to unlink task' };
    }
  }, []);

  // Create Task from Selection
  const createTaskFromSelection = useCallback(async (noteId, taskData) => {
    try {
      const response = await noteService.createTaskFromSelection(noteId, taskData);
      if (response.success) {
        const { task, note: updatedNote } = response.data;
        setActiveNote(updatedNote);
        setNotes((prev) => prev.map((n) => (n._id === noteId ? updatedNote : n)));
        return { success: true, data: task };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Failed to create task from selection' };
    }
  }, []);

  // Collection CRUD
  const createCollection = useCallback(async (data) => {
    try {
      const payload = {
        ...data,
        workspaceId: activeScope === 'personal' ? null : activeScope,
      };
      const response = await noteService.createCollection(payload);
      if (response.success) {
        setCollections((prev) => [...prev, response.data]);
        return { success: true, data: response.data };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Failed to create collection' };
    }
  }, [activeScope]);

  const updateCollection = useCallback(async (id, data) => {
    try {
      const response = await noteService.updateCollection(id, data);
      if (response.success) {
        setCollections((prev) => prev.map((c) => (c._id === id ? response.data : c)));
        return { success: true, data: response.data };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Failed to update collection' };
    }
  }, []);

  const deleteCollection = useCallback(async (id) => {
    try {
      const response = await noteService.deleteCollection(id);
      if (response.success) {
        setCollections((prev) => prev.filter((c) => c._id !== id));
        if (activeCollectionId === id) {
          setActiveCollectionIdState(null);
        }
        fetchNotes();
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Failed to delete collection' };
    }
  }, [activeCollectionId, fetchNotes]);

  return (
    <NoteContext.Provider
      value={{
        notes,
        collections,
        isLoading,
        loading: isLoading,
        error,
        activeScope,
        setActiveScope,
        setScope,
        activeWorkspaceId: activeScope === 'personal' ? null : activeScope,
        activeView,
        setActiveView,
        activeCollectionId,
        setActiveCollectionId,
        selectedCollectionId: activeCollectionId,
        setSelectedCollectionId: setActiveCollectionId,
        activeTag,
        setActiveTag,
        selectedTag: activeTag,
        setSelectedTag: setActiveTag,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
        viewMode,
        setViewMode,
        activeNote,
        setActiveNote,
        isEditorOpen,
        openNote,
        closeEditor,
        createNote,
        saveNoteContent,
        saveStatus: autosaveStatus,
        retryLastSave,
        setNoteCollection,
        setNoteTags,
        updateActiveNoteContent: saveNoteContent,
        saveNow: retryLastSave,
        autosaveStatus,
        togglePin,
        toggleFavorite,
        archiveNote,
        restoreNote,
        trashNote,
        deleteNotePermanently,
        emptyTrash,
        linkTask,
        unlinkTask,
        createTaskFromSelection,
        createCollection,
        updateCollection,
        deleteCollection,
        fetchNotes,
        refreshNotes: fetchNotes,
        fetchCollections,
        workspaces,
      }}
    >
      {children}
    </NoteContext.Provider>
  );
};

export const useNotes = () => {
  const context = useContext(NoteContext);
  if (!context) {
    throw new Error('useNotes must be used within a NoteProvider');
  }
  return context;
};
