'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { settingsApi, authProvidersApi, ApiError } from '@/lib/api';
import type { AuthProviderFull } from '@/lib/api';
import { useThemePreference } from '@/lib/theme-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
  Building2,
  KeyRound,
  Brain,
  Mail,
  AlertCircle,
  Loader2,
  Check,
  Copy,
  Globe,
  Github,
  Server,
  Save,
  Trash2,
  Plus,
  Sun,
} from 'lucide-react';

const ADMIN_TABS = [
  { id: 'preferences', label: 'Preferences', icon: Sun },
  { id: 'company', label: 'Entreprise', icon: Building2 },
  { id: 'auth', label: 'Authentification', icon: KeyRound },
  { id: 'ai', label: 'Module IA', icon: Brain },
  { id: 'email', label: 'Email', icon: Mail },
] as const;

const USER_TABS = [
  { id: 'preferences', label: 'Preferences', icon: Sun },
] as const;

type TabId = 'preferences' | 'company' | 'auth' | 'ai' | 'email';

const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', description: 'GPT-4, GPT-4o', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude 4', models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'] },
  { id: 'gemini', name: 'Google Gemini', description: 'Gemini Pro, Ultra', models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro'] },
  { id: 'mistral', name: 'Mistral AI', description: 'Mistral Large, Medium', models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'] },
];

const SSO_PRESETS = [
  { id: 'GOOGLE', name: 'Google', icon: Globe },
  { id: 'GITHUB', name: 'GitHub', icon: Github },
  { id: 'AZURE_AD', name: 'Azure AD', icon: Server },
];

export default function SettingsPage() {
  const { user, token } = useAuth();
  const { isWhiteMode, toggleWhiteMode } = useThemePreference();
  const [activeTab, setActiveTab] = useState<TabId>('preferences');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Company state
  const [company, setCompany] = useState({ name: '', domain: '' });

  // Auth providers state
  const [authProvidersList, setAuthProvidersList] = useState<AuthProviderFull[]>([]);

  // AI state
  const [ai, setAi] = useState({ enabled: false, provider: '', apiKey: '', model: '' });

  // Email state
  const [emailProvider, setEmailProvider] = useState<'none' | 'smtp' | 'mailgun'>('none');
  const [smtp, setSmtp] = useState({
    host: '', port: 587, user: '', password: '', fromEmail: '', fromName: '', secure: false,
  });
  const [mailgun, setMailgun] = useState({
    apiKey: '', domain: '', fromEmail: '', fromName: '',
  });

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/login`
    : 'https://your-domain.com/login';

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const visibleTabs = isSuperAdmin ? ADMIN_TABS : USER_TABS;

  const loadSettings = useCallback(async () => {
    if (!token || !user) return;

    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [allSettings, providers] = await Promise.all([
        settingsApi.getAll(token),
        authProvidersApi.getAll(token),
      ]);

      // Company
      if (allSettings.company) {
        setCompany({
          name: allSettings.company.name || '',
          domain: allSettings.company.domain || '',
        });
      }

      // Auth providers
      setAuthProvidersList(providers);

      // AI
      if (allSettings.ai) {
        setAi({
          enabled: !!allSettings.ai.enabled,
          provider: allSettings.ai.provider || '',
          apiKey: allSettings.ai.apiKey || '',
          model: allSettings.ai.model || '',
        });
      }

      // Email
      if (allSettings.smtp) {
        if (allSettings.smtp.enabled) {
          const smtpSettings = allSettings.smtp;
          if (smtpSettings.provider === 'mailgun') {
            setEmailProvider('mailgun');
            setMailgun({
              apiKey: smtpSettings.apiKey || '',
              domain: smtpSettings.domain || '',
              fromEmail: smtpSettings.fromEmail || '',
              fromName: smtpSettings.fromName || '',
            });
          } else {
            setEmailProvider('smtp');
            setSmtp({
              host: smtpSettings.host || '',
              port: smtpSettings.port || 587,
              user: smtpSettings.user || '',
              password: smtpSettings.password || '',
              fromEmail: smtpSettings.fromEmail || '',
              fromName: smtpSettings.fromName || '',
              secure: smtpSettings.secure || false,
            });
          }
        } else {
          setEmailProvider('none');
        }
      }
    } catch {
      setError('Impossible de charger les paramètres');
    } finally {
      setLoading(false);
    }
  }, [token, user, isSuperAdmin]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!isSuperAdmin && activeTab !== 'preferences') {
      setActiveTab('preferences');
    }
  }, [isSuperAdmin, activeTab]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 3000);
  };

  const copyCallbackUrl = async (id: string) => {
    await navigator.clipboard.writeText(callbackUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --- Save handlers ---

  const saveCompany = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await settingsApi.update('company', company, token);
      showSuccess('Paramètres entreprise sauvegardés');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const saveAi = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await settingsApi.update('ai', {
        enabled: ai.enabled,
        provider: ai.provider || null,
        apiKey: ai.apiKey || null,
        model: ai.model || null,
      }, token);
      showSuccess('Paramètres IA sauvegardés');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const saveEmail = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const value = emailProvider === 'smtp'
        ? { enabled: true, provider: 'smtp', ...smtp }
        : emailProvider === 'mailgun'
          ? { enabled: true, provider: 'mailgun', ...mailgun }
          : { enabled: false };
      await settingsApi.update('smtp', value, token);
      showSuccess('Paramètres email sauvegardés');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // --- Auth provider handlers ---

  const toggleProvider = async (provider: AuthProviderFull) => {
    if (!token) return;
    try {
      const updated = await authProvidersApi.update(
        provider.id,
        { isEnabled: !provider.isEnabled },
        token,
      );
      setAuthProvidersList((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const updateProviderConfig = async (provider: AuthProviderFull, config: Record<string, any>) => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const updated = await authProvidersApi.update(
        provider.id,
        { config: { ...provider.config, ...config } },
        token,
      );
      setAuthProvidersList((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
      showSuccess(`Provider ${provider.name} mis à jour`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const deleteProvider = async (provider: AuthProviderFull) => {
    if (!token) return;
    try {
      await authProvidersApi.remove(provider.id, token);
      setAuthProvidersList((prev) => prev.filter((p) => p.id !== provider.id));
      showSuccess(`Provider ${provider.name} supprimé`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const addSsoProvider = async (presetId: string) => {
    if (!token) return;
    const preset = SSO_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const issuerUrls: Record<string, string> = {
      GOOGLE: 'https://accounts.google.com',
      GITHUB: 'https://token.actions.githubusercontent.com',
      AZURE_AD: 'https://login.microsoftonline.com/common/v2.0',
    };

    try {
      const created = await authProvidersApi.create(
        {
          type: 'OIDC',
          name: preset.name,
          isEnabled: false,
          config: {
            issuerUrl: issuerUrls[presetId],
            scope: 'openid email profile',
            clientId: '',
            clientSecret: '',
          },
          displayOrder: 5,
        },
        token,
      );
      setAuthProvidersList((prev) => [...prev, created]);
      showSuccess(`Provider ${preset.name} ajouté`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  };

  const addLdapProvider = async () => {
    if (!token) return;
    try {
      const created = await authProvidersApi.create(
        {
          type: 'LDAP',
          name: 'LDAP',
          isEnabled: false,
          config: { url: '', baseDn: '', bindDn: '', bindPassword: '' },
          displayOrder: 8,
        },
        token,
      );
      setAuthProvidersList((prev) => [...prev, created]);
      showSuccess('Provider LDAP ajouté');
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

  const localProvider = authProvidersList.find((p) => p.type === 'LOCAL');
  const oidcProviders = authProvidersList.filter((p) => p.type === 'OIDC');
  const ldapProviders = authProvidersList.filter((p) => p.type === 'LDAP');

  // Figure out which SSO presets aren't added yet
  const existingOidcNames = oidcProviders.map((p) => p.name);
  const availablePresets = SSO_PRESETS.filter((p) => !existingOidcNames.includes(p.name));

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">
          {isSuperAdmin
            ? 'Gerez la configuration de votre plateforme'
            : 'Gerez vos preferences personnelles'}
        </p>
      </div>

      {/* Feedback */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-6 border-green-500/50 text-green-600">
          <Check className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border p-1 mb-6">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setError(''); setSuccess(''); }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ===== TAB: Preferences ===== */}
      {activeTab === 'preferences' && (
        <Card>
          <CardHeader>
            <CardTitle>Preferences d'affichage</CardTitle>
            <CardDescription>Personnalisez le mode visuel de la plateforme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="whiteMode" className="text-sm font-medium">White mode</Label>
                <p className="text-sm text-muted-foreground">
                  Active une interface claire
                </p>
              </div>
              <Switch
                id="whiteMode"
                checked={isWhiteMode}
                onCheckedChange={toggleWhiteMode}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== TAB: Entreprise ===== */}
      {isSuperAdmin && activeTab === 'company' && (
        <Card>
          <CardHeader>
            <CardTitle>Informations entreprise</CardTitle>
            <CardDescription>Utilisées pour le branding de la plateforme et des rapports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nom de l&apos;entreprise</Label>
              <Input
                id="companyName"
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                placeholder="CyberSec Corp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyDomain">Domaine (optionnel)</Label>
              <Input
                id="companyDomain"
                value={company.domain}
                onChange={(e) => setCompany({ ...company, domain: e.target.value })}
                placeholder="cybersec-corp.com"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={saveCompany} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Sauvegarder
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== TAB: Authentification ===== */}
      {isSuperAdmin && activeTab === 'auth' && (
        <div className="space-y-4">
          {/* Local provider */}
          {localProvider && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Email & Mot de passe</p>
                      <p className="text-xs text-muted-foreground">Authentification locale classique</p>
                    </div>
                  </div>
                  <Switch
                    checked={localProvider.isEnabled}
                    onCheckedChange={() => toggleProvider(localProvider)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Le super admin peut toujours se connecter avec ses identifiants, même si ce mode est désactivé.
                </p>
              </CardContent>
            </Card>
          )}

          {/* OIDC providers */}
          {oidcProviders.map((provider) => (
            <OidcProviderCard
              key={provider.id}
              provider={provider}
              callbackUrl={callbackUrl}
              copiedId={copiedId}
              saving={saving}
              onToggle={() => toggleProvider(provider)}
              onCopy={() => copyCallbackUrl(provider.id)}
              onSaveConfig={(config) => updateProviderConfig(provider, config)}
              onDelete={() => deleteProvider(provider)}
            />
          ))}

          {/* LDAP providers */}
          {ldapProviders.map((provider) => (
            <LdapProviderCard
              key={provider.id}
              provider={provider}
              saving={saving}
              onToggle={() => toggleProvider(provider)}
              onSaveConfig={(config) => updateProviderConfig(provider, config)}
              onDelete={() => deleteProvider(provider)}
            />
          ))}

          {/* Add provider buttons */}
          {(availablePresets.length > 0 || ldapProviders.length === 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ajouter un provider</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {availablePresets.map((preset) => {
                    const Icon = preset.icon;
                    return (
                      <Button
                        key={preset.id}
                        variant="outline"
                        size="sm"
                        onClick={() => addSsoProvider(preset.id)}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        <Icon className="mr-1.5 h-3.5 w-3.5" />
                        {preset.name}
                      </Button>
                    );
                  })}
                  {ldapProviders.length === 0 && (
                    <Button variant="outline" size="sm" onClick={addLdapProvider}>
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      <Server className="mr-1.5 h-3.5 w-3.5" />
                      LDAP
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===== TAB: Module IA ===== */}
      {isSuperAdmin && activeTab === 'ai' && (
        <Card>
          <CardHeader>
            <CardTitle>Module IA</CardTitle>
            <CardDescription>Assistance à la rédaction, suggestions de remédiation, analyse</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Activer le module IA</p>
                <p className="text-sm text-muted-foreground">
                  Utilise l&apos;IA pour assister les pentesters
                </p>
              </div>
              <Switch
                checked={ai.enabled}
                onCheckedChange={(checked) => setAi({ ...ai, enabled: checked })}
              />
            </div>

            {ai.enabled && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {AI_PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => setAi({ ...ai, provider: provider.id, model: provider.models[0] })}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        ai.provider === provider.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-muted-foreground/30'
                      }`}
                    >
                      <p className="font-medium text-sm">{provider.name}</p>
                      <p className="text-xs text-muted-foreground">{provider.description}</p>
                    </button>
                  ))}
                </div>

                {ai.provider && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="aiApiKey">Clé API</Label>
                      <Input
                        id="aiApiKey"
                        type="password"
                        value={ai.apiKey}
                        onChange={(e) => setAi({ ...ai, apiKey: e.target.value })}
                        placeholder={`Votre clé API ${AI_PROVIDERS.find((p) => p.id === ai.provider)?.name}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Modèle</Label>
                      <Select value={ai.model} onValueChange={(val) => { if (val) setAi({ ...ai, model: val }); }}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AI_PROVIDERS.find((p) => p.id === ai.provider)?.models.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={saveAi} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Sauvegarder
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== TAB: Email ===== */}
      {isSuperAdmin && activeTab === 'email' && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration email</CardTitle>
            <CardDescription>Notifications, invitations et alertes par email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provider selection */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setEmailProvider('none')}
                className={`rounded-lg border p-4 text-center transition-colors ${
                  emailProvider === 'none'
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/30'
                }`}
              >
                <p className="font-medium text-sm">Désactivé</p>
                <p className="text-xs text-muted-foreground">Pas d&apos;email</p>
              </button>
              <button
                onClick={() => setEmailProvider('smtp')}
                className={`rounded-lg border p-4 text-center transition-colors ${
                  emailProvider === 'smtp'
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/30'
                }`}
              >
                <p className="font-medium text-sm">SMTP</p>
                <p className="text-xs text-muted-foreground">Serveur classique</p>
              </button>
              <button
                onClick={() => setEmailProvider('mailgun')}
                className={`rounded-lg border p-4 text-center transition-colors ${
                  emailProvider === 'mailgun'
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/30'
                }`}
              >
                <p className="font-medium text-sm">Mailgun</p>
                <p className="text-xs text-muted-foreground">API Mailgun</p>
              </button>
            </div>

            {/* SMTP config */}
            {emailProvider === 'smtp' && (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Serveur SMTP</Label>
                    <Input
                      value={smtp.host}
                      onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Port</Label>
                    <Input
                      type="number"
                      value={smtp.port}
                      onChange={(e) => setSmtp({ ...smtp, port: parseInt(e.target.value) || 587 })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Utilisateur</Label>
                    <Input
                      value={smtp.user}
                      onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                      placeholder="user@gmail.com"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mot de passe</Label>
                    <Input
                      type="password"
                      value={smtp.password}
                      onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                      placeholder="••••••••"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Email expéditeur</Label>
                    <Input
                      value={smtp.fromEmail}
                      onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
                      placeholder="noreply@entreprise.com"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nom expéditeur</Label>
                    <Input
                      value={smtp.fromName}
                      onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })}
                      placeholder="HTGether"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="smtpSecure"
                    checked={smtp.secure}
                    onCheckedChange={(checked) => setSmtp({ ...smtp, secure: checked === true })}
                  />
                  <Label htmlFor="smtpSecure" className="text-sm">Connexion SSL/TLS</Label>
                </div>
              </div>
            )}

            {/* Mailgun config */}
            {emailProvider === 'mailgun' && (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="space-y-1">
                  <Label className="text-xs">API Key</Label>
                  <Input
                    type="password"
                    value={mailgun.apiKey}
                    onChange={(e) => setMailgun({ ...mailgun, apiKey: e.target.value })}
                    placeholder="key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Domaine Mailgun</Label>
                  <Input
                    value={mailgun.domain}
                    onChange={(e) => setMailgun({ ...mailgun, domain: e.target.value })}
                    placeholder="mg.domain.com"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Email expéditeur</Label>
                    <Input
                      value={mailgun.fromEmail}
                      onChange={(e) => setMailgun({ ...mailgun, fromEmail: e.target.value })}
                      placeholder="no-reply@domain.com"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nom expéditeur</Label>
                    <Input
                      value={mailgun.fromName}
                      onChange={(e) => setMailgun({ ...mailgun, fromName: e.target.value })}
                      placeholder="HTGether"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={saveEmail} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Sauvegarder
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Sub-components ---

function OidcProviderCard({
  provider,
  callbackUrl,
  copiedId,
  saving,
  onToggle,
  onCopy,
  onSaveConfig,
  onDelete,
}: {
  provider: AuthProviderFull;
  callbackUrl: string;
  copiedId: string | null;
  saving: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onSaveConfig: (config: Record<string, any>) => void;
  onDelete: () => void;
}) {
  const config = provider.config as Record<string, any>;
  const [clientId, setClientId] = useState(config.clientId || '');
  const [clientSecret, setClientSecret] = useState(config.clientSecret || '');

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">{provider.name}</p>
              <p className="text-xs text-muted-foreground">SSO via {provider.name} (OIDC)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={provider.isEnabled} onCheckedChange={onToggle} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Callback URL */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Callback URL (à copier dans la console {provider.name})
          </Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-xs font-mono text-muted-foreground select-all truncate">
              {callbackUrl}
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={onCopy}>
              {copiedId === provider.id ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Config */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Client ID</Label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Votre Client ID"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Client Secret</Label>
            <Input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Votre Client Secret"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => onSaveConfig({ clientId, clientSecret })}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
            Sauvegarder
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LdapProviderCard({
  provider,
  saving,
  onToggle,
  onSaveConfig,
  onDelete,
}: {
  provider: AuthProviderFull;
  saving: boolean;
  onToggle: () => void;
  onSaveConfig: (config: Record<string, any>) => void;
  onDelete: () => void;
}) {
  const config = provider.config as Record<string, any>;
  const [url, setUrl] = useState(config.url || '');
  const [baseDn, setBaseDn] = useState(config.baseDn || '');
  const [bindDn, setBindDn] = useState(config.bindDn || '');
  const [bindPassword, setBindPassword] = useState(config.bindPassword || '');

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">LDAP / Active Directory</p>
              <p className="text-xs text-muted-foreground">Authentification LDAP</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={provider.isEnabled} onCheckedChange={onToggle} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">URL du serveur</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ldap://ldap.entreprise.com"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Base DN</Label>
            <Input
              value={baseDn}
              onChange={(e) => setBaseDn(e.target.value)}
              placeholder="dc=entreprise,dc=com"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Bind DN (optionnel)</Label>
            <Input
              value={bindDn}
              onChange={(e) => setBindDn(e.target.value)}
              placeholder="cn=admin,dc=..."
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bind Password</Label>
            <Input
              type="password"
              value={bindPassword}
              onChange={(e) => setBindPassword(e.target.value)}
              placeholder="••••••••"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => onSaveConfig({ url, baseDn, bindDn, bindPassword })}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
            Sauvegarder
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
