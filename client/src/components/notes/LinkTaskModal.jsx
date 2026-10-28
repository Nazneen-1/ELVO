import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { useNotes } from '../../context/NoteContext.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { Search, CheckSquare, Plus, Link as LinkIcon, Check, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

export const LinkTaskModal = ({
  isOpen,
  onClose,
  noteId,
  alreadyLinkedIds = [],
}) => {
  const { linkTask } = useNotes();
  const { tasks } = useTasks();

  const [query, setQuery] = useState('');
  const [linkingId, setLinkingId] = useState(null);
  const [error, setError] = useState(null);

  const availableTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => {
      const matchesSearch = query
        ? t.title?.toLowerCase().includes(query.toLowerCase()) ||
          t.description?.toLowerCase().includes(query.toLowerCase())
        : true;
      return matchesSearch;
    });
  }, [tasks, query]);

  const handleLink = async (taskId) => {
    try {
      setLinkingId(taskId);
      setError(null);
      await linkTask(noteId, taskId);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to link task');
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link Existing Task" maxWidth="max-w-md">
      <div className="p-6 space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks to link..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
          />
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60 pr-1">
          {availableTasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 dark:text-zinc-500">
              No tasks found
            </div>
          ) : (
            availableTasks.map((task) => {
              const isLinked = alreadyLinkedIds.includes(task._id);
              const isBusy = linkingId === task._id;

              return (
                <div
                  key={task._id}
                  className="py-2.5 flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-zinc-200 truncate">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 dark:text-zinc-500">
                      <span className="capitalize">{task.status || 'To Do'}</span>
                      {task.priority && (
                        <>
                          <span>•</span>
                          <span>{task.priority}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {isLinked ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                      <Check className="w-3.5 h-3.5" />
                      Linked
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleLink(task._id)}
                      disabled={isBusy}
                      className="text-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Link
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
