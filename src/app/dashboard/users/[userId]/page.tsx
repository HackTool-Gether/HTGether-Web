'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { usersApi, ApiError } from '@/lib/api';
import type { UserDetail } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Shield,
  UserIcon,
  Save,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  FolderPlus,
  Trash2,
  FileOutput,
  LayoutTemplate,
  Settings,
} from 'lucide-react';
import { generateAvatarSvg } from '@/lib/dicebear';

const PLATFORM_PERMISSIONS = [
  { key: 'projects.create', label: 'Créer des projets', icon: FolderPlus, description: 'Peut créer de nouveaux projets d\'audit' },
  { key: 'projects.delete', label: 'Supprimer ses projets', icon: Trash2, description: 'Peut supprimer les projets qu\'il a créés' },
  { key: 'reports.export', label: 'Exporter des rapports', icon: FileOutput, description: 'Peut exporter les rapports en PDF' },
  { key: 'templates.manage', label: 'Gérer les templates', icon: LayoutTemplate, description: 'Peut créer et modifier les templates de rapport' },
  { key: 'settings.access', label: 'Accéder aux paramètres', icon: Settings, description: 'Peut accéder aux paramètres de la plateforme' },
];

const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  SUPER_ADMIN: {
    'projects.create': true,
    'projects.delete': true,
    'reports.export': true,
    'templates.manage': true,
    'settings.access': true,
  },
  USER: {
    'projects.create': true,
    'projects.delete': false,
    'reports.export': true,
    'templates.manage': false,
    'settings.access': false,
  },
};

function resolvePermissions(role: string, overrides: Record<string, boolean> = {}) {
  const defaults = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.USER;
  return { ...defaults, ...overrides };
}

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const { user: currentUser, token } = useAuth();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editable fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'SUPER_ADMIN' | 'USER'>('USER');
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  // Password reset
  const [resetting, setResetting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await usersApi.getOne(userId, token);
      setUser(data as UserDetail);
      setFirstName(data.firstName);
      setLastName(data.lastName);
      setEmail(data.email);
      setRole(data.role);
      setPermissions(resolvePermissions(data.role, (data as UserDetail).platformPermissions || {}));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Utilisateur introuvable');
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  const handleSave = async () => {
    if (!token || !user) return;
    setSaving(true);
    setError('');
    setSuccess('');

    // Compute permission overrides (diff from role defaults)
    const defaults = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.USER;
    const overrides: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(permissions)) {
      if (defaults[key] !== value) {
        overrides[key] = value;
      }
    }

    try {
      const updated = await usersApi.update(user.id, {
        firstName,
        lastName,
        email,
        role,
        platformPermissions: overrides,
      }, token);
      setUser(updated);
      setPermissions(resolvePermissions(updated.role, updated.platformPermissions || {}));
      setSuccess('Modifications enregistrées');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!token || !user) return;
    setResetting(true);
    setError('');
    try {
      const result = await usersApi.resetPassword(user.id, token);
      setGeneratedPassword(result.generatedPassword);
      setShowPassword(false);
      setCopied(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors du reset');
    } finally {
      setResetting(false);
    }
  };

  const copyPassword = async () => {
    if (!generatedPassword) return;
    await navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRoleChange = (newRole: 'SUPER_ADMIN' | 'USER') => {
    setRole(newRole);
    setPermissions(resolvePermissions(newRole, {}));
  };

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isSelf = currentUser?.id === userId;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || currentUser?.role !== 'SUPER_ADMIN') return null;

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-muted-foreground mb-2"
          onClick={() => router.push('/dashboard/users')}
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Utilisateurs
        </Button>
        <div className="flex items-center gap-4">
          {user.avatarStyle && user.avatarSeed ? (
            <div
              className="h-12 w-12 rounded-full overflow-hidden bg-secondary"
              dangerouslySetInnerHTML={{ __html: generateAvatarSvg(user.avatarStyle, user.avatarSeed, (user as any).avatarOptions || {}) }}
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {user.role === 'SUPER_ADMIN' ? (
                <Shield className="h-6 w-6 text-primary" />
              ) : (
                <UserIcon className="h-6 w-6 text-primary" />
              )}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {user.firstName} {user.lastName}
              {isSelf && <span className="ml-2 text-sm text-muted-foreground font-normal">(vous)</span>}
            </h1>
            <p className="text-muted-foreground text-sm">{user.email}</p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-500/30 bg-green-500/5">
          <Check className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )}

      {/* User info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Informations</CardTitle>
          <CardDescription>Modifiez les informations du compte</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prénom</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Rôle plateforme</Label>
            <Select value={role} onValueChange={(v) => handleRoleChange(v as 'SUPER_ADMIN' | 'USER')} disabled={isSelf}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPER_ADMIN">
                  <span className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    Super Admin
                  </span>
                </SelectItem>
                <SelectItem value="USER">
                  <span className="flex items-center gap-2">
                    <UserIcon className="h-3.5 w-3.5" />
                    Utilisateur
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {isSelf && (
              <p className="text-xs text-muted-foreground">Vous ne pouvez pas modifier votre propre rôle</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Permissions plateforme</CardTitle>
          <CardDescription>
            {role === 'SUPER_ADMIN'
              ? 'Les super admins ont toutes les permissions par défaut. Vous pouvez en restreindre certaines.'
              : 'Configurez les permissions de cet utilisateur sur la plateforme.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {PLATFORM_PERMISSIONS.map(({ key, label, icon: Icon, description }) => (
              <div
                key={key}
                className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{description}</div>
                  </div>
                </div>
                <Switch
                  checked={permissions[key] ?? false}
                  onCheckedChange={() => togglePermission(key)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end mb-8">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Enregistrer
        </Button>
      </div>

      {/* Password reset */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Mot de passe
          </CardTitle>
          <CardDescription>
            Générez un nouveau mot de passe temporaire. L&apos;utilisateur devra le changer à sa prochaine connexion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {generatedPassword ? (
            <>
              <div className="rounded-lg bg-secondary p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Nouveau mot de passe</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md bg-background px-3 py-2 text-sm font-mono">
                    {showPassword ? generatedPassword : '••••••••••••'}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={copyPassword}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Ce mot de passe ne sera plus visible une fois la page quittée.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <Button variant="outline" onClick={handleResetPassword} disabled={resetting}>
              {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Réinitialiser le mot de passe
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Projects membership */}
      {user.projectMembers && user.projectMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projets</CardTitle>
            <CardDescription>Projets auxquels cet utilisateur participe</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {user.projectMembers.map((pm) => (
                <div
                  key={pm.project.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => router.push(`/dashboard/projects/${pm.project.id}`)}
                >
                  <div>
                    <div className="text-sm font-medium">{pm.project.name}</div>
                    <div className="text-xs text-muted-foreground">{pm.project.clientCompany}</div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    pm.role === 'MANAGER'
                      ? 'bg-primary/10 text-primary'
                      : pm.role === 'PENTESTER'
                        ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {pm.role === 'MANAGER' ? 'Manager' : pm.role === 'PENTESTER' ? 'Pentester' : 'Client'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
