import React from 'react';
import {
  Pin,
  Star,
  CheckSquare,
  Folder,
  Tag,
  Clock,
  MoreVertical,
  Archive,
  RotateCcw,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { clsx } from 'clsx';

export const NoteCard = ({
  note,
  viewMode = 'grid',
  onOpen,
  onTogglePin,
  onToggleFavorite,
  onArchive,
  onRestore,
  onTrash,
  onDeletePermanently,
  isTrashView = false,
  isArchivedView = false,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const formattedDate = React.useMemo(() => {
    try {
      const d = note.updatedAt ? new Date(note.updatedAt) : new Date();
      return formatDistanceToNow(d, { addSuffix: true });
    } catch {
      return '';
    }
  }, [note.updatedAt]);

  const linkedTaskCount = Array.isArray(note.linkedTasks) ? note.linkedTasks.length : 0;

  // -------------------------------------------------------------
  // LIST VIEW ROW
  // -------------------------------------------------------------
  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onOpen(note)}
        className={clsx(
          'group flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border transition-all duration-150 cursor-pointer',
          'bg-white dark:bg-[#2B2B2B] border-[#E0E0E0] dark:border-[#3A3A3A]',
          'hover:border-elvo-silver dark:hover:border-elvo-fog hover:shadow-subtle',
          note.isPinned && !isTrashView && !isArchivedView && 'border-l-4 border-l-indigo-600 dark:border-l-indigo-400'
        )}
      >
        {/* Left: Title & Preview */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {!isTrashView && !isArchivedView && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(note._id, note.isPinned);
              }}
              title={note.isPinned ? 'Unpin note' : 'Pin note to top'}
              className={clsx(
                'p-1 rounded-lg transition-colors shrink-0',
                note.isPinned
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-elvo-fog opacity-0 group-hover:opacity-100 hover:text-elvo-noir dark:hover:text-white'
              )}
            >
              <Pin className="w-4 h-4 fill-current" />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-elvo-noir dark:text-white truncate">
                {note.title || 'Untitled Note'}
              </h3>
              {!isTrashView && !isArchivedView && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(note._id, note.isFavorite);
                  }}
                  title={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  aria-label={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  className={clsx(
                    'p-0.5 rounded-lg transition-colors shrink-0',
                    note.isFavorite
                      ? 'text-amber-500'
                      : 'text-elvo-fog opacity-0 group-hover:opacity-100 hover:text-amber-500'
                  )}
                >
                  <Star className={clsx('w-3.5 h-3.5', note.isFavorite && 'fill-current')} />
                </button>
              )}
            </div>
            <p className="text-xs text-elvo-fog truncate mt-0.5 max-w-xl">
              {note.plainTextPreview || 'No additional text'}
            </p>
          </div>
        </div>

        {/* Center: Metadata (Collection, Tags, Linked Tasks) */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {note.collectionId && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border"
              style={{
                backgroundColor: `${note.collectionId.color || '#6366F1'}15`,
                borderColor: `${note.collectionId.color || '#6366F1'}40`,
                color: note.collectionId.color || '#6366F1',
              }}
            >
              <Folder className="w-3 h-3" />
              <span className="truncate max-w-[100px]">{note.collectionId.name}</span>
            </span>
          )}

          {linkedTaskCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-[#3A3A3A] text-slate-700 dark:text-slate-300">
              <CheckSquare className="w-3 h-3 text-indigo-500" />
              <span>{linkedTaskCount} {linkedTaskCount === 1 ? 'task' : 'tasks'}</span>
            </span>
          )}

          {Array.isArray(note.tags) && note.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-black/5 dark:bg-white/5 text-elvo-fog"
            >
              #{t}
            </span>
          ))}
        </div>

        {/* Right: Date & Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-elvo-fog whitespace-nowrap">
            {formattedDate}
          </span>

          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 rounded-lg text-elvo-fog hover:text-elvo-noir dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-[#1C1C1C] border border-[#E0E0E0] dark:border-[#3A3A3A] shadow-elvo py-1 z-30 animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                {!isTrashView && !isArchivedView && (
                  <>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onToggleFavorite(note._id, note.isFavorite);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-elvo-iron dark:text-elvo-silver hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span>{note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onArchive(note._id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-elvo-iron dark:text-elvo-silver hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archive Note</span>
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onTrash(note._id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Move to Trash</span>
                    </button>
                  </>
                )}

                {(isTrashView || isArchivedView) && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onRestore(note._id);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Note</span>
                  </button>
                )}

                {isTrashView && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDeletePermanently(note._id);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // GRID VIEW CARD
  // -------------------------------------------------------------
  return (
    <div
      onClick={() => onOpen(note)}
      className={clsx(
        'group relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-150 cursor-pointer min-h-[190px]',
        'bg-white dark:bg-[#2B2B2B] border-[#E0E0E0] dark:border-[#3A3A3A]',
        'hover:border-elvo-silver dark:hover:border-elvo-fog hover:shadow-card',
        note.isPinned && !isTrashView && !isArchivedView && 'border-t-4 border-t-indigo-600 dark:border-t-indigo-400 shadow-subtle'
      )}
    >
      {/* Top Header: Title, Pin, Menu */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-base font-bold text-elvo-noir dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {note.title || 'Untitled Note'}
          </h3>

          <div className="flex items-center gap-1 shrink-0 -mr-1">
            {!isTrashView && !isArchivedView && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(note._id, note.isFavorite);
                  }}
                  title={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  aria-label={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  className={clsx(
                    'p-1.5 rounded-lg transition-colors',
                    note.isFavorite
                      ? 'text-amber-500'
                      : 'text-elvo-fog opacity-0 group-hover:opacity-100 hover:text-amber-500'
                  )}
                >
                  <Star className={clsx('w-4 h-4', note.isFavorite && 'fill-current')} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(note._id, note.isPinned);
                  }}
                  title={note.isPinned ? 'Unpin note' : 'Pin note'}
                  className={clsx(
                    'p-1.5 rounded-lg transition-colors',
                    note.isPinned
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-elvo-fog opacity-0 group-hover:opacity-100 hover:text-elvo-noir dark:hover:text-white'
                  )}
                >
                  <Pin className={clsx('w-4 h-4', note.isPinned && 'fill-current')} />
                </button>
              </>
            )}

            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
                className="p-1.5 rounded-lg text-elvo-fog hover:text-elvo-noir dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-[#1C1C1C] border border-[#E0E0E0] dark:border-[#3A3A3A] shadow-elvo py-1 z-30 animate-fade-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  {!isTrashView && !isArchivedView && (
                    <>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onArchive(note._id);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-elvo-iron dark:text-elvo-silver hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive Note</span>
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onTrash(note._id);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Move to Trash</span>
                      </button>
                    </>
                  )}

                  {(isTrashView || isArchivedView) && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onRestore(note._id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore Note</span>
                    </button>
                  )}

                  {isTrashView && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onDeletePermanently(note._id);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Permanently</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Preview */}
        <p className="text-xs text-elvo-fog dark:text-[#A0A0A0] line-clamp-3 leading-relaxed mb-4">
          {note.plainTextPreview || 'Empty note...'}
        </p>
      </div>

      {/* Bottom Metadata & Footer */}
      <div className="space-y-3 pt-2 border-t border-[#E0E0E0]/60 dark:border-[#3A3A3A]/60">
        {/* Tags & Collection */}
        <div className="flex flex-wrap items-center gap-1.5">
          {note.collectionId && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border"
              style={{
                backgroundColor: `${note.collectionId.color || '#6366F1'}15`,
                borderColor: `${note.collectionId.color || '#6366F1'}40`,
                color: note.collectionId.color || '#6366F1',
              }}
            >
              <Folder className="w-3 h-3" />
              <span className="truncate max-w-[90px]">{note.collectionId.name}</span>
            </span>
          )}

          {Array.isArray(note.tags) && note.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-black/5 dark:bg-white/5 text-elvo-fog"
            >
              #{t}
            </span>
          ))}

          {linkedTaskCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40">
              <CheckSquare className="w-3 h-3" />
              <span>{linkedTaskCount} {linkedTaskCount === 1 ? 'task' : 'tasks'}</span>
            </span>
          )}
        </div>

        {/* Footer: Date and Scope indication */}
        <div className="flex items-center justify-between text-[11px] text-elvo-fog">
          <span>{formattedDate}</span>
          {note.workspaceId && (
            <span className="font-medium text-[10px] uppercase tracking-wider text-indigo-500">
              Workspace
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoteCard;
