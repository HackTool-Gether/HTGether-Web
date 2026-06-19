'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { settingsApi, authProvidersApi, knowledgeBaseApi, ApiError } from '@/lib/api';
import type { KBEntry, AllowedDomain } from '@/lib/api';
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
  BookOpen,
  Library,
  Upload,
  FileText,
  Pencil,
  X,
} from 'lucide-react';

const ADMIN_TABS = [
  { id: 'preferences', label: 'Preferences', icon: Sun },
  { id: 'kb', label: 'Ma base de connaissances', icon: BookOpen },
  { id: 'company', label: 'Entreprise', icon: Building2 },
  { id: 'auth', label: 'Authentification', icon: KeyRound },
  { id: 'ai', label: 'Module IA', icon: Brain },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'kb-enterprise', label: 'KB Entreprise', icon: Library },
] as const;

const USER_TABS = [
  { id: 'preferences', label: 'Preferences', icon: Sun },
  { id: 'kb', label: 'Ma base de connaissances', icon: BookOpen },
] as const;

type TabId = 'preferences' | 'company' | 'auth' | 'ai' | 'email' | 'kb' | 'kb-enterprise';

const AI_PROVIDERS = [
  { id: 'openrouter', name: 'OpenRouter', description: 'Tous les modèles', models: [] as string[] },
  { id: 'openai', name: 'OpenAI', description: 'GPT-4o, GPT-5', models: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o3-mini', 'o4-mini'] },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude 4', models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] },
  { id: 'gemini', name: 'Google Gemini', description: 'Gemini 2.5, 2.0', models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-pro'] },
  { id: 'mistral', name: 'Mistral AI', description: 'Mistral Large, Medium', models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest'] },
];

const SSO_PRESETS = [
  { id: 'GOOGLE', name: 'Google', icon: Globe },
  { id: 'GITHUB', name: 'GitHub', icon: Github },
  { id: 'AZURE_AD', name: 'Azure AD', icon: Server },
];

export default function SettingsPage() {
  const { user, token } = useAuth();
  const { preference, setPreference } = useThemePreference();
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

  // KB state
  const [kbEntries, setKbEntries] = useState<KBEntry[]>([]);
  const [kbEnterpriseEntries, setKbEnterpriseEntries] = useState<KBEntry[]>([]);
  const [kbForm, setKbForm] = useState({ title: '', content: '' });
  const [kbEnterpriseForm, setKbEnterpriseForm] = useState({ title: '', content: '' });
  const [showKbForm, setShowKbForm] = useState(false);
  const [showKbEnterpriseForm, setShowKbEnterpriseForm] = useState(false);
  const [editingKbId, setEditingKbId] = useState<string | null>(null);
  const [editingKbEnterpriseId, setEditingKbEnterpriseId] = useState<string | null>(null);

  // Allowed domains state
  const [allowedDomains, setAllowedDomains] = useState<AllowedDomain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [domainError, setDomainError] = useState('');

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/login`
    : 'https://your-domain.com/login';

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const visibleTabs = isSuperAdmin ? ADMIN_TABS : USER_TABS;

  const loadKbEntries = useCallback(async () => {
    if (!token) return;
    try {
      const entries = await knowledgeBaseApi.getMine(token);
      setKbEntries(entries);
      if (isSuperAdmin) {
        const enterprise = await knowledgeBaseApi.getEnterprise(token);
        setKbEnterpriseEntries(enterprise);
      }
    } catch { /* ignore */ }
  }, [token, isSuperAdmin]);

  const loadSettings = useCallback(async () => {
    if (!token || !user) return;

    loadKbEntries();

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

      // Allowed domains
      settingsApi.getAllowedDomains(token).then(setAllowedDomains).catch(() => {});

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
  }, [token, user, isSuperAdmin, loadKbEntries]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!isSuperAdmin && activeTab !== 'preferences' && activeTab !== 'kb') {
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

  const addDomain = async () => {
    if (!newDomain.trim() || !token) return;
    setDomainError('');
    try {
      await settingsApi.addAllowedDomain(newDomain.trim(), token);
      setNewDomain('');
      const domains = await settingsApi.getAllowedDomains(token);
      setAllowedDomains(domains);
      showSuccess('Domaine ajouté');
    } catch (err) {
      setDomainError(err instanceof ApiError ? err.message : "Impossible d'ajouter ce domaine");
    }
  };

  const removeDomain = async (id: string) => {
    if (!token) return;
    try {
      await settingsApi.deleteAllowedDomain(id, token);
      setAllowedDomains(prev => prev.filter(d => d.id !== id));
      showSuccess('Domaine supprimé');
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
    <div className="p-8">
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
        <Alert className="mb-6 bg-green-500/10 text-green-500">
          <Check className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-secondary p-1 mb-6">
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
            <CardTitle>Apparence</CardTitle>
            <CardDescription>Choisissez le thème de la plateforme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: 'system' as const, label: 'Système', desc: 'Suit les préférences OS' },
                { value: 'dark' as const, label: 'Sombre', desc: 'Thème sombre' },
                { value: 'light' as const, label: 'Clair', desc: 'Thème clair' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPreference(opt.value)}
                  className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors"
                  style={{
                    borderColor: preference === opt.value ? 'var(--accent)' : 'var(--border)',
                    background: preference === opt.value ? 'var(--accent-tint)' : 'var(--bg-subtle)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <div
                    className="w-full h-16 rounded-md border overflow-hidden"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      background: opt.value === 'dark'
                        ? '#010102'
                        : opt.value === 'light'
                          ? '#ffffff'
                          : 'linear-gradient(135deg, #010102 50%, #ffffff 50%)',
                    }}
                  >
                    <div className="flex flex-col gap-1 p-2">
                      <div
                        className="h-1.5 w-8 rounded-full"
                        style={{
                          background: opt.value === 'light'
                            ? '#d8dbe0'
                            : '#23252a',
                        }}
                      />
                      <div
                        className="h-1.5 w-12 rounded-full"
                        style={{
                          background: opt.value === 'light'
                            ? '#d8dbe0'
                            : '#23252a',
                        }}
                      />
                      <div
                        className="h-1.5 w-6 rounded-full"
                        style={{
                          background: opt.value === 'light'
                            ? '#d8dbe0'
                            : '#23252a',
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                  </div>
                </button>
              ))}
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

          {/* Allowed domains */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-sm">Domaines autorisés</CardTitle>
                  <CardDescription>Auto-inscription pour les emails de ces domaines</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newDomain}
                  onChange={(e) => { setNewDomain(e.target.value); if (domainError) setDomainError(''); }}
                  placeholder="acme.com ou *.acme.com"
                  aria-invalid={!!domainError}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDomain())}
                  className="flex-1"
                />
                <Button onClick={addDomain} size="sm" disabled={!newDomain.trim()}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Ajouter
                </Button>
              </div>
              {domainError ? (
                <p className="text-xs text-destructive">{domainError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Domaine exact (<span className="font-mono">acme.com</span>) ou joker de sous-domaines
                  (<span className="font-mono">*.acme.com</span>).
                </p>
              )}
              {allowedDomains.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {allowedDomains.map((d) => (
                    <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm">
                      {d.pattern}
                      <button onClick={() => removeDomain(d.id)} className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Aucun domaine configuré. L&apos;auto-inscription est désactivée.</p>
              )}
            </CardContent>
          </Card>

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
            <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
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
                      onClick={() => setAi({ ...ai, provider: provider.id, model: provider.models[0] || '' })}
                      className={`rounded-lg p-4 text-left transition-colors cursor-pointer ${
                        ai.provider === provider.id
                          ? 'bg-primary/10'
                          : 'bg-secondary hover:bg-secondary/70'
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
                      {AI_PROVIDERS.find((p) => p.id === ai.provider)?.models.length === 0 ? (
                        <Input value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} placeholder="ex: anthropic/claude-sonnet-4-6" />
                      ) : (
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
                      )}
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
                className={`rounded-lg p-4 text-center transition-colors ${
                  emailProvider === 'none'
                    ? 'bg-primary/10'
                    : 'bg-secondary hover:bg-secondary/70'
                }`}
              >
                <p className="font-medium text-sm">Désactivé</p>
                <p className="text-xs text-muted-foreground">Pas d&apos;email</p>
              </button>
              <button
                onClick={() => setEmailProvider('smtp')}
                className={`rounded-lg p-4 text-center transition-colors ${
                  emailProvider === 'smtp'
                    ? 'bg-primary/10'
                    : 'bg-secondary hover:bg-secondary/70'
                }`}
              >
                <p className="font-medium text-sm">SMTP</p>
                <p className="text-xs text-muted-foreground">Serveur classique</p>
              </button>
              <button
                onClick={() => setEmailProvider('mailgun')}
                className={`rounded-lg p-4 text-center transition-colors ${
                  emailProvider === 'mailgun'
                    ? 'bg-primary/10'
                    : 'bg-secondary hover:bg-secondary/70'
                }`}
              >
                <p className="font-medium text-sm">Mailgun</p>
                <p className="text-xs text-muted-foreground">API Mailgun</p>
              </button>
            </div>

            {/* SMTP config */}
            {emailProvider === 'smtp' && (
              <div className="space-y-3 rounded-lg bg-secondary p-4">
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
              <div className="space-y-3 rounded-lg bg-secondary p-4">
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

      {/* ===== TAB: Ma base de connaissances ===== */}
      {activeTab === 'kb' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Ma base de connaissances</CardTitle>
                <CardDescription>Fiches et documents personnels utilisés comme contexte par l&apos;IA</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.md,.txt'; input.onchange = async (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file && token) { try { await knowledgeBaseApi.uploadMine(file, token); loadKbEntries(); showSuccess('Fichier importé'); } catch { setError('Échec de l\'import'); } } }; input.click(); }}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importer
                </Button>
                <Button size="sm" onClick={() => { setShowKbForm(true); setKbForm({ title: '', content: '' }); setEditingKbId(null); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showKbForm && (
              <div className="space-y-3 rounded-lg border p-4">
                <Input placeholder="Titre de la fiche" value={kbForm.title} onChange={(e) => setKbForm({ ...kbForm, title: e.target.value })} />
                <textarea className="w-full min-h-[120px] rounded-lg border bg-transparent p-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Contenu (markdown supporté)" value={kbForm.content} onChange={(e) => setKbForm({ ...kbForm, content: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setShowKbForm(false); setEditingKbId(null); }}>Annuler</Button>
                  <Button size="sm" disabled={!kbForm.title.trim()} onClick={async () => {
                    if (!token) return;
                    try {
                      if (editingKbId) { await knowledgeBaseApi.update(editingKbId, kbForm, token); }
                      else { await knowledgeBaseApi.createMine(kbForm, token); }
                      loadKbEntries(); setShowKbForm(false); setEditingKbId(null); showSuccess(editingKbId ? 'Fiche modifiée' : 'Fiche créée');
                    } catch { setError('Erreur lors de la sauvegarde'); }
                  }}>{editingKbId ? 'Modifier' : 'Créer'}</Button>
                </div>
              </div>
            )}

            {kbEntries.length === 0 && !showKbForm && (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Aucune fiche personnelle</p>
                <p className="text-xs mt-1">Ajoutez des fiches pour enrichir le contexte IA</p>
              </div>
            )}

            {kbEntries.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between rounded-lg border p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{entry.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${entry.type === 'file' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {entry.type === 'file' ? entry.fileName : 'texte'}
                    </span>
                  </div>
                  {entry.content && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.content.slice(0, 200)}</p>}
                </div>
                <div className="flex gap-1 ml-2">
                  {entry.type === 'text' && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setKbForm({ title: entry.title, content: entry.content }); setEditingKbId(entry.id); setShowKbForm(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={async () => { if (!token) return; try { await knowledgeBaseApi.remove(entry.id, token); loadKbEntries(); showSuccess('Fiche supprimée'); } catch { setError('Erreur lors de la suppression'); } }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ===== TAB: KB Entreprise ===== */}
      {isSuperAdmin && activeTab === 'kb-enterprise' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Base de connaissances entreprise</CardTitle>
                <CardDescription>Partagée avec tous les utilisateurs comme contexte IA</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.md,.txt'; input.onchange = async (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file && token) { try { await knowledgeBaseApi.uploadEnterprise(file, token); loadKbEntries(); showSuccess('Fichier importé'); } catch { setError('Échec de l\'import'); } } }; input.click(); }}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importer
                </Button>
                <Button size="sm" onClick={() => { setShowKbEnterpriseForm(true); setKbEnterpriseForm({ title: '', content: '' }); setEditingKbEnterpriseId(null); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showKbEnterpriseForm && (
              <div className="space-y-3 rounded-lg border p-4">
                <Input placeholder="Titre de la fiche" value={kbEnterpriseForm.title} onChange={(e) => setKbEnterpriseForm({ ...kbEnterpriseForm, title: e.target.value })} />
                <textarea className="w-full min-h-[120px] rounded-lg border bg-transparent p-3 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Contenu (markdown supporté)" value={kbEnterpriseForm.content} onChange={(e) => setKbEnterpriseForm({ ...kbEnterpriseForm, content: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setShowKbEnterpriseForm(false); setEditingKbEnterpriseId(null); }}>Annuler</Button>
                  <Button size="sm" disabled={!kbEnterpriseForm.title.trim()} onClick={async () => {
                    if (!token) return;
                    try {
                      if (editingKbEnterpriseId) { await knowledgeBaseApi.update(editingKbEnterpriseId, kbEnterpriseForm, token); }
                      else { await knowledgeBaseApi.createEnterprise(kbEnterpriseForm, token); }
                      loadKbEntries(); setShowKbEnterpriseForm(false); setEditingKbEnterpriseId(null); showSuccess(editingKbEnterpriseId ? 'Fiche modifiée' : 'Fiche créée');
                    } catch { setError('Erreur lors de la sauvegarde'); }
                  }}>{editingKbEnterpriseId ? 'Modifier' : 'Créer'}</Button>
                </div>
              </div>
            )}

            {kbEnterpriseEntries.length === 0 && !showKbEnterpriseForm && (
              <div className="text-center py-8 text-muted-foreground">
                <Library className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Aucune fiche entreprise</p>
                <p className="text-xs mt-1">Ajoutez des méthodologies, templates ou références partagées</p>
              </div>
            )}

            {kbEnterpriseEntries.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between rounded-lg border p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{entry.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${entry.type === 'file' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {entry.type === 'file' ? entry.fileName : 'texte'}
                    </span>
                  </div>
                  {entry.content && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.content.slice(0, 200)}</p>}
                </div>
                <div className="flex gap-1 ml-2">
                  {entry.type === 'text' && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setKbEnterpriseForm({ title: entry.title, content: entry.content }); setEditingKbEnterpriseId(entry.id); setShowKbEnterpriseForm(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={async () => { if (!token) return; try { await knowledgeBaseApi.remove(entry.id, token); loadKbEntries(); showSuccess('Fiche supprimée'); } catch { setError('Erreur lors de la suppression'); } }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
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
            <div className="flex-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-mono text-muted-foreground select-all truncate">
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
