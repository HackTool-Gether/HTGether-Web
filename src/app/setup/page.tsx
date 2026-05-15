'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setupApi, ApiError } from '@/lib/api';
import type { OnboardingData } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
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
import type { LucideIcon } from 'lucide-react';
import { HtgLogo } from '@/components/ui/htg-logo';

const STEPS = [
  { id: 'admin', title: 'Compte Admin', desc: 'Créez le premier administrateur de la plateforme', icon: User },
  { id: 'company', title: 'Entreprise', desc: 'Renseignez les informations de votre organisation', icon: Building2 },
  { id: 'auth', title: 'Authentification', desc: 'Configurez les modes de connexion disponibles', icon: KeyRound },
  { id: 'ai', title: 'Module IA', desc: "Activez l'assistant IA pour la rédaction et l'analyse", icon: Brain },
  { id: 'smtp', title: 'Email', desc: "Configurez l'envoi de notifications par email", icon: Mail },
  { id: 'summary', title: 'Lancement', desc: 'Vérifiez et validez votre configuration', icon: CheckCircle2 },
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

const STEP_TITLES: Record<string, string> = {
  admin: 'Créez votre compte administrateur',
  company: 'Informations de votre entreprise',
  auth: "Modes d'authentification",
  ai: "Assistant IA",
  smtp: "Configuration email",
  summary: 'Tout est prêt',
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  admin: 'Ce compte sera le super administrateur de la plateforme. Vous pourrez créer d\'autres utilisateurs par la suite.',
  company: 'Ces informations seront utilisées dans les rapports générés et le branding de la plateforme.',
  auth: 'Choisissez comment vos utilisateurs pourront se connecter. Au moins un mode doit être activé.',
  ai: "L'IA peut assister à la rédaction de findings, suggérer des remédiations et analyser les résultats.",
  smtp: "Configurez un serveur email pour les notifications et les invitations d'utilisateurs.",
  summary: 'Vérifiez votre configuration avant de lancer la plateforme.',
};

function SidebarStep({ icon: Icon, title, desc, active, completed, isLast, onClick }: {
  icon: LucideIcon;
  title: string;
  desc: string;
  active: boolean;
  completed: boolean;
  isLast: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        width: '100%',
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      {/* Icon column with connector line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: completed ? 'rgba(39, 166, 68, 0.15)' : active ? 'var(--accent)' : 'var(--bg-subtle)',
            border: `2px solid ${completed ? '#27a644' : active ? 'var(--accent)' : 'var(--border)'}`,
            transition: 'all 0.2s',
          }}
        >
          {completed ? (
            <Check size={14} strokeWidth={2.5} style={{ color: '#27a644' }} />
          ) : (
            <Icon size={14} style={{ color: active ? 'var(--accent-fg)' : 'var(--fg-subtle)' }} />
          )}
        </div>
        {!isLast && (
          <div style={{
            width: 2,
            flex: 1,
            minHeight: 12,
            background: completed ? '#27a644' : 'var(--border)',
            transition: 'background 0.2s',
          }} />
        )}
      </div>

      {/* Text */}
      <div style={{ minWidth: 0, paddingLeft: 12, paddingBottom: isLast ? 0 : 20 }}>
        <div style={{
          fontSize: 13,
          fontWeight: active || completed ? 600 : 400,
          color: active ? 'var(--fg)' : completed ? 'var(--fg)' : 'var(--fg-subtle)',
          lineHeight: 1.3,
          marginTop: 6,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 12,
          color: active ? 'var(--fg-muted)' : 'var(--fg-subtle)',
          lineHeight: 1.45,
          marginTop: 3,
        }}>
          {desc}
        </div>
      </div>
    </button>
  );
}

function FieldGroup({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Label style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)' }}>{label}</Label>
      {children}
      {hint && <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: 0 }}>{hint}</p>}
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminCreated, setAdminCreated] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const [admin, setAdmin] = useState({ email: '', password: '', confirmPassword: '', firstName: '', lastName: '' });
  const [company, setCompany] = useState({ name: '', domain: '' });
  const [authProviders, setAuthProviders] = useState<Record<string, { enabled: boolean; config: Record<string, any> }>>({
    LOCAL: { enabled: true, config: {} },
    GOOGLE: { enabled: false, config: {} },
    GITHUB: { enabled: false, config: {} },
    AZURE_AD: { enabled: false, config: {} },
    LDAP: { enabled: false, config: {} },
  });
  const [ai, setAi] = useState({ enabled: false, provider: '', apiKey: '', model: '' });
  const [emailProvider, setEmailProvider] = useState<'none' | 'smtp' | 'mailgun'>('none');
  const [smtp, setSmtp] = useState({ host: '', port: 587, user: '', password: '', fromEmail: '', fromName: '', secure: false });
  const [mailgun, setMailgun] = useState({ apiKey: '', domain: '', fromEmail: '', fromName: '' });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Check if admin already exists — skip step 0 if so
  useEffect(() => {
    (async () => {
      try {
        const status = await setupApi.getStatus();
        if (status.onboardingComplete) {
          router.replace('/login');
          return;
        }
        if (status.isSetup) {
          setAdminCreated(true);
          setStep(1);
        }
      } catch {}
      setCheckingStatus(false);
    })();
  }, [router]);

  const callbackUrl = company.domain
    ? `https://${company.domain}/login`
    : typeof window !== 'undefined' ? `${window.location.origin}/login` : '';

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
        if (!admin.email || !admin.password || !admin.firstName || !admin.lastName) { setError('Tous les champs sont obligatoires'); return false; }
        if (admin.password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères'); return false; }
        if (admin.password !== admin.confirmPassword) { setError('Les mots de passe ne correspondent pas'); return false; }
        return true;
      case 'company':
        if (!company.name) { setError("Le nom de l'entreprise est obligatoire"); return false; }
        return true;
      case 'auth':
        if (!Object.values(authProviders).some((p) => p.enabled)) { setError("Au moins un mode d'authentification doit être activé"); return false; }
        return true;
      case 'ai':
        if (ai.enabled && (!ai.provider || !ai.apiKey)) { setError('Sélectionnez un provider et entrez votre clé API'); return false; }
        return true;
      default: return true;
    }
  };

  const goTo = (target: number) => {
    if (target < step) {
      if (target === 0 && adminCreated) return;
      setError(''); setStep(target);
    }
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    // Create admin immediately at step 1
    if (currentStep.id === 'admin' && !adminCreated) {
      setLoading(true);
      setError('');
      try {
        await setupApi.init({
          email: admin.email,
          password: admin.password,
          firstName: admin.firstName,
          lastName: admin.lastName,
        });
        setAdminCreated(true);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Erreur lors de la création du compte');
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setError('');
    if (step === 1 && adminCreated) return;
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    const data: OnboardingData = {
      admin: { email: admin.email, password: admin.password, firstName: admin.firstName, lastName: admin.lastName },
      company: { name: company.name, domain: company.domain || undefined },
      auth: { providers: Object.entries(authProviders).map(([type, { enabled, config }]) => ({ type, enabled, config })) },
      ai: { enabled: ai.enabled, provider: ai.provider || undefined, apiKey: ai.apiKey || undefined, model: ai.model || undefined },
      smtp: emailProvider === 'smtp' ? { enabled: true, provider: 'smtp', ...smtp } : emailProvider === 'mailgun' ? { enabled: true, provider: 'mailgun', ...mailgun } : { enabled: false },
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

  if (checkingStatus) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-subtle)' }} />
      </div>
    );
  }

  const toggleAuthProvider = (id: string) => {
    setAuthProviders((prev) => ({ ...prev, [id]: { ...prev[id], enabled: !prev[id].enabled } }));
  };
  const updateAuthConfig = (id: string, key: string, value: string) => {
    setAuthProviders((prev) => ({ ...prev, [id]: { ...prev[id], config: { ...prev[id].config, [key]: value } } }));
  };

  const inputClass = "h-10 rounded-lg border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm";

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Left sidebar — Steps */}
      <div
        style={{
          width: 300,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 16px',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', marginBottom: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--r-lg)',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HtgLogo size={16} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>HTGether</div>
            <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Configuration initiale</div>
          </div>
        </div>

        {/* Info banner */}
        <div style={{
          margin: '16px 14px 20px',
          padding: '10px 12px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--r-lg)',
          border: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--fg-muted)',
          lineHeight: 1.5,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <AlertCircle size={14} style={{ color: 'var(--fg-subtle)', flexShrink: 0, marginTop: 1 }} />
          Configurez votre plateforme en quelques étapes.
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, padding: '0 14px' }}>
          {STEPS.map((s, i) => (
            <SidebarStep
              key={s.id}
              icon={s.icon}
              title={s.title}
              desc={s.desc}
              active={i === step}
              completed={i < step || (i === 0 && adminCreated)}
              isLast={i === STEPS.length - 1}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>

      {/* Right content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Content area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '48px 56px' }}>
          <div style={{ maxWidth: 560 }}>
            {/* Step label */}
            <div style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--accent)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              {step < STEPS.length - 1 ? `Etape ${step + 1} sur ${STEPS.length}` : 'Derniere etape'}
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              color: 'var(--fg)',
              margin: '0 0 8px',
            }}>
              {STEP_TITLES[currentStep.id]}
            </h1>

            {/* Description */}
            <p style={{
              fontSize: 14,
              color: 'var(--fg-subtle)',
              lineHeight: 1.6,
              margin: '0 0 32px',
            }}>
              {STEP_DESCRIPTIONS[currentStep.id]}
            </p>

            {/* Error */}
            {error && (
              <Alert variant="destructive" style={{ marginBottom: 24 }}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* ==================== ADMIN ==================== */}
            {currentStep.id === 'admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <FieldGroup label="Prénom">
                    <Input value={admin.firstName} onChange={(e) => setAdmin({ ...admin, firstName: e.target.value })} placeholder="Jean" className={inputClass} />
                  </FieldGroup>
                  <FieldGroup label="Nom">
                    <Input value={admin.lastName} onChange={(e) => setAdmin({ ...admin, lastName: e.target.value })} placeholder="Dupont" className={inputClass} />
                  </FieldGroup>
                </div>
                <FieldGroup label="Email">
                  <Input type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} placeholder="admin@entreprise.com" className={inputClass} />
                </FieldGroup>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <FieldGroup label="Mot de passe">
                    <Input type="password" value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} placeholder="••••••••" className={inputClass} />
                  </FieldGroup>
                  <FieldGroup label="Confirmer">
                    <Input type="password" value={admin.confirmPassword} onChange={(e) => setAdmin({ ...admin, confirmPassword: e.target.value })} placeholder="••••••••" className={inputClass} />
                  </FieldGroup>
                </div>
              </div>
            )}

            {/* ==================== COMPANY ==================== */}
            {currentStep.id === 'company' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <FieldGroup label="Nom de l'entreprise">
                  <Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} placeholder="CyberSec Corp" className={inputClass} />
                </FieldGroup>
                <FieldGroup label="Domaine (optionnel)" hint="Utilisé pour le branding des rapports">
                  <Input value={company.domain} onChange={(e) => setCompany({ ...company, domain: e.target.value })} placeholder="cybersec-corp.com" className={inputClass} />
                </FieldGroup>
              </div>
            )}

            {/* ==================== AUTH ==================== */}
            {currentStep.id === 'auth' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {AUTH_OPTIONS.map((opt) => {
                  const provider = authProviders[opt.id];
                  const Icon = opt.icon;
                  return (
                    <div
                      key={opt.id}
                      style={{
                        background: 'var(--bg-elevated)',
                        border: `1px solid ${provider.enabled ? 'rgba(94, 106, 210, 0.25)' : 'var(--border)'}`,
                        borderRadius: 'var(--r-lg)',
                        padding: 16,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 'var(--r-md)',
                            background: provider.enabled ? 'var(--accent-tint)' : 'var(--bg-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Icon size={15} style={{ color: provider.enabled ? 'var(--accent-hover)' : 'var(--fg-subtle)' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{opt.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{opt.description}</div>
                          </div>
                        </div>
                        <Switch checked={provider.enabled} onCheckedChange={() => toggleAuthProvider(opt.id)} />
                      </div>

                      {provider.enabled && opt.needsConfig && opt.id !== 'LDAP' && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <Label style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Callback URL</Label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                              <div style={{
                                flex: 1, padding: '6px 10px', background: 'var(--bg-subtle)',
                                border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                                fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-subtle)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>{callbackUrl}</div>
                              <button
                                type="button" onClick={() => copyCallbackUrl(opt.id)}
                                style={{
                                  width: 32, height: 32, borderRadius: 'var(--r-md)',
                                  background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', flexShrink: 0, color: 'var(--fg-subtle)',
                                }}
                              >
                                {copiedId === opt.id ? <Check size={13} style={{ color: '#27a644' }} /> : <Copy size={13} />}
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <FieldGroup label="Client ID">
                              <Input value={provider.config.clientId || ''} onChange={(e) => updateAuthConfig(opt.id, 'clientId', e.target.value)} placeholder="Client ID" className={inputClass} />
                            </FieldGroup>
                            <FieldGroup label="Client Secret">
                              <Input type="password" value={provider.config.clientSecret || ''} onChange={(e) => updateAuthConfig(opt.id, 'clientSecret', e.target.value)} placeholder="Client Secret" className={inputClass} />
                            </FieldGroup>
                          </div>
                        </div>
                      )}

                      {provider.enabled && opt.id === 'LDAP' && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <FieldGroup label="URL du serveur">
                              <Input value={provider.config.url || ''} onChange={(e) => updateAuthConfig(opt.id, 'url', e.target.value)} placeholder="ldap://ldap.entreprise.com" className={inputClass} />
                            </FieldGroup>
                            <FieldGroup label="Base DN">
                              <Input value={provider.config.baseDn || ''} onChange={(e) => updateAuthConfig(opt.id, 'baseDn', e.target.value)} placeholder="dc=entreprise,dc=com" className={inputClass} />
                            </FieldGroup>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <FieldGroup label="Bind DN (optionnel)">
                              <Input value={provider.config.bindDn || ''} onChange={(e) => updateAuthConfig(opt.id, 'bindDn', e.target.value)} placeholder="cn=admin,dc=..." className={inputClass} />
                            </FieldGroup>
                            <FieldGroup label="Bind Password">
                              <Input type="password" value={provider.config.bindPassword || ''} onChange={(e) => updateAuthConfig(opt.id, 'bindPassword', e.target.value)} placeholder="••••••••" className={inputClass} />
                            </FieldGroup>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ==================== AI ==================== */}
            {currentStep.id === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-lg)', padding: 16,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>Activer le module IA</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>Assistance, suggestions de remédiation, analyse</div>
                  </div>
                  <Switch checked={ai.enabled} onCheckedChange={(checked) => setAi({ ...ai, enabled: checked })} />
                </div>

                {ai.enabled && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {AI_PROVIDERS.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => setAi({ ...ai, provider: provider.id, model: provider.models[0] })}
                          style={{
                            padding: 16, textAlign: 'left', borderRadius: 'var(--r-lg)',
                            background: ai.provider === provider.id ? 'var(--accent-tint)' : 'var(--bg-elevated)',
                            border: `1px solid ${ai.provider === provider.id ? 'rgba(94, 106, 210, 0.30)' : 'var(--border)'}`,
                            cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{provider.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>{provider.description}</div>
                        </button>
                      ))}
                    </div>

                    {ai.provider && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <FieldGroup label="Clé API">
                          <Input type="password" value={ai.apiKey} onChange={(e) => setAi({ ...ai, apiKey: e.target.value })} placeholder={`Clé API ${AI_PROVIDERS.find((p) => p.id === ai.provider)?.name}`} className={inputClass} />
                        </FieldGroup>
                        <FieldGroup label="Modèle">
                          <Select value={ai.model} onValueChange={(val) => { if (val) setAi({ ...ai, model: val }); }}>
                            <SelectTrigger className="w-full h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {AI_PROVIDERS.find((p) => p.id === ai.provider)?.models.map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FieldGroup>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ==================== EMAIL ==================== */}
            {currentStep.id === 'smtp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {([['none', 'Désactivé', "Pas d'email"], ['smtp', 'SMTP', 'Serveur classique'], ['mailgun', 'Mailgun', 'API Mailgun']] as const).map(([id, name, desc]) => (
                    <button
                      key={id} type="button" onClick={() => setEmailProvider(id)}
                      style={{
                        padding: 16, textAlign: 'center', borderRadius: 'var(--r-lg)',
                        background: emailProvider === id ? 'var(--accent-tint)' : 'var(--bg-elevated)',
                        border: `1px solid ${emailProvider === id ? 'rgba(94, 106, 210, 0.30)' : 'var(--border)'}`,
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{name}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>{desc}</div>
                    </button>
                  ))}
                </div>

                {emailProvider === 'smtp' && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 16,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-lg)', padding: 20,
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                      <FieldGroup label="Serveur SMTP"><Input value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.gmail.com" className={inputClass} /></FieldGroup>
                      <FieldGroup label="Port"><Input type="number" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: parseInt(e.target.value) || 587 })} className={inputClass} /></FieldGroup>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FieldGroup label="Utilisateur"><Input value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} placeholder="user@gmail.com" className={inputClass} /></FieldGroup>
                      <FieldGroup label="Mot de passe"><Input type="password" value={smtp.password} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} placeholder="••••••••" className={inputClass} /></FieldGroup>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FieldGroup label="Email expéditeur"><Input value={smtp.fromEmail} onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })} placeholder="noreply@entreprise.com" className={inputClass} /></FieldGroup>
                      <FieldGroup label="Nom expéditeur"><Input value={smtp.fromName} onChange={(e) => setSmtp({ ...smtp, fromName: e.target.value })} placeholder="HTGether" className={inputClass} /></FieldGroup>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Checkbox id="smtpSecure" checked={smtp.secure} onCheckedChange={(checked) => setSmtp({ ...smtp, secure: checked === true })} />
                      <Label htmlFor="smtpSecure" style={{ fontSize: 13 }}>Connexion SSL/TLS</Label>
                    </div>
                  </div>
                )}

                {emailProvider === 'mailgun' && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 16,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-lg)', padding: 20,
                  }}>
                    <FieldGroup label="API Key"><Input type="password" value={mailgun.apiKey} onChange={(e) => setMailgun({ ...mailgun, apiKey: e.target.value })} placeholder="key-xxxxxxxx" className={inputClass} /></FieldGroup>
                    <FieldGroup label="Domaine Mailgun"><Input value={mailgun.domain} onChange={(e) => setMailgun({ ...mailgun, domain: e.target.value })} placeholder="mg.domain.com" className={inputClass} /></FieldGroup>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <FieldGroup label="Email expéditeur"><Input value={mailgun.fromEmail} onChange={(e) => setMailgun({ ...mailgun, fromEmail: e.target.value })} placeholder="no-reply@domain.com" className={inputClass} /></FieldGroup>
                      <FieldGroup label="Nom expéditeur"><Input value={mailgun.fromName} onChange={(e) => setMailgun({ ...mailgun, fromName: e.target.value })} placeholder="HTGether" className={inputClass} /></FieldGroup>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== SUMMARY ==================== */}
            {currentStep.id === 'summary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Administrateur', value: `${admin.firstName} ${admin.lastName} — ${admin.email}` },
                  { label: 'Entreprise', value: `${company.name}${company.domain ? ` (${company.domain})` : ''}` },
                  { label: 'Authentification', value: null, tags: Object.entries(authProviders).filter(([, v]) => v.enabled).map(([k]) => AUTH_OPTIONS.find((o) => o.id === k)?.name || k) },
                  { label: 'Module IA', value: ai.enabled ? `${AI_PROVIDERS.find((p) => p.id === ai.provider)?.name} — ${ai.model}` : 'Désactivé' },
                  { label: 'Email', value: emailProvider === 'smtp' ? `SMTP — ${smtp.host}:${smtp.port}` : emailProvider === 'mailgun' ? `Mailgun — ${mailgun.domain}` : 'Non configuré' },
                ].map((item) => (
                  <div key={item.label} style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-lg)', padding: '14px 16px',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      {item.label}
                    </div>
                    {item.tags ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {item.tags.map((tag) => (
                          <span key={tag} style={{
                            display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
                            borderRadius: 'var(--r-full)', fontSize: 12, fontWeight: 500,
                            background: 'var(--accent-tint)', color: 'var(--accent-hover)',
                          }}>{tag}</span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: item.value === 'Désactivé' || item.value === 'Non configuré' ? 'var(--fg-subtle)' : 'var(--fg)' }}>
                        {item.value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 56px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <button
            type="button" onClick={handleBack} disabled={step === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 'var(--r-lg)',
              background: 'transparent', border: 'none',
              fontSize: 13, fontWeight: 500, cursor: step === 0 ? 'not-allowed' : 'pointer',
              color: step === 0 ? 'var(--fg-disabled)' : 'var(--fg-muted)',
              fontFamily: 'inherit', transition: 'color 0.15s',
            }}
          >
            <ArrowLeft size={14} />
            Retour
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button" onClick={handleNext}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 'var(--r-lg)',
                background: 'var(--accent)', color: 'var(--accent-fg)',
                border: 'none', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
            >
              Enregistrer et continuer
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button" onClick={handleSubmit} disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 'var(--r-lg)',
                background: 'var(--accent)', color: 'var(--accent-fg)',
                border: 'none', fontSize: 13, fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                fontFamily: 'inherit', transition: 'background 0.15s, opacity 0.15s',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--accent-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Configuration...</>
              ) : (
                <><CheckCircle2 size={14} /> Lancer HTGether</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
