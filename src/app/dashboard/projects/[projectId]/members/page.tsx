'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Avatar } from '@/components/shell/avatar';
import { useShell } from '@/components/shell/shell-context';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  projectsApi,
  usersApi,
  ApiError,
  type ProjectDetail,
  type ProjectMember,
  type ProjectRole,
  type User,
} from '@/lib/api';
import { PermissionMatrix } from '@/components/permissions/permission-matrix';
import { ArrowLeft, Loader2, UserPlus, Trash2 } from 'lucide-react';

const ROLE_LABELS: Record<ProjectRole, string> = {
  MANAGER: 'Manager',
  PENTESTER: 'Pentester',
  CLIENT: 'Client',
};

export default function MembersPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { token, user: currentUser } = useAuth();
  const { setActiveProject } = useShell();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('PENTESTER');
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const proj = await projectsApi.getOne(projectId, token);
      setProject(proj);
      // Load all users for invite (may fail for non-admins — that's fine)
      try {
        const users = await usersApi.getAll(token);
        setAllUsers(users);
      } catch {
        // non-admin can't list users, invite section won't show
      }
    } catch {
      setError('Impossible de charger les membres');
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (project) {
      setActiveProject({
        id: project.id,
        slug: project.name,
        findingsCount: 0,
      });
    }
    return () => setActiveProject(null);
  }, [project, setActiveProject]);

  const members = project?.members || [];
  const currentMember = members.find((m) => m.user.id === currentUser?.id);
  const isManager =
    currentMember?.role === 'MANAGER' || currentUser?.role === 'SUPER_ADMIN';

  const availableUsers = allUsers.filter(
    (u) => !members.some((m) => m.user.id === u.id),
  );

  const handleInvite = async () => {
    if (!token || !inviteUserId) return;
    setInviting(true);
    setError('');
    try {
      await projectsApi.addMember(projectId, { userId: inviteUserId, role: inviteRole }, token);
      setInviteUserId('');
      setInviteRole('PENTESTER');
      const proj = await projectsApi.getOne(projectId, token);
      setProject(proj);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: ProjectRole) => {
    if (!token) return;
    setError('');
    try {
      await projectsApi.updateMemberRole(projectId, memberId, role, token);
      const proj = await projectsApi.getOne(projectId, token);
      setProject(proj);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!token) return;
    setError('');
    try {
      await projectsApi.removeMember(projectId, memberId, token);
      const proj = await projectsApi.getOne(projectId, token);
      setProject(proj);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 sm:px-8 pt-4 sm:pt-6 pb-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-muted-foreground mb-1"
            onClick={() => router.push(`/dashboard/projects/${projectId}`)}
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            {project?.name || '…'}
          </Button>
          <h1 className="text-2xl font-bold">
            Membres
            <span className="ml-2 text-base font-normal text-muted-foreground font-mono">
              {members.length}
            </span>
          </h1>
        </div>
      </div>

      <div className="px-4 sm:px-8 space-y-6">
        {error && (
          <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {/* Invite */}
        {isManager && availableUsers.length > 0 && (
          <div className="rounded-xl bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Inviter un membre</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={inviteUserId || '__none__'} onValueChange={(v) => setInviteUserId(!v || v === '__none__' ? '' : v)}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Sélectionner un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>Sélectionner un utilisateur</SelectItem>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as ProjectRole)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as ProjectRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                onClick={handleInvite}
                disabled={!inviteUserId || inviting}
              >
                {inviting ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <UserPlus className="mr-1 h-3 w-3" />
                )}
                Inviter
              </Button>
            </div>
          </div>
        )}

        {/* Member list */}
        <div className="rounded-xl bg-card overflow-hidden">
          <div
            className="cap grid gap-3 px-4 py-2 text-[10.5px]"
            style={{ gridTemplateColumns: '1fr 180px 120px 60px' }}
          >
            <div>Membre</div>
            <div>Email</div>
            <div>Rôle</div>
            <div />
          </div>

          {members.map((m) => (
            <div
              key={m.id}
              className="grid gap-3 px-4 py-3 items-center border-t border-border text-sm"
              style={{ gridTemplateColumns: '1fr 180px 120px 60px' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar
                  user={{ id: m.user.id, name: `${m.user.firstName} ${m.user.lastName}` }}
                />
                <span className="truncate font-medium">
                  {m.user.firstName} {m.user.lastName}
                </span>
              </div>

              <div className="text-xs text-muted-foreground truncate">
                {m.user.email}
              </div>

              <div>
                {isManager ? (
                  <Select
                    value={m.role}
                    onValueChange={(v) => handleRoleChange(m.id, v as ProjectRole)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as ProjectRole[]).map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[m.role]}
                  </span>
                )}
              </div>

              <div className="flex justify-end">
                {isManager && m.user.id !== currentUser?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(m.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Permission matrix — managers only */}
        {isManager && token && (
          <div className="rounded-xl bg-card p-4">
            <PermissionMatrix projectId={projectId} token={token} />
          </div>
        )}
      </div>
    </div>
  );
}
