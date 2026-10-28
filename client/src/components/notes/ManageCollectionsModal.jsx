import React, { useState } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { useNotes } from '../../context/NoteContext.jsx';
import { Folder, Plus, Edit2, Trash2, Check, AlertCircle, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';

const COLOR_OPTIONS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Rose
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
];

export const ManageCollectionsModal = ({ isOpen, onClose }) => {
  const { collections, createCollection, updateCollection, deleteCollection } = useNotes();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [deletingCollection, setDeletingCollection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setLoading(true);
      setError(null);
      await createCollection({ name: newName.trim(), color: newColor });
      setNewName('');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create collection');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (col) => {
    setEditingId(col._id);
    setEditName(col.name);
  };

  const handleSaveEdit = async (id) => {
    if (!editName.trim()) return;
    try {
      setLoading(true);
      setError(null);
      await updateCollection(id, { name: editName.trim() });
      setEditingId(null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update collection');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCollection) return;
    try {
      setLoading(true);
      setError(null);
      await deleteCollection(deletingCollection._id);
      setDeletingCollection(null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to delete collection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Collections" maxWidth="max-w-md">
      <div className="p-6 space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Create new collection */}
        <form onSubmit={handleCreate} className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Create Collection
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Project Specs, Research, Meeting Notes"
              className="flex-1 px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
            <Button type="submit" variant="primary" disabled={loading || !newName.trim()} className="shrink-0">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-slate-400 dark:text-zinc-500">Color:</span>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                style={{ backgroundColor: c }}
                className={clsx(
                  'w-5 h-5 rounded-full transition-all',
                  newColor === c ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110' : 'opacity-80 hover:opacity-100'
                )}
              />
            ))}
          </div>
        </form>

        {/* Existing collections */}
        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
            Your Collections
          </h4>

          {collections.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-zinc-500 text-center py-4">
              No collections yet. Organize your notes by adding one above.
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60 pr-1">
              {collections.map((col) => {
                const isEditing = editingId === col._id;
                return (
                  <div key={col._id} className="py-2 flex items-center justify-between gap-2 group">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: col.color || '#6366F1' }}
                      />

                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 text-slate-900 dark:text-zinc-100 focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(col._id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-slate-800 dark:text-zinc-200 truncate">
                            {col.name}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-zinc-500">
                            ({col.noteCount || 0})
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveEdit(col._id)}
                          disabled={loading}
                          className="p-1.5"
                        >
                          <Check className="w-4 h-4 text-emerald-600" />
                        </Button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(col)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeletingCollection(col)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirmation alert for safe deletion */}
        {deletingCollection && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-3">
            <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Delete "{deletingCollection.name}"?</p>
                <p className="mt-0.5 text-amber-700/90 dark:text-amber-400/90">
                  Notes inside this collection will <strong>NOT</strong> be deleted. They will safely be moved to unfiled.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeletingCollection(null)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={handleConfirmDelete}
                loading={loading}
              >
                Delete Collection
              </Button>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
