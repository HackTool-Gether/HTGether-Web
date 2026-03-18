'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setupApi, ApiError } from '@/lib/api';
import type { OnboardingData } from '@/lib/api';
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
  Shield,
  Loader2,
  AlertCircle,
  User,
  Building2,
  KeyRound,
  Brain,
  Mail,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Globe,
  Github,
  Server,
  Copy,
  Check,
} from 'lucide-react';

const STEPS = [
  { id: 'admin', title: 'Compte Admin', icon: User },
  { id: 'company', title: 'Entreprise', icon: Building2 },
  { id: 'auth', title: 'Authentification', icon: KeyRound },
  { id: 'ai', title: 'Module IA', icon: Brain },
  { id: 'smtp', title: 'Email (SMTP)', icon: Mail },
  { id: 'summary', title: 'Résumé', icon: CheckCircle2 },
] as const;

const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', description: 'GPT-4, GPT-4o', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude 4', models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'] },
  { id: 'gemini', name: 'Google Gemini', description: 'Gemini Pro, Ultra', models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro'] },
  { id: 'mistral', name: 'Mistral AI', description: 'Mistral Large, Medium', models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'] },
];

const AUTH_OPTIONS = [
  { id: 'LOCAL', name: 'Email & Mot de passe', description: 'Authentification classique', icon: KeyRound, needsConfig: false },
  { id: 'GOOGLE', name: 'Google', description: 'SSO via Google Workspace', icon: Globe, needsConfig: true },
  { id: 'GITHUB', name: 'GitHub', description: 'SSO via GitHub', icon: Github, needsConfig: true },
  { id: 'AZURE_AD', name: 'Azure AD', description: 'SSO Microsoft / Azure', icon: Server, needsConfig: true },
  { id: 'LDAP', name: 'LDAP / Active Directory', description: 'Authentification LDAP', icon: Server, needsConfig: true },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Admin state
  const [admin, setAdmin] = useState({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '' });

  // Company state
  const [company, setCompany] = useState({ name: '', domain: '' });

  // Auth state
  const [authProviders, setAuthProviders] = useState<Record<string, { enabled: boolean; config: Record<string, any> }>>({
    LOCAL: { enabled: true, config: {} },
    GOOGLE: { enabled: false, config: {} },
    GITHUB: { enabled: false, config: {} },
    AZURE_AD: { enabled: false, config: {} },
    LDAP: { enabled: false, config: {} },
  });

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

  // Copy state for callback URL
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/login`
    : 'https://your-domain.com/login';

  const copyCallbackUrl = async (providerId: string) => {
    await navigator.clipboard.writeText(callbackUrl);
    setCopiedId(providerId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentStep = STEPS[step];

  const validateStep = (): boolean => {
    setError('');
    switch (currentStep.id) {
      case 'admin':
        if (!admin.email || !admin.password || !admin.firstName || !admin.lastName) {
          setError('Tous les champs sont obligatoires');
          return false;
        }
        if (admin.password.length < 8) {
          setError('Le mot de passe doit contenir au moins 8 caractères');
          return false;
        }
        if (admin.password !== admin.confirmPassword) {
          setError('Les mots de passe ne correspondent pas');
          return false;
        }
        return true;
      case 'company':
        if (!company.name) {
          setError("Le nom de l'entreprise est obligatoire");
          return false;
        }
        return true;
      case 'auth': {
        const hasAtLeastOne = Object.values(authProviders).some((p) => p.enabled);
        if (!hasAtLeastOne) {
          setError("Au moins un mode d'authentification doit être activé");
          return false;
        }
        return true;
      }
      case 'ai':
        if (ai.enabled && (!ai.provider || !ai.apiKey)) {
          setError('Sélectionnez un provider et entrez votre clé API');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    const data: OnboardingData = {
      admin: {
        email: admin.email,
        password: admin.password,
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
      company: { name: company.name, domain: company.domain || undefined },
      auth: {
        providers: Object.entries(authProviders).map(([type, { enabled, config }]) => ({
          type,
          enabled,
          config,
        })),
      },
      ai: {
        enabled: ai.enabled,
        provider: ai.provider || undefined,
        apiKey: ai.apiKey || undefined,
        model: ai.model || undefined,
      },
      smtp: emailProvider === 'smtp'
        ? { enabled: true, provider: 'smtp', ...smtp }
        : emailProvider === 'mailgun'
          ? { enabled: true, provider: 'mailgun', ...mailgun }
          : { enabled: false },
    };

    try {
      await setupApi.onboarding(data);
      router.push('/login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthProvider = (id: string) => {
    setAuthProviders((prev) => ({
      ...prev,
      [id]: { ...prev[id], enabled: !prev[id].enabled },
    }));
  };

  const updateAuthConfig = (id: string, key: string, value: string) => {
    setAuthProviders((prev) => ({
      ...prev,
      [id]: { ...prev[id], config: { ...prev[id].config, [key]: value } },
    }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Configuration initiale</h1>
            <p className="text-sm text-muted-foreground">
              Configurez votre plateforme HTGether en quelques étapes
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`h-1.5 w-full rounded-full transition-colors ${
                  i <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
              <span className={`text-xs ${i <= step ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${step < STEPS.length - 1 ? 'bg-primary/10' : 'bg-green-500/10'}`}>
                <currentStep.icon className={`h-5 w-5 ${step < STEPS.length - 1 ? 'text-primary' : 'text-green-500'}`} />
              </div>
              <div>
                <CardTitle>{currentStep.title}</CardTitle>
                <CardDescription>
                  {currentStep.id === 'admin' && 'Créez votre compte administrateur'}
                  {currentStep.id === 'company' && 'Informations de votre entreprise'}
                  {currentStep.id === 'auth' && 'Choisissez les modes de connexion'}
                  {currentStep.id === 'ai' && "Configurez l'assistant IA"}
                  {currentStep.id === 'smtp' && "Configurez l'envoi d'emails"}
                  {currentStep.id === 'summary' && 'Vérifiez votre configuration'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Step: Admin */}
            {currentStep.id === 'admin' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Prénom</Label>
                    <Input
                      id="firstName"
                      value={admin.firstName}
                      onChange={(e) => setAdmin({ ...admin, firstName: e.target.value })}
                      placeholder="Jean"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nom</Label>
                    <Input
                      id="lastName"
                      value={admin.lastName}
                      onChange={(e) => setAdmin({ ...admin, lastName: e.target.value })}
                      placeholder="Dupont"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={admin.email}
                    onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
                    placeholder="admin@entreprise.com"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      value={admin.password}
                      onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmer</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={admin.confirmPassword}
                      onChange={(e) => setAdmin({ ...admin, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      minLength={8}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step: Company */}
            {currentStep.id === 'company' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nom de l&apos;entreprise</Label>
                  <Input
                    id="companyName"
                    value={company.name}
                    onChange={(e) => setCompany({ ...company, name: e.target.value })}
                    placeholder="CyberSec Corp"
                    required
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
                  <p className="text-xs text-muted-foreground">
                    Utilisé pour le branding des rapports
                  </p>
                </div>
              </div>
            )}

            {/* Step: Auth */}
            {currentStep.id === 'auth' && (
              <div className="space-y-3">
                {AUTH_OPTIONS.map((opt) => {
                  const provider = authProviders[opt.id];
                  const Icon = opt.icon;
                  return (
                    <div key={opt.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{opt.name}</p>
                            <p className="text-xs text-muted-foreground">{opt.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={provider.enabled}
                          onCheckedChange={() => toggleAuthProvider(opt.id)}
                        />
                      </div>

                      {/* Config fields for SSO providers */}
                      {provider.enabled && opt.needsConfig && opt.id !== 'LDAP' && (
                        <div className="space-y-3 pt-2 border-t">
                          {/* Callback URL */}
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Callback URL (à copier dans la console {opt.name})</Label>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-xs font-mono text-muted-foreground select-all truncate">
                                {callbackUrl}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 shrink-0"
                                onClick={() => copyCallbackUrl(opt.id)}
                              >
                                {copiedId === opt.id ? (
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Client ID</Label>
                              <Input
                                value={provider.config.clientId || ''}
                                onChange={(e) => updateAuthConfig(opt.id, 'clientId', e.target.value)}
                                placeholder="Votre Client ID"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Client Secret</Label>
                              <Input
                                type="password"
                                value={provider.config.clientSecret || ''}
                                onChange={(e) => updateAuthConfig(opt.id, 'clientSecret', e.target.value)}
                                placeholder="Votre Client Secret"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* LDAP config */}
                      {provider.enabled && opt.id === 'LDAP' && (
                        <div className="space-y-3 pt-2 border-t">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">URL du serveur</Label>
                              <Input
                                value={provider.config.url || ''}
                                onChange={(e) => updateAuthConfig(opt.id, 'url', e.target.value)}
                                placeholder="ldap://ldap.entreprise.com"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Base DN</Label>
                              <Input
                                value={provider.config.baseDn || ''}
                                onChange={(e) => updateAuthConfig(opt.id, 'baseDn', e.target.value)}
                                placeholder="dc=entreprise,dc=com"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Bind DN (optionnel)</Label>
                              <Input
                                value={provider.config.bindDn || ''}
                                onChange={(e) => updateAuthConfig(opt.id, 'bindDn', e.target.value)}
                                placeholder="cn=admin,dc=..."
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Bind Password</Label>
                              <Input
                                type="password"
                                value={provider.config.bindPassword || ''}
                                onChange={(e) => updateAuthConfig(opt.id, 'bindPassword', e.target.value)}
                                placeholder="••••••••"
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Step: AI */}
            {currentStep.id === 'ai' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Activer le module IA</p>
                    <p className="text-sm text-muted-foreground">
                      Assistance à la rédaction, suggestions de remédiation, analyse
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
                          <Label htmlFor="apiKey">Clé API</Label>
                          <Input
                            id="apiKey"
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
              </div>
            )}

            {/* Step: Email */}
            {currentStep.id === 'smtp' && (
              <div className="space-y-4">
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
              </div>
            )}

            {/* Step: Summary */}
            {currentStep.id === 'summary' && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Administrateur</p>
                  <p className="text-sm">{admin.firstName} {admin.lastName} — {admin.email}</p>
                </div>

                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Entreprise</p>
                  <p className="text-sm">{company.name}{company.domain ? ` (${company.domain})` : ''}</p>
                </div>

                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Authentification</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {Object.entries(authProviders)
                      .filter(([, v]) => v.enabled)
                      .map(([k]) => {
                        const opt = AUTH_OPTIONS.find((o) => o.id === k);
                        return (
                          <span key={k} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {opt?.name || k}
                          </span>
                        );
                      })}
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Module IA</p>
                  {ai.enabled ? (
                    <p className="text-sm">
                      {AI_PROVIDERS.find((p) => p.id === ai.provider)?.name} — {ai.model}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Désactivé</p>
                  )}
                </div>

                <div className="rounded-lg border p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Email</p>
                  {emailProvider === 'smtp' ? (
                    <p className="text-sm">SMTP — {smtp.host}:{smtp.port}</p>
                  ) : emailProvider === 'mailgun' ? (
                    <p className="text-sm">Mailgun — {mailgun.domain}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Non configuré</p>
                  )}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 0}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Button>

              {step < STEPS.length - 1 ? (
                <Button onClick={handleNext}>
                  Suivant
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Configuration...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Lancer HTGether
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
