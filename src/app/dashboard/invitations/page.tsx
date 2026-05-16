'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { invitationsApi, ApiError, type Invitation } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/shell/avatar';
import { useShell } from '@/components/shell/shell-context';
import { Loader2, Check, X, Mail } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  MANAGER: 'Manager',
  PENTESTER: 'Pentester',
  CLIENT: 'Client',
};

export default function InvitationsPage() {
  const { token } = useAuth();
  const { refreshProjects } = useShell();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await invitationsApi.getMine(token);
      setInvitations(data);
    } catch {
      setError('Impossible de charger les invitations');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async (id: string) => {
    if (!token) return;
    setProcessing(id);
    setError('');
    try {
      await invitationsApi.accept(id, token);
      await load();
      refreshProjects();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (id: string) => {
    if (!token) return;
    setProcessing(id);
    setError('');
    try {
      await invitationsApi.decline(id, token);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setProcessing(null);
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
      <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-4">
        <h1 className="text-2xl font-bold">
          Invitations
          {invitations.length > 0 && (
            <span className="ml-2 text-base font-normal text-muted-foreground font-mono">
              {invitations.length}
            </span>
          )}
        </h1>
      </div>

      <div className="px-4 sm:px-8 space-y-4">
        {error && (
          <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Mail className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Aucune invitation en attente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl bg-card p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent), oklch(from var(--accent) calc(l - 0.1) c h))',
                      color: 'white',
                    }}
                  >
                    {inv.project?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {inv.project?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {inv.project?.clientCompany && (
                        <span>{inv.project.clientCompany} &middot; </span>
                      )}
                      Rôle : {ROLE_LABELS[inv.role] || inv.role}
                      {inv.invitedBy && (
                        <span> &middot; Par {inv.invitedBy.firstName} {inv.invitedBy.lastName}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDecline(inv.id)}
                    disabled={processing === inv.id}
                  >
                    {processing === inv.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <X className="mr-1 h-3 w-3" />
                    )}
                    Refuser
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(inv.id)}
                    disabled={processing === inv.id}
                  >
                    {processing === inv.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-3 w-3" />
                    )}
                    Accepter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
