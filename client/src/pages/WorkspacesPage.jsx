import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { Input } from '../components/common/Input.jsx';
import { Button } from '../components/common/Button.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { workspaceService } from '../services/workspaceService.js';
import { format, parseISO } from 'date-fns';
import {
  Users,
  Plus,
  KeyRound,
  Copy,
  Check,
  Shield,
  UserPlus,
  Trash2,
  LogOut,
  Sparkles,
  Building,
  Layers,
  CheckSquare,
  Calendar,
  Archive,
  RotateCcw,
  Activity,
  Mail,
  UserCheck,
  Crown,
  AlertCircle,
  RefreshCw,
  Power,
} from 'lucide-react';
import { clsx } from 'clsx';

export const WorkspacesPage = () => {
  const { user } = useAuth();
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeWorkspace,
    createWorkspace,
    joinWorkspace,
    regenerateJoinCode,
    revokeJoinCode,
    createInvitation,
    revokeInvitation,
    updateMemberRole,
    transferOwnership,
    removeMember,
    archiveWorkspace,
    restoreWorkspace,
    deleteWorkspace,
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'invitations' | 'activity'
  const [workspaceListFilter, setWorkspaceListFilter] = useState('active'); // 'active' | 'archived'

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);

  const [targetMemberToRemove, setTargetMemberToRemove] = useState(null);
  const [reassignToUserId, setReassignToUserId] = useState('');
  const [newOwnerId, setNewOwnerId] = useState('');

  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [wsColor, setWsColor] = useState('indigo');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  const [activityLogs, setActivityLogs] = useState([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  const [copiedCode, setCopiedCode] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUserIdStr = (user?._id || user?.id || '').toString();

  const isOwner = (() => {
    if (!activeWorkspace || !currentUserIdStr) return false;
    const ownerId = (activeWorkspace.owner?._id || activeWorkspace.owner || '').toString();
    return Boolean(ownerId && ownerId === currentUserIdStr);
  })();

  const currentUserRole = (() => {
    if (!activeWorkspace || !currentUserIdStr) return null;
    const ownerId = (activeWorkspace.owner?._id || activeWorkspace.owner || '').toString();
    if (ownerId && ownerId === currentUserIdStr) return 'owner';
    const m = (activeWorkspace.members || []).find((mem) => {
      const mId = (mem.user?._id || mem.user || '').toString();
      return mId === currentUserIdStr;
    });
    return m?.role || 'member';
  })();

  const canManage = isOwner || currentUserRole === 'admin';

  // Load activity log when switching to activity tab
  useEffect(() => {
    if (activeTab === 'activity' && activeWorkspace?._id) {
      setIsLoadingActivity(true);
      workspaceService
        .getWorkspaceActivity(activeWorkspace._id)
        .then((res) => {
          if (res.success) {
            setActivityLogs(res.data || []);
          }
        })
        .catch((err) => console.error('Failed to load workspace activity:', err))
        .finally(() => setIsLoadingActivity(false));
    }
  }, [activeTab, activeWorkspace?._id]);

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!wsName.trim()) return;
    setIsSubmitting(true);
    setActionError('');
    const res = await createWorkspace({
      name: wsName.trim(),
      description: wsDesc.trim(),
      color: wsColor,
    });
    setIsSubmitting(false);
    if (res.success) {
      setWsName('');
      setWsDesc('');
      setIsCreateOpen(false);
    } else {
      setActionError(res.error);
    }
  };

  const handleJoinWorkspace = async (e) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    setIsSubmitting(true);
    setActionError('');
    const res = await joinWorkspace(inviteCodeInput.trim());
    setIsSubmitting(false);
    if (res.success) {
      setInviteCodeInput('');
      setIsJoinOpen(false);
    } else {
      setActionError(res.error);
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeWorkspace) return;
    setIsSubmitting(true);
    setActionError('');
    const res = await createInvitation(activeWorkspace._id, {
      email: inviteEmail.trim(),
      role: inviteRole,
    });
    setIsSubmitting(false);
    if (res.success) {
      setInviteEmail('');
      setIsInviteOpen(false);
    } else {
      setActionError(res.error);
    }
  };

  const handleCopyInviteCode = () => {
    if (!activeWorkspace?.inviteCode) return;
    navigator.clipboard.writeText(activeWorkspace.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRegenerateCode = async () => {
    if (!activeWorkspace || !canManage) return;
    if (window.confirm('Regenerate join code? Previous code will stop working.')) {
      await regenerateJoinCode(activeWorkspace._id);
    }
  };

  const handleToggleCodeActive = async () => {
    if (!activeWorkspace || !canManage) return;
    await revokeJoinCode(activeWorkspace._id, {
      active: !activeWorkspace.inviteCodeActive,
    });
  };

  const handleRevokeInvite = async (invitationId) => {
    if (!activeWorkspace || !canManage) return;
    if (window.confirm('Revoke this invitation?')) {
      await revokeInvitation(activeWorkspace._id, invitationId);
    }
  };

  const handleChangeRole = async (targetUserId, newRole) => {
    if (!activeWorkspace || !canManage) return;
    const res = await updateMemberRole(activeWorkspace._id, targetUserId, newRole);
    if (!res.success) {
      alert(res.error || 'Failed to update member role');
    }
  };

  const handleTransferOwnership = async (e) => {
    e.preventDefault();
    if (!activeWorkspace || !isOwner || !newOwnerId) return;
    setIsSubmitting(true);
    setActionError('');
    const res = await transferOwnership(activeWorkspace._id, newOwnerId);
    setIsSubmitting(false);
    if (res.success) {
      setIsTransferOpen(false);
      setNewOwnerId('');
    } else {
      setActionError(res.error);
    }
  };

  const handlePromptRemoveMember = (member) => {
    setTargetMemberToRemove(member);
    setReassignToUserId('');
    setIsRemoveOpen(true);
  };

  const handleConfirmRemoveMember = async () => {
    if (!activeWorkspace || !targetMemberToRemove) return;
    setIsSubmitting(true);
    const targetId = targetMemberToRemove.user?._id || targetMemberToRemove.user;
    const res = await removeMember(
      activeWorkspace._id,
      targetId,
      reassignToUserId || null
    );
    setIsSubmitting(false);
    if (res.success) {
      setIsRemoveOpen(false);
      setTargetMemberToRemove(null);
    } else {
      alert(res.error || 'Failed to remove member');
    }
  };

  const handleArchiveWorkspace = async () => {
    if (!activeWorkspace || !isOwner) return;
    if (
      window.confirm(
        `Archive workspace "${activeWorkspace.name}"? Active tasks and mutations will be frozen until restored.`
      )
    ) {
      await archiveWorkspace(activeWorkspace._id);
    }
  };

  const handleRestoreWorkspace = async (wsId) => {
    const idToRestore = wsId || activeWorkspace?._id;
    if (!idToRestore) return;
    const res = await restoreWorkspace(idToRestore);
    if (res?.success) {
      setWorkspaceListFilter('active');
    } else if (res?.error) {
      alert(res.error);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace || !isOwner) return;
    if (
      window.confirm(
        `Permanently delete workspace "${activeWorkspace.name}"? Tasks will become personal.`
      )
    ) {
      await deleteWorkspace(activeWorkspace._id);
    }
  };

  const visibleWorkspaces = workspaces.filter((ws) =>
    workspaceListFilter === 'archived' ? ws.isArchived : !ws.isArchived
  );

  return (
    <div className="relative min-h-full">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="/elvo-app-bg.jpg"
          alt=""
          className="w-full h-full object-cover object-center opacity-80 dark:opacity-30 mix-blend-multiply dark:mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/60 to-[#F5F5F5] dark:from-[#1A1A1A]/90 dark:via-[#1A1A1A]/95 dark:to-[#1A1A1A]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 lg:px-10 py-10 sm:py-14 space-y-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#565656] dark:text-[#848484] mb-2 uppercase">
              PROJECTS & WORKSPACES
            </p>
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-[#2B2B2B] dark:text-white leading-none mb-3">
              Collaborate.
            </h1>
            <p className="text-sm text-[#565656] dark:text-[#B3B3B3]">
              Organize personal projects or collaborate with teammates seamlessly.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsJoinOpen(true)}
              className="w-full sm:w-auto rounded-full bg-white/20 dark:bg-black/20 backdrop-blur-md"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Join with Code
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsCreateOpen(true)}
              className="w-full sm:w-auto rounded-full shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Workspace
            </Button>
          </div>
        </div>

        {/* Workspace Filter Tabs (Active vs Archived) */}
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWorkspaceListFilter('active')}
              className={clsx(
                'px-4 py-1.5 rounded-full text-xs font-bold transition-all',
                workspaceListFilter === 'active'
                  ? 'bg-[#2B2B2B] dark:bg-white text-white dark:text-[#2B2B2B] shadow-sm'
                  : 'text-[#565656] dark:text-[#848484] hover:bg-black/5 dark:hover:bg-white/5'
              )}
            >
              Active Spaces ({workspaces.filter((w) => !w.isArchived).length + 2})
            </button>
            <button
              onClick={() => setWorkspaceListFilter('archived')}
              className={clsx(
                'px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5',
                workspaceListFilter === 'archived'
                  ? 'bg-[#2B2B2B] dark:bg-white text-white dark:text-[#2B2B2B] shadow-sm'
                  : 'text-[#565656] dark:text-[#848484] hover:bg-black/5 dark:hover:bg-white/5'
              )}
            >
              <Archive className="w-3.5 h-3.5" />
              Archived ({workspaces.filter((w) => w.isArchived).length})
            </button>
          </div>
        </div>

        {/* Workspace Switcher Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Personal Space (shown only on Active tab) */}
          {workspaceListFilter === 'active' && (
            <div
              onClick={() => setActiveWorkspaceId('personal')}
              className={clsx(
                'p-6 rounded-3xl border transition-all cursor-pointer relative overflow-hidden group',
                activeWorkspaceId === 'personal'
                  ? 'bg-white/60 dark:bg-[#2B2B2B]/60 backdrop-blur-xl border-[#2B2B2B] dark:border-white shadow-elvo'
                  : 'bg-white/30 dark:bg-[#2B2B2B]/30 backdrop-blur-md border-white/60 dark:border-[#3A3A3A]/60 hover:bg-white/50 dark:hover:bg-[#2B2B2B]/50'
              )}
            >
              <div className="flex items-center justify-between relative z-10">
                <div
                  className={clsx(
                    'w-12 h-12 rounded-full flex items-center justify-center transition-colors border',
                    activeWorkspaceId === 'personal'
                      ? 'bg-[#2B2B2B] border-[#2B2B2B] text-white dark:bg-white dark:border-white dark:text-[#2B2B2B]'
                      : 'bg-white/50 dark:bg-black/20 border-white/60 dark:border-white/10 text-[#2B2B2B] dark:text-white'
                  )}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                {activeWorkspaceId === 'personal' && (
                  <div className="w-2.5 h-2.5 rounded-full bg-[#2B2B2B] dark:bg-white" />
                )}
              </div>
              <div className="mt-6 relative z-10">
                <h3 className="text-lg font-bold text-[#2B2B2B] dark:text-white">
                  Personal Workspace
                </h3>
                <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mt-1">
                  Your private solo tasks and schedule
                </p>
              </div>
            </div>
          )}

          {/* Special My Work Card (Aggregated Mode - shown only on Active tab) */}
          {workspaceListFilter === 'active' && (
            <div
              onClick={() => setActiveWorkspaceId('my-work')}
              className={clsx(
                'p-6 rounded-3xl border transition-all cursor-pointer relative overflow-hidden group',
                activeWorkspaceId === 'my-work'
                  ? 'bg-white/60 dark:bg-[#2B2B2B]/60 backdrop-blur-xl border-indigo-600 dark:border-indigo-400 shadow-elvo'
                  : 'bg-white/30 dark:bg-[#2B2B2B]/30 backdrop-blur-md border-white/60 dark:border-[#3A3A3A]/60 hover:bg-white/50 dark:hover:bg-[#2B2B2B]/50'
              )}
            >
              <div className="flex items-center justify-between relative z-10">
                <div
                  className={clsx(
                    'w-12 h-12 rounded-full flex items-center justify-center transition-colors border',
                    activeWorkspaceId === 'my-work'
                      ? 'bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500 dark:border-indigo-500 dark:text-white'
                      : 'bg-white/50 dark:bg-black/20 border-white/60 dark:border-white/10 text-indigo-600 dark:text-indigo-400'
                  )}
                >
                  <Layers className="w-5 h-5" />
                </div>
                {activeWorkspaceId === 'my-work' ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full">
                    Aggregated
                  </span>
                )}
              </div>
              <div className="mt-6 relative z-10">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#2B2B2B] dark:text-white">
                    My Work
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
                    Virtual
                  </span>
                </div>
                <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mt-1">
                  Aggregated view of personal tasks and your assigned team tasks
                </p>
              </div>
            </div>
          )}

          {/* Collaborative Workspaces */}
          {visibleWorkspaces.map((ws) => {
            const wsOwnerId = (ws.owner?._id || ws.owner || '').toString();
            const isThisWsOwner = Boolean(currentUserIdStr && wsOwnerId && currentUserIdStr === wsOwnerId);

            return (
              <div
                key={ws._id}
                onClick={() => setActiveWorkspaceId(ws._id)}
                className={clsx(
                  'p-6 rounded-3xl border transition-all relative overflow-hidden group cursor-pointer',
                  ws.isArchived
                    ? activeWorkspaceId === ws._id
                      ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-500/60 dark:border-amber-400/60 shadow-elvo'
                      : 'bg-zinc-100/50 dark:bg-zinc-900/50 border-dashed border-zinc-300 dark:border-zinc-800 opacity-80 hover:opacity-100'
                    : activeWorkspaceId === ws._id
                    ? 'bg-white/60 dark:bg-[#2B2B2B]/60 backdrop-blur-xl border-[#2B2B2B] dark:border-white shadow-elvo'
                    : 'bg-white/30 dark:bg-[#2B2B2B]/30 backdrop-blur-md border-white/60 dark:border-[#3A3A3A]/60 hover:bg-white/50 dark:hover:bg-[#2B2B2B]/50'
                )}
              >
                <div className="flex items-center justify-between relative z-10">
                  <div
                    className={clsx(
                      'w-12 h-12 rounded-full flex items-center justify-center transition-colors border',
                      activeWorkspaceId === ws._id && !ws.isArchived
                        ? 'bg-[#2B2B2B] border-[#2B2B2B] text-white dark:bg-white dark:border-white dark:text-[#2B2B2B]'
                        : 'bg-white/50 dark:bg-black/20 border-white/60 dark:border-white/10 text-[#2B2B2B] dark:text-white'
                    )}
                  >
                    <Building className="w-5 h-5" />
                  </div>
                  {ws.isArchived ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-3 py-1 rounded-full flex items-center gap-1">
                      <Archive className="w-3 h-3" /> Archived
                    </span>
                  ) : activeWorkspaceId === ws._id ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#2B2B2B] dark:bg-white" />
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#848484] bg-black/5 dark:bg-white/5 px-3 py-1 rounded-full">
                      {(ws.members || []).length} Mbr
                    </span>
                  )}
                </div>
                <div className="mt-6 relative z-10">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-[#2B2B2B] dark:text-white truncate">
                      {ws.name}
                    </h3>
                    {ws.isArchived && isThisWsOwner && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestoreWorkspace(ws._id);
                        }}
                        className="text-xs rounded-full shadow-sm bg-amber-600 hover:bg-amber-700 text-white border-none shrink-0"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" /> Restore
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mt-1 truncate">
                    {ws.description || 'Shared team workspace'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* My Work Active Status Banner */}
        {activeWorkspaceId === 'my-work' && (
          <div className="p-8 rounded-[32px] bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-indigo-500/30 dark:border-indigo-400/30 shadow-elvo space-y-4 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-light text-[#2B2B2B] dark:text-white flex items-center gap-2.5">
                    My Work{' '}
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/70 px-3 py-1 rounded-full uppercase tracking-wider">
                      Aggregated Mode Active
                    </span>
                  </h2>
                  <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mt-1 max-w-xl">
                    Your personal workspace tasks and collaborative tasks assigned to you across all workspaces are aggregated together in Calendar and Tasks views.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to="/app/tasks"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2B2B2B] dark:bg-white text-white dark:text-[#2B2B2B] text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
                >
                  <CheckSquare className="w-4 h-4" />
                  View Tasks
                </Link>
                <Link
                  to="/app/calendar"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/70 dark:bg-zinc-800 text-[#2B2B2B] dark:text-white border border-black/10 dark:border-white/10 text-xs font-semibold hover:bg-white dark:hover:bg-zinc-700 transition-all"
                >
                  <Calendar className="w-4 h-4" />
                  View Calendar
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Personal Workspace Active Info Banner */}
        {activeWorkspaceId === 'personal' && (
          <div className="p-8 rounded-[32px] bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-elvo space-y-4 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#2B2B2B] dark:bg-white text-white dark:text-[#2B2B2B] flex items-center justify-center shrink-0 shadow-sm">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-light text-[#2B2B2B] dark:text-white flex items-center gap-2.5">
                    Personal Workspace
                  </h2>
                  <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mt-1 max-w-xl">
                    Your personal workspace tasks are completely private to you. Select any collaborative workspace card above to manage members, invitations, and permissions.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  size="md"
                  variant="primary"
                  onClick={() => setIsCreateOpen(true)}
                  className="rounded-full shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Workspace
                </Button>
                <Button
                  size="md"
                  variant="outline"
                  onClick={() => setIsJoinOpen(true)}
                  className="rounded-full bg-white/40 dark:bg-zinc-800"
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  Join with Code
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Active Collaborative Workspace Management Panel */}
        {activeWorkspace && (
          <div className="p-8 rounded-[32px] bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-elvo space-y-8">
            {/* Header / Workspace Identity & Actions */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-white/20 dark:border-[#3A3A3A]/40">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-light tracking-tight text-[#2B2B2B] dark:text-white">
                    {activeWorkspace.name}
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#2B2B2B] dark:text-[#1A1A1A] bg-[#E0E0E0] dark:bg-[#E0E0E0] px-3 py-1 rounded-full">
                    {currentUserRole?.toUpperCase() || 'MEMBER'}
                  </span>
                  {activeWorkspace.isArchived && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/70 px-3 py-1 rounded-full">
                      Archived
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#565656] dark:text-[#B3B3B3]">
                  {activeWorkspace.description || 'Shared tasks, calendar, and activity log'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {activeWorkspace.isArchived ? (
                  isOwner && (
                    <>
                      <Button
                        size="md"
                        variant="primary"
                        onClick={() => handleRestoreWorkspace(activeWorkspace._id)}
                        className="rounded-full bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restore Workspace
                      </Button>
                      <Button
                        size="md"
                        variant="outline"
                        onClick={handleDeleteWorkspace}
                        className="rounded-full border-rose-500/50 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Space
                      </Button>
                    </>
                  )
                ) : (
                  <>
                    {canManage && (
                      <Button
                        size="md"
                        variant="secondary"
                        onClick={() => setIsInviteOpen(true)}
                        className="rounded-full shadow-sm"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite Member
                      </Button>
                    )}
                    {isOwner && (
                      <>
                        <Button
                          size="md"
                          variant="outline"
                          onClick={() => setIsTransferOpen(true)}
                          className="rounded-full bg-white/40 dark:bg-zinc-800"
                        >
                          <Crown className="w-4 h-4 mr-2 text-amber-500" />
                          Transfer Ownership
                        </Button>
                        <Button
                          size="md"
                          variant="outline"
                          onClick={handleArchiveWorkspace}
                          className="rounded-full text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Archive Space
                        </Button>
                        <Button
                          size="md"
                          variant="outline"
                          onClick={handleDeleteWorkspace}
                          className="rounded-full border-rose-500/50 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Space
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Archived Read-Only Notice Banner */}
            {activeWorkspace.isArchived && (
              <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Archive className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <p className="font-bold text-xs uppercase tracking-wider">
                      Workspace is Archived (Read-Only)
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                      All tasks, mutations, and membership operations are frozen until restored by the owner.
                    </p>
                  </div>
                </div>
                {isOwner && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleRestoreWorkspace(activeWorkspace._id)}
                    className="rounded-full bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-sm"
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" />
                    Restore Workspace
                  </Button>
                )}
              </div>
            )}

            {/* Management Tabs */}
            <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2">
              <button
                onClick={() => setActiveTab('members')}
                className={clsx(
                  'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
                  activeTab === 'members'
                    ? 'bg-[#2B2B2B] dark:bg-white text-white dark:text-[#2B2B2B]'
                    : 'text-[#565656] dark:text-[#848484] hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                <Users className="w-4 h-4" />
                Members ({(activeWorkspace.members || []).length})
              </button>
              <button
                onClick={() => setActiveTab('invitations')}
                className={clsx(
                  'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
                  activeTab === 'invitations'
                    ? 'bg-[#2B2B2B] dark:bg-white text-white dark:text-[#2B2B2B]'
                    : 'text-[#565656] dark:text-[#848484] hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                <Mail className="w-4 h-4" />
                Join Code & Invites
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={clsx(
                  'px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
                  activeTab === 'activity'
                    ? 'bg-[#2B2B2B] dark:bg-white text-white dark:text-[#2B2B2B]'
                    : 'text-[#565656] dark:text-[#848484] hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                <Activity className="w-4 h-4" />
                Audit Trail
              </button>
            </div>

            {/* Tab 1: Member List & Roles */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                <div className="rounded-2xl overflow-hidden bg-white/30 dark:bg-black/10 border border-white/60 dark:border-[#3A3A3A]/50 backdrop-blur-md">
                  {(activeWorkspace.members || []).map((m, idx) => {
                    const memberUser = m.user || {};
                    const isMemberSelf = memberUser._id === user?._id;
                    const initials = memberUser.name
                      ? memberUser.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)
                      : '?';

                    return (
                      <div
                        key={memberUser._id || m._id}
                        className={clsx(
                          'p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/40 dark:hover:bg-white/5 transition-colors',
                          idx !== activeWorkspace.members.length - 1 &&
                            'border-b border-white/20 dark:border-[#3A3A3A]/30'
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-white/60 dark:bg-black/40 flex items-center justify-center text-sm font-bold text-[#2B2B2B] dark:text-white border border-white/60 dark:border-white/10 shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#2B2B2B] dark:text-white flex items-center gap-2">
                              {memberUser.name || 'Member'}
                              {isMemberSelf && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#848484] bg-[#E0E0E0]/50 dark:bg-[#1A1A1A] px-2 py-0.5 rounded-full">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-[#565656] dark:text-[#848484] mt-0.5">
                              {memberUser.email || ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Role Switcher or Static Role Badge */}
                          {canManage && m.role !== 'owner' && !isMemberSelf && !activeWorkspace.isArchived ? (
                            <select
                              value={m.role}
                              onChange={(e) =>
                                handleChangeRole(memberUser._id, e.target.value)
                              }
                              className="select-elvo px-3 py-1 text-xs font-bold uppercase tracking-wider"
                            >
                              {isOwner && <option value="admin">Admin</option>}
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            <span
                              className={clsx(
                                'text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full',
                                m.role === 'owner'
                                  ? 'bg-[#2B2B2B] text-white dark:bg-white dark:text-[#2B2B2B]'
                                  : 'bg-black/5 dark:bg-white/10 text-[#565656] dark:text-[#B3B3B3]'
                              )}
                            >
                              {m.role}
                            </span>
                          )}

                          {/* Member Removal or Departure Button */}
                          {!activeWorkspace.isArchived && (canManage || isMemberSelf) && m.role !== 'owner' && (
                            <button
                              onClick={() => handlePromptRemoveMember(m)}
                              className="text-[#848484] hover:text-rose-500 transition-colors p-2 rounded-full hover:bg-rose-500/10"
                              title={isMemberSelf ? 'Leave workspace' : 'Remove member'}
                            >
                              {isMemberSelf ? <LogOut className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Join Code & Email Invitations */}
            {activeTab === 'invitations' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Join Code Card */}
                <div className="lg:col-span-5 p-6 rounded-3xl bg-white/50 dark:bg-black/20 border border-white/60 dark:border-[#3A3A3A]/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#565656] dark:text-[#848484]">
                      <KeyRound className="w-4 h-4" />
                      <span>Join Code</span>
                    </div>
                    <span
                      className={clsx(
                        'text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full',
                        activeWorkspace.inviteCodeActive !== false
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      )}
                    >
                      {activeWorkspace.inviteCodeActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-[#565656] dark:text-[#B3B3B3]">
                    Teammates can enter this code on the Join screen to join instantly.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <code className="flex-1 px-4 py-3 rounded-xl bg-white/40 dark:bg-[#1A1A1A]/40 border border-white/60 dark:border-[#3A3A3A] font-mono text-base font-bold text-[#2B2B2B] dark:text-white tracking-widest text-center sm:text-left truncate">
                      {activeWorkspace.inviteCode}
                    </code>
                    <Button
                      size="md"
                      variant="primary"
                      onClick={handleCopyInviteCode}
                      className="rounded-xl px-4"
                    >
                      {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span className="ml-1.5">{copiedCode ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>

                  {!activeWorkspace.isArchived && canManage && (
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRegenerateCode}
                        className="text-xs rounded-xl flex-1 justify-center"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Regenerate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleToggleCodeActive}
                        className={clsx(
                          'text-xs rounded-xl flex-1 justify-center',
                          activeWorkspace.inviteCodeActive !== false
                            ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                            : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                        )}
                      >
                        <Power className="w-3.5 h-3.5 mr-1.5" />
                        {activeWorkspace.inviteCodeActive !== false ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Email Invitations List */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#2B2B2B] dark:text-white flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#565656] dark:text-[#B3B3B3]" />
                      Pending Invitations (
                      {(activeWorkspace.invitations || []).filter(
                        (i) => i.status === 'pending'
                      ).length}
                      )
                    </h3>
                    {!activeWorkspace.isArchived && canManage && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setIsInviteOpen(true)}
                        className="rounded-full text-xs"
                      >
                        <UserPlus className="w-3.5 h-3.5 mr-1" /> Send Invite
                      </Button>
                    )}
                  </div>

                  <div className="rounded-2xl overflow-hidden bg-white/30 dark:bg-black/10 border border-white/60 dark:border-[#3A3A3A]/50 backdrop-blur-md">
                    {(activeWorkspace.invitations || []).length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#848484]">
                        No invitations sent yet.
                      </div>
                    ) : (
                      (activeWorkspace.invitations || []).map((inv, idx) => (
                        <div
                          key={inv._id || idx}
                          className="p-3.5 flex items-center justify-between border-b border-white/20 dark:border-[#3A3A3A]/30 last:border-0"
                        >
                          <div>
                            <p className="text-sm font-bold text-[#2B2B2B] dark:text-white">
                              {inv.email}
                            </p>
                            <p className="text-[11px] text-[#848484]">
                              Role: <span className="font-semibold">{inv.role}</span> • Status:{' '}
                              <span className="font-semibold uppercase">{inv.status}</span>
                            </p>
                          </div>
                          {!activeWorkspace.isArchived && canManage && inv.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRevokeInvite(inv._id)}
                              className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-full"
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Security & Activity Audit Trail */}
            {activeTab === 'activity' && (
              <div className="space-y-4">
                <div className="rounded-2xl overflow-hidden bg-white/30 dark:bg-black/10 border border-white/60 dark:border-[#3A3A3A]/50 backdrop-blur-md p-4">
                  {isLoadingActivity ? (
                    <div className="p-8 text-center text-xs text-[#848484]">
                      Loading audit trail...
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#848484]">
                      No audit events recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {activityLogs.map((log, idx) => (
                        <div
                          key={log._id || idx}
                          className="p-3 rounded-xl bg-white/40 dark:bg-zinc-900/60 border border-white/40 dark:border-zinc-800 text-xs flex items-start justify-between gap-3"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white capitalize">
                              {log.action ? log.action.replace(/_/g, ' ') : 'Event'}
                            </p>
                            {log.details && (
                              <p className="text-slate-600 dark:text-zinc-300 text-[11px] mt-0.5">
                                {log.details}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {log.timestamp
                              ? format(parseISO(log.timestamp), 'MMM d, h:mm a')
                              : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal: Create Workspace */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Workspace"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateWorkspace} className="space-y-5 py-2">
            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {actionError}
              </div>
            )}
            <Input
              label="Workspace Name"
              placeholder="e.g. Project Titan, Marketing"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              required
              autoFocus
            />
            <Input
              label="Description (Optional)"
              placeholder="What is this workspace for?"
              value={wsDesc}
              onChange={(e) => setWsDesc(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-5 mt-2">
              <Button
                variant="ghost"
                size="md"
                type="button"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={isSubmitting}
                className="rounded-xl px-6"
              >
                Create Workspace
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Join Workspace */}
        <Modal
          isOpen={isJoinOpen}
          onClose={() => setIsJoinOpen(false)}
          title="Join Workspace"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleJoinWorkspace} className="space-y-5 py-2">
            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {actionError}
              </div>
            )}
            <Input
              label="Join Code"
              placeholder="e.g. 9F4A8C2B1D3E"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value)}
              required
              autoFocus
            />
            <p className="text-xs text-[#565656] dark:text-[#848484]">
              Enter the join code provided by your workspace admin.
            </p>
            <div className="flex justify-end gap-3 pt-5 mt-2">
              <Button
                variant="ghost"
                size="md"
                type="button"
                onClick={() => setIsJoinOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={isSubmitting}
                className="rounded-xl px-6"
              >
                Join Workspace
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Invite Member */}
        <Modal
          isOpen={isInviteOpen}
          onClose={() => setIsInviteOpen(false)}
          title="Invite Member by Email"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleInviteMember} className="space-y-5 py-2">
            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {actionError}
              </div>
            )}
            <Input
              label="User Email"
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              autoFocus
            />
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#565656] dark:text-[#848484]">
                Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="select-elvo w-full px-4 py-2.5 text-sm"
              >
                <option value="member">Member (Can create, edit & complete tasks)</option>
                {isOwner && <option value="admin">Admin (Can manage members & settings)</option>}
                <option value="viewer">Viewer (Read-only access)</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-5 mt-2">
              <Button
                variant="ghost"
                size="md"
                type="button"
                onClick={() => setIsInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={isSubmitting}
                className="rounded-xl px-6"
              >
                Send Invite
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Transfer Ownership */}
        <Modal
          isOpen={isTransferOpen}
          onClose={() => setIsTransferOpen(false)}
          title="Transfer Workspace Ownership"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleTransferOwnership} className="space-y-5 py-2">
            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {actionError}
              </div>
            )}
            <p className="text-xs text-slate-600 dark:text-zinc-300">
              Select an active member to receive workspace ownership. You will become a workspace Admin and will not be locked out.
            </p>
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#565656] dark:text-[#848484]">
                New Owner
              </label>
              <select
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                required
                className="select-elvo w-full px-4 py-2.5 text-sm"
              >
                <option value="">Select a member...</option>
                {(activeWorkspace?.members || [])
                  .filter((m) => (m.user?._id || m.user) !== user?._id)
                  .map((m) => (
                    <option key={m.user?._id || m.user} value={m.user?._id || m.user}>
                      {m.user?.name || m.user?.email || 'Member'} ({m.role})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-5 mt-2">
              <Button
                variant="ghost"
                size="md"
                type="button"
                onClick={() => setIsTransferOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={isSubmitting}
                className="rounded-xl px-6"
              >
                Transfer Ownership
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Member Departure / Removal with Reassignment */}
        <Modal
          isOpen={isRemoveOpen}
          onClose={() => setIsRemoveOpen(false)}
          title={
            (targetMemberToRemove?.user?._id || targetMemberToRemove?.user) === user?._id
              ? 'Leave Workspace'
              : 'Remove Member'
          }
          maxWidth="max-w-md"
        >
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-600 dark:text-zinc-300">
              {(targetMemberToRemove?.user?._id || targetMemberToRemove?.user) === user?._id
                ? 'Are you sure you want to leave this workspace? Your tasks will remain in the shared workspace.'
                : `Remove ${targetMemberToRemove?.user?.name || 'this member'} from the workspace?`}
            </p>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-[#565656] dark:text-[#848484]">
                Reassign Member Tasks (Optional)
              </label>
              <select
                value={reassignToUserId}
                onChange={(e) => setReassignToUserId(e.target.value)}
                className="select-elvo w-full px-4 py-2.5 text-sm"
              >
                <option value="">Leave tasks unassigned</option>
                {(activeWorkspace?.members || [])
                  .filter(
                    (m) =>
                      (m.user?._id || m.user) !==
                      (targetMemberToRemove?.user?._id || targetMemberToRemove?.user)
                  )
                  .map((m) => (
                    <option key={m.user?._id || m.user} value={m.user?._id || m.user}>
                      Reassign to: {m.user?.name || m.user?.email}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-5 mt-2">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setIsRemoveOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleConfirmRemoveMember}
                isLoading={isSubmitting}
                className="rounded-xl px-6 bg-rose-600 hover:bg-rose-700 text-white border-none"
              >
                {(targetMemberToRemove?.user?._id || targetMemberToRemove?.user) === user?._id
                  ? 'Confirm Leave'
                  : 'Remove Member'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};
