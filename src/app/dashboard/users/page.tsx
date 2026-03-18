'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { usersApi, ApiError } from '@/lib/api';
import type { User, CreateUserResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus,
  Loader2,
  AlertCircle,
  UserPlus,
  Check,
  Copy,
  X,
  Eye,
  EyeOff,
  Shield,
  UserIcon,
} from 'lucide-react';

export default function UsersPage() {
  const { user: currentUser, token } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreateUserResponse | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' });

  useEffect(() => {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await usersApi.getAll(token);
      setUsers(data);
    } catch {
      setError('Impossible de charger les utilisateurs');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setError('');
    try {
      const result = await usersApi.create(form, token);
      setCreatedUser(result);
      setForm({ email: '', firstName: '', lastName: '' });
      setShowPassword(false);
      setCopied(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (userId: string) => {
    if (!token) return;
    try {
      await usersApi.toggleActive(userId, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const copyPassword = async () => {
    if (!createdUser) return;
    await navigator.clipboard.writeText(createdUser.generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (currentUser?.role !== 'SUPER_ADMIN') return null;

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Utilisateurs</h1>
          <p className="text-muted-foreground">Gérez les comptes de la plateforme</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setCreatedUser(null); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau compte
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Create user form */}
      {showCreate && !createdUser && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-primary" />
                <CardTitle>Créer un compte</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Un mot de passe sera généré automatiquement. L&apos;utilisateur devra le changer à sa première connexion.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="Jean"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="Dupont"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jean.dupont@entreprise.com"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer le compte
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Created user - show password */}
      {createdUser && (
        <Card className="mb-6 border-green-500/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-500" />
                <CardTitle className="text-green-600">Compte créé</CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setCreatedUser(null); setShowCreate(false); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Transmettez les identifiants ci-dessous à l&apos;utilisateur. Il devra changer son mot de passe à la première connexion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Utilisateur</p>
                <p className="text-sm font-medium">{createdUser.firstName} {createdUser.lastName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Email</p>
                <p className="text-sm font-mono">{createdUser.email}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Mot de passe temporaire</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono">
                    {showPassword ? createdUser.generatedPassword : '••••••••••••'}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={copyPassword}
                    title="Copier"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Ce mot de passe ne sera plus visible une fois cette fenêtre fermée. Copiez-le maintenant.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Users list */}
      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  {u.role === 'SUPER_ADMIN' ? (
                    <Shield className="h-5 w-5 text-primary" />
                  ) : (
                    <UserIcon className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {u.firstName} {u.lastName}
                    {u.id === currentUser?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  u.role === 'SUPER_ADMIN'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {u.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Utilisateur'}
                </span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  u.isActive
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {u.isActive ? 'Actif' : 'Désactivé'}
                </span>
                {u.id !== currentUser?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(u.id)}
                  >
                    {u.isActive ? 'Désactiver' : 'Activer'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
