import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

import { useNotes } from '../../context/NoteContext.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { CreateTaskFromSelectionModal } from './CreateTaskFromSelectionModal.jsx';
import { LinkTaskModal } from './LinkTaskModal.jsx';
import { Button } from '../common/Button.jsx';

import {
  X,
  Pin,
  Star,
  Archive,
  Trash2,
  Tag,
  Folder,
  CheckSquare,
  Link as LinkIcon,
  Unlink,
  ExternalLink,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare2,
  Quote,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';

export const NoteEditorDrawer = ({ isOpen, onClose, note }) => {
  const {
    saveNoteContent,
    saveStatus,
    retryLastSave,
    togglePin,
    toggleFavorite,
    archiveNote,
    trashNote,
    setNoteCollection,
    setNoteTags,
    unlinkTask,
    collections,
  } = useNotes();

  const [title, setTitle] = useState('');
  const titleRef = useRef('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [collectionId, setCollectionId] = useState(null);
  const [hasSelectedText, setHasSelectedText] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showTaskFromSelectionModal, setShowTaskFromSelectionModal] = useState(false);
  const [showLinkTaskModal, setShowLinkTaskModal] = useState(false);

  // Keep titleRef synchronized
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  // Initialize form state from note prop
  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      titleRef.current = note.title || '';
      setTags(note.tags || []);
      setCollectionId(note.collectionId?._id || note.collectionId || null);
    }
  }, [note]);

  // TipTap editor initialization
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 dark:text-indigo-400 underline underline-offset-2 hover:text-indigo-800',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: note?.content || { type: 'doc', content: [] },
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[350px] text-slate-800 dark:text-zinc-200 text-sm leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      if (!note?._id) return;
      const json = editor.getJSON();
      const plainText = editor.getText();
      saveNoteContent(note._id, {
        title: titleRef.current || note.title || 'Untitled Note',
        content: json,
        plainTextPreview: plainText.slice(0, 300),
      });
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ');
        if (text && text.trim().length > 0) {
          setHasSelectedText(true);
          setSelectedText(text.trim());
          return;
        }
      }
      setHasSelectedText(false);
      setSelectedText('');
    },
  });

  // When active note changes, update editor content
  useEffect(() => {
    if (editor && note) {
      const currentJson = JSON.stringify(editor.getJSON());
      const noteJson = typeof note.content === 'object' ? JSON.stringify(note.content) : null;
      if (noteJson && noteJson !== currentJson) {
        editor.commands.setContent(note.content);
      } else if (!noteJson && note.content) {
        editor.commands.setContent(note.content);
      }
    }
  }, [note?._id, editor]);

  // Title update with autosave
  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!note?._id || !editor) return;
    saveNoteContent(note._id, {
      title: newTitle,
      content: editor.getJSON(),
      plainTextPreview: editor.getText().slice(0, 300),
    });
  };

  // Add tag
  const handleAddTag = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, '');
      if (clean && !tags.includes(clean)) {
        const next = [...tags, clean];
        setTags(next);
        setNoteTags(note._id, next);
      }
      setTagInput('');
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove) => {
    const next = tags.filter((t) => t !== tagToRemove);
    setTags(next);
    setNoteTags(note._id, next);
  };

  // Change collection
  const handleCollectionChange = (e) => {
    const val = e.target.value || null;
    setCollectionId(val);
    setNoteCollection(note._id, val);
  };

  // Set link URL
  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!isOpen || !note) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-zinc-800">
        {/* Top Header / Meta Toolbar */}
        <div className="px-6 py-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3">
          {/* Autosave Indicator */}
          <div className="flex items-center gap-2 text-xs">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckSquare2 className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
            {saveStatus === 'failed' && (
              <div className="flex items-center gap-2">
                <span className="text-rose-600 dark:text-rose-400 font-medium">
                  Save failed
                </span>
                <button
                  type="button"
                  onClick={retryLastSave}
                  className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold text-[11px] hover:underline"
                >
                  Retry
                </button>
              </div>
            )}
            {saveStatus === 'idle' && (
              <span className="text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {note.updatedAt ? new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ready'}
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => togglePin(note._id)}
              title={note.isPinned ? 'Unpin note' : 'Pin note to top'}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                note.isPinned
                  ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              )}
            >
              <Pin className={clsx('w-4 h-4', note.isPinned && 'fill-amber-600 dark:fill-amber-400')} />
            </button>

            <button
              type="button"
              onClick={() => toggleFavorite(note._id, note.isFavorite)}
              title={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                note.isFavorite
                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                  : 'text-[#848484] hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/5'
              )}
            >
              <Star className={clsx('w-4 h-4', note.isFavorite ? 'fill-amber-500 text-amber-500' : 'text-current')} />
            </button>

            <button
              type="button"
              onClick={() => {
                archiveNote(note._id);
                onClose();
              }}
              title="Archive note"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Archive className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                trashNote(note._id);
                onClose();
              }}
              title="Move to Trash"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-slate-200 dark:bg-zinc-800 mx-1" />

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Scope & Collection Bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Scope badge */}
            <span className="px-2.5 py-1 rounded-lg font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
              {note.workspaceId ? 'Workspace Note' : 'Personal Note'}
            </span>

            {/* Collection selector */}
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
              <Folder className="w-3.5 h-3.5" />
              <select
                value={collectionId || ''}
                onChange={handleCollectionChange}
                className="select-elvo px-2.5 py-1 text-xs"
              >
                <option value="">Unfiled Collection</option>
                {collections.map((col) => (
                  <option key={col._id} value={col._id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title Input */}
          <div>
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="Note title..."
              className="w-full text-2xl font-bold bg-transparent border-none text-slate-900 dark:text-zinc-100 placeholder-slate-300 dark:placeholder-zinc-600 focus:outline-none leading-snug"
            />
          </div>

          {/* Rich-Text Formatting Toolbar */}
          {editor && (
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 p-1.5 rounded-xl bg-slate-50 dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700 backdrop-blur-md shadow-sm">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={clsx(
                  'p-1.5 rounded-lg text-xs font-semibold transition-colors',
                  editor.isActive('bold')
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                )}
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={clsx(
                  'p-1.5 rounded-lg text-xs font-semibold transition-colors',
                  editor.isActive('italic')
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                )}
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={clsx(
                  'p-1.5 rounded-lg text-xs font-semibold transition-colors',
                  editor.isActive('underline')
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                )}
                title="Underline"
              >
                <UnderlineIcon className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-0.5" />

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={clsx(
                  'p-1.5 rounded-lg text-xs font-semibold transition-colors',
                  editor.isActive('heading', { level: 1 })
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                )}
                title="Heading 1"
              >
                <Heading1 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={clsx(
                  'p-1.5 rounded-lg text-xs font-semibold transition-colors',
                  editor.isActive('heading', { level: 2 })
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                )}
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={clsx(
                  'p-1.5 rounded-lg text-xs font-semibold transition-colors',
                  editor.isActive('heading', { level: 3 })
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                )}
                title="Heading 3"
              >
                <Heading3 className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-0.5" />

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={clsx(
                  'p-1.5 rounded-lg text-xs font-semibold transition-colors',
                  editor.isActive('bulletList')
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                )}
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={clsx(
                  'p-1.5 rounded-lg text-xs font-semibold transition-colors',
                  editor.isActive('orderedList')
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                )}
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={clsx(
                  'p-1.5 rounded-lg text-xs font-semibold transition-colors',
                  editor.isActive('taskList')
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                )}
                title="Checklist"
              >
                <CheckSquare2 className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-0.5" />

              <button
                type="button"
                onClick={setLink}
                className={clsx(
                  'p-1.5 rounded-lg text-xs font-semibold transition-colors',
                  editor.isActive('link')
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                )}
                title="Link"
              >
                <LinkIcon className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={clsx(
                  'p-1.5 rounded-lg text-xs font-semibold transition-colors',
                  editor.isActive('blockquote')
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/60 dark:hover:bg-zinc-700'
                )}
                title="Quote"
              >
                <Quote className="w-4 h-4" />
              </button>

              {/* Contextual Action: Create Task from Selection */}
              {hasSelectedText && (
                <div className="ml-auto flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowTaskFromSelectionModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm animate-in fade-in zoom-in-95"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Create Task from Selection</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TipTap Editor Surface */}
          <div className="min-h-[300px] border-b border-slate-100 dark:border-zinc-800/80 pb-6">
            <EditorContent editor={editor} />
          </div>

          {/* Tags Section */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              <span>Tags</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 group"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-slate-400 hover:text-rose-500 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Add tag (Press Enter)..."
                className="px-2.5 py-1 rounded-lg text-xs bg-transparent border border-dashed border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:border-slate-500"
              />
            </div>
          </div>

          {/* Linked Tasks Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Linked Tasks ({note.linkedTasks?.length || 0})</span>
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowLinkTaskModal(true)}
                className="text-xs py-1"
              >
                <LinkIcon className="w-3.5 h-3.5 mr-1" />
                Link Task
              </Button>
            </div>

            {note.linkedTasks?.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 italic">
                No tasks linked yet. Link existing tasks or highlight text above to create one.
              </p>
            ) : (
              <div className="space-y-2">
                {note.linkedTasks.map((t) => {
                  const taskId = typeof t === 'object' ? t._id : t;
                  const taskTitle = typeof t === 'object' ? t.title : 'Task ' + taskId;
                  const taskStatus = typeof t === 'object' ? t.status : null;
                  const taskPriority = typeof t === 'object' ? t.priority : null;

                  return (
                    <div
                      key={taskId}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <CheckSquare className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 dark:text-zinc-200 truncate">
                            {taskTitle}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-zinc-500">
                            {taskStatus && <span className="capitalize">{taskStatus}</span>}
                            {taskPriority && (
                              <>
                                <span>•</span>
                                <span>{taskPriority}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => unlinkTask(note._id, taskId)}
                        title="Unlink task"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
          <span className="text-[11px] text-slate-400 dark:text-zinc-500">
            {note.plainTextPreview?.length || 0} characters
          </span>
          <Button variant="ghost" onClick={onClose} size="sm">
            Close Note
          </Button>
        </div>
      </div>

      {/* Create Task from Selection Modal */}
      <CreateTaskFromSelectionModal
        isOpen={showTaskFromSelectionModal}
        onClose={() => setShowTaskFromSelectionModal(false)}
        initialTitle={selectedText}
        noteId={note._id}
      />

      {/* Link Task Modal */}
      <LinkTaskModal
        isOpen={showLinkTaskModal}
        onClose={() => setShowLinkTaskModal(false)}
        noteId={note._id}
        alreadyLinkedIds={(note.linkedTasks || []).map((t) => (typeof t === 'object' ? t._id : t))}
      />
    </div>
  );
};
