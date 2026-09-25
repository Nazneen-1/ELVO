import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Modal } from '../components/common/Modal.jsx';
import { Input } from '../components/common/Input.jsx';
import { Button } from '../components/common/Button.jsx';
import { Badge } from '../components/common/Badge.jsx';
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
} from 'lucide-react';
import { clsx } from 'clsx';

export const WorkspacesPage = () => {
  const { user } = useAuth();
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    createWorkspace,
    joinWorkspace,
    inviteMember,
    removeMember,
    deleteWorkspace,
  } = useWorkspace();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [wsColor, setWsColor] = useState('indigo');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  const [copiedCode, setCopiedCode] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId);
  const isOwner = activeWorkspace?.owner?._id === user?._id || activeWorkspace?.owner === user?._id;

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
    const res = await inviteMember(activeWorkspace._id, inviteEmail.trim(), inviteRole);
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

  const handleRemoveMember = async (userId) => {
    if (window.confirm('Remove this member from the workspace?')) {
      await removeMember(activeWorkspace._id, userId);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (window.confirm(`Delete workspace "${activeWorkspace.name}"? Tasks will become personal.`)) {
      await deleteWorkspace(activeWorkspace._id);
    }
  };

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
            <Button variant="outline" size="md" onClick={() => setIsJoinOpen(true)} className="w-full sm:w-auto rounded-full bg-white/20 dark:bg-black/20 backdrop-blur-md">
              <KeyRound className="w-4 h-4 mr-2" />
              Join with Code
            </Button>
            <Button variant="primary" size="md" onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto rounded-full shadow-lg">
              <Plus className="w-4 h-4 mr-2" />
              New Workspace
            </Button>
          </div>
        </div>

        {/* Workspace Switcher Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Personal Space */}
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
              <div className={clsx(
                "w-12 h-12 rounded-full flex items-center justify-center transition-colors border",
                activeWorkspaceId === 'personal' 
                  ? "bg-[#2B2B2B] border-[#2B2B2B] text-white dark:bg-white dark:border-white dark:text-[#2B2B2B]"
                  : "bg-white/50 dark:bg-black/20 border-white/60 dark:border-white/10 text-[#2B2B2B] dark:text-white"
              )}>
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

          {/* Team Workspaces */}
          {workspaces.map((ws) => (
            <div
              key={ws._id}
              onClick={() => setActiveWorkspaceId(ws._id)}
              className={clsx(
                'p-6 rounded-3xl border transition-all cursor-pointer relative overflow-hidden group',
                activeWorkspaceId === ws._id
                  ? 'bg-white/60 dark:bg-[#2B2B2B]/60 backdrop-blur-xl border-[#2B2B2B] dark:border-white shadow-elvo'
                  : 'bg-white/30 dark:bg-[#2B2B2B]/30 backdrop-blur-md border-white/60 dark:border-[#3A3A3A]/60 hover:bg-white/50 dark:hover:bg-[#2B2B2B]/50'
              )}
            >
              <div className="flex items-center justify-between relative z-10">
                <div className={clsx(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-colors border",
                  activeWorkspaceId === ws._id 
                    ? "bg-[#2B2B2B] border-[#2B2B2B] text-white dark:bg-white dark:border-white dark:text-[#2B2B2B]"
                    : "bg-white/50 dark:bg-black/20 border-white/60 dark:border-white/10 text-[#2B2B2B] dark:text-white"
                )}>
                  <Building className="w-5 h-5" />
                </div>
                {activeWorkspaceId === ws._id ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-[#2B2B2B] dark:bg-white" />
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#848484] bg-black/5 dark:bg-white/5 px-3 py-1 rounded-full">
                    {(ws.members || []).length} Mbr
                  </span>
                )}
              </div>
              <div className="mt-6 relative z-10">
                <h3 className="text-lg font-bold text-[#2B2B2B] dark:text-white truncate">
                  {ws.name}
                </h3>
                <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mt-1 truncate">
                  {ws.description || 'Shared team workspace'}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Active Workspace Details & Member Management */}
        {activeWorkspace && (
          <div className="p-8 rounded-[32px] bg-white/40 dark:bg-[#2B2B2B]/40 backdrop-blur-xl border border-white/60 dark:border-[#3A3A3A]/60 shadow-elvo space-y-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-white/20 dark:border-[#3A3A3A]/40">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-light tracking-tight text-[#2B2B2B] dark:text-white">
                    {activeWorkspace.name}
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#2B2B2B] dark:text-[#1A1A1A] bg-[#E0E0E0] dark:bg-[#E0E0E0] px-3 py-1 rounded-full">
                    Team Space
                  </span>
                </div>
                <p className="text-sm text-[#565656] dark:text-[#B3B3B3]">
                  {activeWorkspace.description || 'Shared tasks, calendar, and activity log'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button size="md" variant="secondary" onClick={() => setIsInviteOpen(true)} className="rounded-full shadow-sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
                {isOwner && (
                  <Button size="md" variant="outline" onClick={handleDeleteWorkspace} className="rounded-full border-rose-500/50 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Space
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-6">
                {/* Invite Code Box */}
                <div className="p-6 rounded-3xl bg-white/50 dark:bg-black/20 border border-white/60 dark:border-[#3A3A3A]/50">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#565656] dark:text-[#848484] mb-2">
                    <KeyRound className="w-4 h-4" />
                    <span>Invite Code</span>
                  </div>
                  <p className="text-sm text-[#565656] dark:text-[#B3B3B3] mb-6">
                    Share this code with teammates so they can join directly.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <code className="flex-1 px-4 py-3 rounded-xl bg-white/40 dark:bg-[#1A1A1A]/40 border border-white/60 dark:border-[#3A3A3A] font-mono text-base font-bold text-[#2B2B2B] dark:text-white tracking-widest text-center sm:text-left">
                      {activeWorkspace.inviteCode}
                    </code>
                    <Button size="md" variant="primary" onClick={handleCopyInviteCode} className="rounded-xl px-6">
                      {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span className="ml-2">{copiedCode ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                {/* Members Table */}
                <div>
                  <h3 className="text-sm font-bold text-[#2B2B2B] dark:text-white flex items-center gap-2 mb-4">
                    <Shield className="w-4 h-4 text-[#565656] dark:text-[#B3B3B3]" />
                    Workspace Members ({(activeWorkspace.members || []).length})
                  </h3>

                  <div className="rounded-2xl overflow-hidden bg-white/30 dark:bg-black/10 border border-white/60 dark:border-[#3A3A3A]/50 backdrop-blur-md">
                    {(activeWorkspace.members || []).map((m, idx) => {
                      const memberUser = m.user || {};
                      const isMemberSelf = memberUser._id === user?._id;
                      const initials = memberUser.name
                        ? memberUser.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                        : '?';

                      return (
                        <div
                          key={memberUser._id || m._id}
                          className={clsx(
                            "p-4 flex items-center justify-between hover:bg-white/40 dark:hover:bg-white/5 transition-colors",
                            idx !== activeWorkspace.members.length - 1 && "border-b border-white/20 dark:border-[#3A3A3A]/30"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-white/60 dark:bg-black/40 flex items-center justify-center text-sm font-bold text-[#2B2B2B] dark:text-white border border-white/60 dark:border-white/10">
                              {initials}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#2B2B2B] dark:text-white flex items-center gap-2">
                                {memberUser.name || 'Member'}
                                {isMemberSelf && <span className="text-[10px] font-bold uppercase tracking-wider text-[#848484] bg-[#E0E0E0]/50 dark:bg-[#1A1A1A] px-2 py-0.5 rounded-full">You</span>}
                              </p>
                              <p className="text-[11px] text-[#565656] dark:text-[#848484] mt-0.5">
                                {memberUser.email || ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className={clsx(
                              "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full",
                              m.role === 'owner' ? "bg-[#2B2B2B] text-white dark:bg-white dark:text-[#2B2B2B]" : "bg-black/5 dark:bg-white/10 text-[#565656] dark:text-[#B3B3B3]"
                            )}>
                              {m.role}
                            </span>

                            {(isOwner || isMemberSelf) && m.role !== 'owner' && (
                              <button
                                onClick={() => handleRemoveMember(memberUser._id)}
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
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create Workspace */}
        <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Workspace" maxWidth="max-w-md">
          <form onSubmit={handleCreateWorkspace} className="space-y-5 py-2">
            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">{actionError}</div>
            )}
            <Input
              label="Workspace Name"
              placeholder="e.g. Project Titan, Family"
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
              <Button variant="ghost" size="md" type="button" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit" isLoading={isSubmitting} className="rounded-xl px-6">
                Create Workspace
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Join Workspace */}
        <Modal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} title="Join Workspace" maxWidth="max-w-md">
          <form onSubmit={handleJoinWorkspace} className="space-y-5 py-2">
            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">{actionError}</div>
            )}
            <Input
              label="Invite Code"
              placeholder="e.g. 9F4A8C2B1D3E"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value)}
              required
              autoFocus
            />
            <p className="text-xs text-[#565656] dark:text-[#848484]">
              Enter the 12-character invite code provided by your workspace admin.
            </p>
            <div className="flex justify-end gap-3 pt-5 mt-2">
              <Button variant="ghost" size="md" type="button" onClick={() => setIsJoinOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit" isLoading={isSubmitting} className="rounded-xl px-6">
                Join Workspace
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Invite Member */}
        <Modal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Invite Member" maxWidth="max-w-md">
          <form onSubmit={handleInviteMember} className="space-y-5 py-2">
            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">{actionError}</div>
            )}
            <Input
              label="Registered User Email"
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
                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1A1A1A] border border-[#E0E0E0] dark:border-[#3A3A3A] text-sm text-[#2B2B2B] dark:text-white focus:outline-none focus:border-[#565656] transition-colors appearance-none"
              >
                <option value="member">Member (Can create, edit & complete tasks)</option>
                <option value="admin">Admin (Can manage members & settings)</option>
                <option value="viewer">Viewer (Read-only access)</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-5 mt-2">
              <Button variant="ghost" size="md" type="button" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit" isLoading={isSubmitting} className="rounded-xl px-6">
                Send Invite
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
};
