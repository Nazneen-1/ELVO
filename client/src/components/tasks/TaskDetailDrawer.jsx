import React, { useState } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';
import { useTasks } from '../../context/TaskContext.jsx';
import { format, parseISO } from 'date-fns';
import { formatDisplayTime } from '../../utils/dateUtils.js';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit3,
} from 'lucide-react';

export const TaskDetailDrawer = ({
  task,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { updateTask, deleteTask } = useTasks();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  if (!task) return null;

  const handleToggleStatus = async () => {
    setIsStatusUpdating(true);
    const nextStatus =
      task.status === 'pending'
        ? 'in_progress'
        : task.status === 'in_progress'
        ? 'completed'
        : 'pending';

    await updateTask(task._id, { status: nextStatus });
    setIsStatusUpdating(false);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      setIsDeleting(true);
      await deleteTask(task._id);
      setIsDeleting(false);
      onClose();
    }
  };

  const formattedDate = task.startDate
    ? format(
        typeof task.startDate === 'string'
          ? parseISO(task.startDate)
          : task.startDate,
        'EEEE, MMMM d, yyyy'
      )
    : '';

  const statusVariants = {
    pending: { label: 'Pending', variant: 'slate' },
    in_progress: { label: 'In Progress', variant: 'amber' },
    completed: { label: 'Completed', variant: 'emerald' },
  };

  const currentStatus = statusVariants[task.status] || statusVariants.pending;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Task Overview" maxWidth="max-w-md">
      <div className="space-y-6">
        {/* Title & Priority */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
            <Badge variant={task.color || 'indigo'}>
              {task.priority?.toUpperCase()} PRIORITY
            </Badge>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
            {task.title}
          </h2>
        </div>

        {/* Date and Time Information */}
        <div className="space-y-2.5 p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200/60 dark:border-zinc-800/60 text-sm">
          <div className="flex items-center gap-2.5 text-slate-700 dark:text-zinc-300">
            <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{formattedDate}</span>
          </div>

          {task.startTime && (
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-zinc-300">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>
                {formatDisplayTime(task.startTime)}
                {task.endTime ? ` - ${formatDisplayTime(task.endTime)}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Notes
            </p>
            <p className="text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {task.description}
            </p>
          </div>
        )}

        {/* Status Quick-Cycle Button */}
        <div>
          <Button
            variant="secondary"
            className="w-full justify-between"
            onClick={handleToggleStatus}
            isLoading={isStatusUpdating}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Cycle Status</span>
            </span>
            <span className="text-xs font-semibold capitalize opacity-80">
              {task.status.replace('_', ' ')} →
            </span>
          </Button>
        </div>

        {/* Bottom Actions (Edit / Delete) */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            isLoading={isDeleting}
            className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Delete
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(task);
              }}
            >
              <Edit3 className="w-4 h-4 mr-1.5" />
              Edit
            </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
