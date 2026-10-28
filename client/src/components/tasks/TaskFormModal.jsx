import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Button } from '../common/Button.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { toISODate, validateTaskDates } from '../../utils/dateUtils.js';
import { Plus, X, Check, Clock, Calendar, Tag, Repeat, Bell, Users } from 'lucide-react';
import { clsx } from 'clsx';

const COLOR_OPTIONS = [
  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-500' },
  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500' },
  { id: 'amber', label: 'Amber', bg: 'bg-amber-500' },
  { id: 'rose', label: 'Rose', bg: 'bg-rose-500' },
  { id: 'sky', label: 'Sky', bg: 'bg-sky-500' },
  { id: 'purple', label: 'Purple', bg: 'bg-purple-500' },
  { id: 'violet', label: 'Violet', bg: 'bg-violet-500' },
  { id: 'teal', label: 'Teal', bg: 'bg-teal-500' },
  { id: 'orange', label: 'Orange', bg: 'bg-orange-500' },
  { id: 'pink', label: 'Pink', bg: 'bg-pink-500' },
  { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-500' },
  { id: 'lime', label: 'Lime', bg: 'bg-lime-500' },
  { id: 'fuchsia', label: 'Fuchsia', bg: 'bg-fuchsia-500' },
  { id: 'slate', label: 'Slate', bg: 'bg-slate-500' },
];

const PRIORITY_OPTIONS = [
  { id: 'Low', label: 'Low', color: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'Medium', label: 'Medium', color: 'text-amber-600 dark:text-amber-400' },
  { id: 'High', label: 'High', color: 'text-rose-600 dark:text-rose-400' },
];

const STATUS_OPTIONS = [
  { id: 'To Do', label: 'To Do' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Done', label: 'Done' },
];

export const TaskFormModal = ({
  isOpen,
  onClose,
  initialDate,
  initialStartTime = '',
  editTask = null,
  initialStatus = 'To Do',
}) => {
  const { user } = useAuth();
  const { createTask, updateTask } = useTasks();
  const { workspaces, activeWorkspaceId } = useWorkspace();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [color, setColor] = useState('indigo');
  const [status, setStatus] = useState(initialStatus || 'To Do');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('personal');
  const [assignees, setAssignees] = useState([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);

  // Subtasks
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('');

  // Tags
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');

  // Recurrence
  const [recurrenceFreq, setRecurrenceFreq] = useState('none');

  // Reminders
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(15);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editTask && editTask._id) {
      setTitle(editTask.title || '');
      setDescription(editTask.description || '');
      setStartDate(editTask.startDate ? toISODate(editTask.startDate) : toISODate(new Date()));
      setDueDate(editTask.dueDate ? toISODate(editTask.dueDate) : '');
      setStartTime(editTask.isAllDay ? '' : editTask.startTime || '');
      setEndTime(editTask.isAllDay ? '' : editTask.endTime || '');
      setPriority(editTask.priority || 'Medium');
      setColor(editTask.color || 'indigo');
      setStatus(editTask.status || 'To Do');
      setSelectedWorkspaceId(
        typeof editTask.workspaceId === 'object' && editTask.workspaceId?._id
          ? editTask.workspaceId._id.toString()
          : editTask.workspaceId || 'personal'
      );
      
      const parsedAssignees = (editTask.assignees || []).map((a) =>
        typeof a === 'object' && a?._id ? a._id.toString() : a.toString()
      );
      if (parsedAssignees.length === 0 && editTask.assignedTo) {
        const single = typeof editTask.assignedTo === 'object' && editTask.assignedTo?._id
          ? editTask.assignedTo._id.toString()
          : editTask.assignedTo.toString();
        parsedAssignees.push(single);
      }
      setAssignees(parsedAssignees);
      setAssignedTo(parsedAssignees[0] || '');

      setSubtasks(
        (editTask.subtasks || []).map((s) => ({
          _id: s._id,
          title: s.title,
          completed: !!s.completed,
          assignee: typeof s.assignee === 'object' && s.assignee?._id ? s.assignee._id.toString() : s.assignee || '',
        }))
      );
      setTags(editTask.tags || []);
      setRecurrenceFreq(editTask.recurrence?.frequency || 'none');
      setReminderEnabled(editTask.reminder?.enabled || false);
      setReminderMinutes(editTask.reminder?.minutesBefore || 15);
      setEstimatedMinutes(editTask.estimatedMinutes || 30);
    } else {
      setTitle('');
      setDescription('');
      setStartDate(initialDate ? toISODate(initialDate) : toISODate(new Date()));
      setDueDate('');
      setStartTime(initialStartTime || '');
      if (initialStartTime && /^\d{2}:\d{2}$/.test(initialStartTime)) {
        const [h, m] = initialStartTime.split(':').map(Number);
        if (h === 23) {
          setEndTime('23:59');
        } else {
          setEndTime(`${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
      } else {
        setEndTime('');
      }
      setPriority('Medium');
      setColor('indigo');
      const defaultWsId = activeWorkspaceId === 'my-work' ? 'personal' : (activeWorkspaceId || 'personal');
      setSelectedWorkspaceId(defaultWsId);
      const defaultAssignees = defaultWsId !== 'personal' && user?._id ? [user._id.toString()] : [];
      setAssignees(defaultAssignees);
      setAssignedTo(defaultAssignees[0] || '');
      setSubtasks([]);
      setNewSubtaskAssignee('');
      setTags([]);
      setRecurrenceFreq('none');
      setReminderEnabled(false);
      setReminderMinutes(15);
      setEstimatedMinutes(30);
    }
    setError('');
  }, [editTask, isOpen, initialDate, initialStartTime, initialStatus, activeWorkspaceId, user]);

  const handleToggleAssignee = (userId) => {
    if (assignees.includes(userId)) {
      const updated = assignees.filter((id) => id !== userId);
      setAssignees(updated);
      setAssignedTo(updated[0] || '');
    } else {
      const updated = [...assignees, userId];
      setAssignees(updated);
      setAssignedTo(updated[0] || '');
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([
      ...subtasks,
      {
        title: newSubtaskTitle.trim(),
        completed: false,
        assignee: newSubtaskAssignee || null,
      },
    ]);
    setNewSubtaskTitle('');
    setNewSubtaskAssignee('');
  };

  const handleRemoveSubtask = (index) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a task title.');
      return;
    }
    if (!startDate) {
      setError('Please pick a start date.');
      return;
    }

    // Client-side date/time validation
    const dateErrors = validateTaskDates({
      startDate,
      endDate: null,
      dueDate: dueDate || null,
      startTime: startTime || null,
      endTime: endTime || null,
    });
    if (dateErrors.length > 0) {
      setError(dateErrors[0]);
      return;
    }

    setIsSubmitting(true);
    setError('');

    // isAllDay: true only when neither start nor end time is provided.
    // Timed tasks (including open-ended ones with only startTime) are never marked all-day.
    const computedIsAllDay = Boolean(!startTime && !endTime);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      startDate,
      dueDate: dueDate ? dueDate : null,
      startTime: startTime || null,
      endTime: endTime || null,
      isAllDay: computedIsAllDay,
      priority,
      color,
      status,
      workspaceId: selectedWorkspaceId === 'personal' ? null : selectedWorkspaceId,
      assignees: selectedWorkspaceId !== 'personal' ? assignees : [],
      assignedTo: (selectedWorkspaceId !== 'personal' && assignees.length > 0) ? assignees[0] : null,
      subtasks: subtasks.map((s) => ({
        _id: s._id,
        title: s.title,
        completed: !!s.completed,
        assignee: s.assignee || null,
      })),
      tags,
      recurrence: { frequency: recurrenceFreq, interval: 1 },
      reminder: { enabled: reminderEnabled, minutesBefore: Number(reminderMinutes) },
      estimatedMinutes: Number(estimatedMinutes) || 0,
    };

    let res;
    if (editTask && editTask._id) {
      res = await updateTask(editTask._id, payload);
    } else {
      res = await createTask(payload);
    }

    setIsSubmitting(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Failed to save task.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editTask && editTask._id ? 'Edit Task' : 'Create New Task'}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-xs font-medium text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <Input
          label="Task Title"
          placeholder="e.g., Complete project milestone & review docs"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />

        {/* Date & Time Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Schedule Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />

          <Input
            label="Deadline / Due Date (Optional)"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Start Time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />

          <Input
            label="End Time"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />

          <Input
            label="Est. Focus (Min)"
            type="number"
            min="5"
            step="5"
            value={estimatedMinutes}
            onChange={(e) => setEstimatedMinutes(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Description & Context
          </label>
          <textarea
            rows={2}
            className="w-full px-3.5 py-2 text-sm rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
            placeholder="Add details, notes, links, or instructions..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Workspace Selector */}
        {workspaces.length > 0 && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Workspace
            </label>
            <select
              value={selectedWorkspaceId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedWorkspaceId(val);
                if (val !== 'personal') {
                  if (assignees.length === 0 && user?._id) {
                    setAssignees([user._id.toString()]);
                    setAssignedTo(user._id.toString());
                  }
                } else {
                  setAssignees([]);
                  setAssignedTo('');
                }
              }}
              className="select-elvo w-full px-3.5 py-2 text-sm"
            >
              <option value="personal">Personal Workspace</option>
              {workspaces.map((ws) => (
                <option key={ws._id} value={ws._id}>
                  {ws.name}
                </option>
              ))}
            </select>

            {/* Multiple Member Assignee Selector */}
            {selectedWorkspaceId !== 'personal' && (() => {
              const currentWs = workspaces.find((w) => w._id === selectedWorkspaceId);
              if (!currentWs) return null;

              const memberList = [];
              if (currentWs.owner) {
                const ownerId = typeof currentWs.owner === 'object' && currentWs.owner?._id ? currentWs.owner._id.toString() : currentWs.owner.toString();
                const ownerName = typeof currentWs.owner === 'object' && currentWs.owner?.name ? currentWs.owner.name : 'Workspace Owner';
                memberList.push({ id: ownerId, name: `${ownerName} (owner)` });
              }
              (currentWs.members || []).forEach((m) => {
                const uId = typeof m.user === 'object' && m.user?._id ? m.user._id.toString() : m.user?.toString();
                if (uId && !memberList.some((existing) => existing.id === uId)) {
                  const uName = typeof m.user === 'object' && m.user?.name ? m.user.name : m.user?.email || 'Member';
                  memberList.push({ id: uId, name: `${uName} (${m.role || 'member'})` });
                }
              });

              return (
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                      Task Assignees ({assignees.length})
                    </label>
                    {assignees.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAssignees([]);
                          setAssignedTo('');
                        }}
                        className="text-[11px] text-slate-400 hover:text-rose-500"
                      >
                        Unassign All
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 max-h-36 overflow-y-auto">
                    {memberList.map((m) => {
                      const isSelected = assignees.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleToggleAssignee(m.id)}
                          className={clsx(
                            'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-colors',
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                              : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-300'
                          )}
                        >
                          <span className="truncate">{m.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 pt-0.5">
                    Select one or more members. If left unassigned, this task won't appear in anyone's My Work.
                  </p>
                </div>
              );
            })()}
          </div>
        )}

        {/* Subtasks Checklist Builder */}
        <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Checklist / Subtasks ({subtasks.filter((s) => s.completed).length}/{subtasks.length})
          </label>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {subtasks.map((st, idx) => {
              const ws = workspaces.find((w) => w._id === selectedWorkspaceId);
              let assigneeLabel = null;
              if (st.assignee && ws) {
                if (ws.owner && (ws.owner._id === st.assignee || ws.owner === st.assignee)) {
                  assigneeLabel = ws.owner.name || 'Owner';
                } else {
                  const m = (ws.members || []).find((mem) => (mem.user?._id || mem.user) === st.assignee);
                  if (m) assigneeLabel = m.user?.name || m.user?.email || 'Member';
                }
              }

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white dark:bg-zinc-800 rounded-lg text-xs"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate text-slate-700 dark:text-zinc-200">{st.title}</span>
                    {assigneeLabel && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 shrink-0">
                        @{assigneeLabel}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(idx)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Add step or subtask..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubtask();
                }
              }}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {selectedWorkspaceId !== 'personal' && (() => {
              const currentWs = workspaces.find((w) => w._id === selectedWorkspaceId);
              if (!currentWs) return null;
              const memberList = [];
              if (currentWs.owner) {
                const ownerId = typeof currentWs.owner === 'object' && currentWs.owner?._id ? currentWs.owner._id.toString() : currentWs.owner.toString();
                const ownerName = typeof currentWs.owner === 'object' && currentWs.owner?.name ? currentWs.owner.name : 'Owner';
                memberList.push({ id: ownerId, name: ownerName });
              }
              (currentWs.members || []).forEach((m) => {
                const uId = typeof m.user === 'object' && m.user?._id ? m.user._id.toString() : m.user?.toString();
                if (uId && !memberList.some((existing) => existing.id === uId)) {
                  const uName = typeof m.user === 'object' && m.user?.name ? m.user.name : 'Member';
                  memberList.push({ id: uId, name: uName });
                }
              });

              return (
                <select
                  value={newSubtaskAssignee}
                  onChange={(e) => setNewSubtaskAssignee(e.target.value)}
                  className="select-elvo px-2.5 py-1 text-xs"
                >
                  <option value="">No subtask assignee</option>
                  {memberList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              );
            })()}
            <Button type="button" size="sm" variant="secondary" onClick={handleAddSubtask}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Tags & Categories
          </label>
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
              >
                #{t}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(t)}
                  className="hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Type a tag and press Enter..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Recurrence & Reminder */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Recurring Task
            </label>
            <select
              value={recurrenceFreq}
              onChange={(e) => setRecurrenceFreq(e.target.value)}
              className="select-elvo w-full px-3 py-1.5 text-xs"
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Reminder Alert
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="reminderCheck"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="reminderCheck" className="text-xs text-slate-700 dark:text-zinc-300">
                Enable email &amp; in-app reminder
              </label>
            </div>
            {reminderEnabled && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Notify before (minutes)</label>
                <select
                  value={reminderMinutes}
                  onChange={(e) => setReminderMinutes(Number(e.target.value))}
                  className="select-elvo w-full px-3 py-1.5 text-xs"
                >
                  <option value={5}>5 minutes before</option>
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                  <option value={120}>2 hours before</option>
                  <option value={1440}>1 day before</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Priority & Status Row */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Priority
            </label>
            <div className="grid grid-cols-3 gap-1">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id)}
                  className={clsx(
                    'py-1.5 text-[11px] font-medium rounded-lg border transition-all text-center',
                    priority === p.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold shadow-subtle'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Status
            </label>
            <div className="grid grid-cols-3 gap-1">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatus(s.id)}
                  className={clsx(
                    'py-1.5 text-[11px] font-medium rounded-lg border transition-all text-center',
                    status === s.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold shadow-subtle'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Color Tag Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Task Color Accent
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColor(c.id)}
                className={clsx(
                  'w-7 h-7 rounded-full transition-transform',
                  c.bg,
                  color === c.id
                    ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110'
                    : 'opacity-70 hover:opacity-100 hover:scale-105'
                )}
                title={c.label}
              />
            ))}
          </div>
          {color && (
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Selected: <span className="font-semibold capitalize">{color}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
            {editTask ? 'Save Changes' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

