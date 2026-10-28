import React, { useState, useMemo } from 'react';
import { useNotes } from '../context/NoteContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { NoteCard } from '../components/notes/NoteCard.jsx';
import { NoteEditorDrawer } from '../components/notes/NoteEditorDrawer.jsx';
import { ManageCollectionsModal } from '../components/notes/ManageCollectionsModal.jsx';
import { Button } from '../components/common/Button.jsx';
import { Modal } from '../components/common/Modal.jsx';

import {
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  FolderPlus,
  Pin,
  Star,
  Archive,
  Trash2,
  Tag,
  ArrowUpDown,
  FileText,
  AlertCircle,
  Briefcase,
  User,
  X,
  ShieldAlert,
} from 'lucide-react';
import { clsx } from 'clsx';

export const NotesPage = () => {
  const {
    notes,
    activeScope,
    setScope,
    activeView,
    setActiveView,
    activeCollectionId,
    setActiveCollectionId,
    searchQuery,
    setSearchQuery,
    activeTag,
    setActiveTag,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    collections,
    loading,
    error,
    createNote,
    archiveNote,
    restoreNote,
    trashNote,
    deleteNotePermanently,
    emptyTrash,
    togglePin,
    toggleFavorite,
    refreshNotes,
    activeNote,
    openNote,
    closeEditor,
    isEditorOpen,
  } = useNotes();

  const { workspaces } = useWorkspace();

  const [showManageCollections, setShowManageCollections] = useState(false);
  const [noteToDeletePermanently, setNoteToDeletePermanently] = useState(null);
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Extract all unique tags in current note set for filter chips
  const allTags = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => {
      if (Array.isArray(n.tags)) {
        n.tags.forEach((t) => set.add(t));
      }
    });
    return Array.from(set);
  }, [notes]);

  // Create new note
  const handleCreateNote = async () => {
    try {
      setCreating(true);
      const newNote = await createNote({
        title: 'Untitled Note',
        collectionId: activeCollectionId && activeCollectionId !== 'unfiled' ? activeCollectionId : null,
      });
      if (newNote && newNote._id) {
        openNote(newNote);
      }
    } catch (err) {
      console.error('Failed to create note:', err);
    } finally {
      setCreating(false);
    }
  };

  // View navigation tabs with Star instead of Heart
  const navTabs = [
    { id: 'all', label: 'All Notes', icon: FileText },
    { id: 'pinned', label: 'Pinned', icon: Pin },
    { id: 'favorites', label: 'Favorites', icon: Star },
    { id: 'archived', label: 'Archived', icon: Archive },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F5F5F5] dark:bg-[#1A1A1A] overflow-hidden">
      {/* Top Header */}
      <div className="px-6 py-5 border-b border-[#E0E0E0] dark:border-[#3A3A3A] bg-white dark:bg-[#2B2B2B] shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-elvo-noir dark:text-white">
              Notes
            </h1>
            <p className="text-xs text-elvo-iron dark:text-elvo-silver mt-0.5">
              Capture thoughts, organize collections, and link ideas directly to tasks.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Scope Switcher: Personal vs Workspace */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/80 text-xs">
              <button
                type="button"
                onClick={() => setScope('personal')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer',
                  activeScope === 'personal'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                )}
              >
                <User className="w-3.5 h-3.5" />
                <span>Personal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (workspaces && workspaces.length > 0) {
                    setScope('workspace', workspaces[0]._id);
                  } else {
                    setScope('workspace');
                  }
                }}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer',
                  activeScope !== 'personal'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                )}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Workspace</span>
              </button>
            </div>

            {/* Workspace selector dropdown when workspace scope active */}
            {activeScope !== 'personal' && workspaces && workspaces.length > 0 && (
              <select
                value={activeScope}
                onChange={(e) => setScope('workspace', e.target.value)}
                className="select-elvo px-3 py-1.5 text-xs font-medium"
              >
                {workspaces.map((ws) => (
                  <option key={ws._id} value={ws._id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            )}

            {/* New Note Button */}
            <Button
              variant="primary"
              onClick={handleCreateNote}
              disabled={creating}
              loading={creating}
              className="text-xs shrink-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Note
            </Button>
          </div>
        </div>

        {/* View Navigation Tabs */}
        <div className="flex items-center gap-2 mt-5 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-zinc-800 -mb-5 pb-3">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer',
                  isActive
                    ? 'bg-[#2B2B2B] text-white dark:bg-white dark:text-[#2B2B2B] shadow-sm font-semibold'
                    : 'text-[#565656] dark:text-[#B3B3B3] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#2B2B2B] dark:hover:text-white'
                )}
              >
                <Icon className={clsx('w-3.5 h-3.5', tab.id === 'favorites' && isActive && 'fill-current')} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="w-px h-4 bg-[#E0E0E0] dark:bg-[#3A3A3A] mx-1 shrink-0" />

          {/* Collections Pill Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={activeCollectionId || ''}
              onChange={(e) => setActiveCollectionId(e.target.value || null)}
              className={clsx(
                'select-elvo text-xs font-medium px-2.5 py-1.5 transition-all',
                activeCollectionId && 'border-[#2B2B2B] dark:border-white font-semibold'
              )}
            >
              <option value="">All Collections</option>
              <option value="unfiled">Unfiled Notes</option>
              {collections.map((c) => (
                <option key={c._id} value={c._id}>
                  📁 {c.name} ({c.noteCount || 0})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowManageCollections(true)}
              title="Manage Collections"
              className="p-1.5 rounded-lg text-[#848484] hover:text-[#2B2B2B] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="px-6 py-3.5 border-b border-[#E0E0E0] dark:border-[#3A3A3A] bg-white/50 dark:bg-[#2B2B2B]/50 backdrop-blur-sm shrink-0 flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#848484]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, preview text, or tags..."
            className="w-full pl-9 pr-8 py-1.5 rounded-xl text-xs bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-[#3A3A3A] text-[#2B2B2B] dark:text-[#E0E0E0] placeholder-[#848484] focus:outline-none focus:ring-1 focus:ring-[#565656] dark:focus:ring-[#B3B3B3] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#848484] hover:text-[#2B2B2B] dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View Options */}
        <div className="flex items-center gap-3">
          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#848484]" />
              <select
                value={activeTag || ''}
                onChange={(e) => setActiveTag(e.target.value || null)}
                className="select-elvo text-xs px-2 py-1"
              >
                <option value="">All Tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort By */}
          <div className="flex items-center gap-1 text-xs text-[#565656] dark:text-[#B3B3B3]">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="select-elvo text-xs font-medium px-2 py-1"
            >
              <option value="updatedAt_desc">Last Updated</option>
              <option value="createdAt_desc">Newest First</option>
              <option value="createdAt_asc">Oldest First</option>
              <option value="title_asc">Title (A-Z)</option>
            </select>
          </div>

          {/* Grid / List Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/80">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={clsx(
                'p-1.5 rounded-md transition-colors cursor-pointer',
                viewMode === 'grid'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List View"
              className={clsx(
                'p-1.5 rounded-md transition-colors cursor-pointer',
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200'
              )}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Empty Trash Button (when viewing Trash) */}
          {activeView === 'trash' && notes.length > 0 && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => setShowEmptyTrashConfirm(true)}
              className="text-xs"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Empty Trash
            </Button>
          )}
        </div>
      </div>

      {/* Notes Library View Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-[#848484]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-[#565656] dark:border-[#B3B3B3] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Loading notes...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="max-w-md mx-auto my-12 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex flex-col items-center text-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            <div>
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
                Failed to load notes
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={refreshNotes}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty States */}
        {!loading && !error && notes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-[#E0E0E0]/50 dark:bg-[#2B2B2B] flex items-center justify-center text-[#848484] mb-4">
              {activeView === 'trash' ? (
                <Trash2 className="w-7 h-7" />
              ) : activeView === 'archived' ? (
                <Archive className="w-7 h-7" />
              ) : searchQuery ? (
                <Search className="w-7 h-7" />
              ) : (
                <FileText className="w-7 h-7" />
              )}
            </div>

            <h3 className="text-base font-semibold text-[#2B2B2B] dark:text-white">
              {searchQuery
                ? 'No matching notes found'
                : activeView === 'trash'
                ? 'Trash is empty'
                : activeView === 'archived'
                ? 'No archived notes'
                : activeView === 'pinned'
                ? 'No pinned notes'
                : activeView === 'favorites'
                ? 'No favorite notes'
                : 'No notes here yet'}
            </h3>

            <p className="text-xs text-[#565656] dark:text-[#B3B3B3] mt-1 max-w-xs">
              {searchQuery
                ? `No notes matched "${searchQuery}". Try different keywords or clear filters.`
                : activeView === 'trash'
                ? 'Deleted notes stay in Trash until permanently removed.'
                : activeView === 'archived'
                ? 'Archive notes to tidy your active workspace without deleting them.'
                : 'Capture your thoughts, plan tasks, or draft documentation.'}
            </p>

            {activeView !== 'trash' && activeView !== 'archived' && !searchQuery && (
              <Button
                variant="primary"
                onClick={handleCreateNote}
                className="mt-5 text-xs"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create your first note
              </Button>
            )}
          </div>
        )}

        {/* Notes Grid / List */}
        {!loading && !error && notes.length > 0 && (
          <div
            className={clsx(
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'flex flex-col gap-2.5 max-w-4xl mx-auto'
            )}
          >
            {notes.map((note) => (
              <NoteCard
                key={note._id}
                note={note}
                viewMode={viewMode}
                onOpen={(n) => openNote(n)}
                onTogglePin={(id, currentVal) => togglePin(id, currentVal)}
                onToggleFavorite={(id, currentVal) => toggleFavorite(id, currentVal)}
                onArchive={(id) => archiveNote(id)}
                onRestore={(id) => restoreNote(id)}
                onTrash={(id) => trashNote(id)}
                onDeletePermanently={() => setNoteToDeletePermanently(note)}
                isTrashView={activeView === 'trash'}
                isArchivedView={activeView === 'archived'}
              />
            ))}
          </div>
        )}
      </div>

      {/* TipTap Rich Text Note Editor Drawer */}
      <NoteEditorDrawer
        isOpen={isEditorOpen || Boolean(activeNote)}
        onClose={closeEditor}
        note={activeNote}
      />

      {/* Manage Collections Modal */}
      <ManageCollectionsModal
        isOpen={showManageCollections}
        onClose={() => setShowManageCollections(false)}
      />

      {/* Permanent Delete Note Confirmation Modal */}
      {noteToDeletePermanently && (
        <Modal
          isOpen={Boolean(noteToDeletePermanently)}
          onClose={() => setNoteToDeletePermanently(null)}
          title="Permanently Delete Note"
          maxWidth="max-w-md"
        >
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Permanently delete "{noteToDeletePermanently.title}"?
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  This action cannot be undone. All note content and task links on this note will be permanently removed.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setNoteToDeletePermanently(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await deleteNotePermanently(noteToDeletePermanently._id);
                  setNoteToDeletePermanently(null);
                }}
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Empty Trash Confirmation Modal */}
      {showEmptyTrashConfirm && (
        <Modal
          isOpen={showEmptyTrashConfirm}
          onClose={() => setShowEmptyTrashConfirm(false)}
          title="Empty Trash"
          maxWidth="max-w-md"
        >
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Empty all notes in Trash?
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  All notes currently in Trash for this scope will be permanently destroyed. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowEmptyTrashConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await emptyTrash();
                  setShowEmptyTrashConfirm(false);
                }}
              >
                Empty Trash
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
