'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { setupApi, authProvidersApi, authApi, settingsApi, ApiError } from '@/lib/api';
import type { AuthProviderInfo } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Globe, Server, KeyRound, Shield, Github, Chrome, Lock, Mail, Check } from 'lucide-react';
import { HtgLogo } from '@/components/ui/htg-logo';

function getProviderIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('github')) return Github;
  if (lower.includes('google')) return Chrome;
  if (lower.includes('microsoft') || lower.includes('azure') || lower.includes('entra')) return KeyRound;
  return Globe;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [providers, setProviders] = useState<AuthProviderInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'LOCAL' | 'LDAP'>('LOCAL');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [selfRegEnabled, setSelfRegEnabled] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ email: '', firstName: '', lastName: '', password: '', confirmPassword: '' });
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const { login, loginWithTokens, user } = useAuth();
  const router = useRouter();

  const hasLocal = providers.some((p) => p.type === 'LOCAL');
  const hasLdap = providers.some((p) => p.type === 'LDAP');
  const oidcProviders = providers.filter((p) => p.type === 'OIDC');
  const samlProviders = providers.filter((p) => p.type === 'SAML');
  const hasMultipleCredentialMethods = hasLocal && hasLdap;
  const hasCredentialForm = hasLocal || hasLdap || showAdminLogin;

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
      return;
    }

    const init = async () => {
      try {
        const status = await setupApi.getStatus();
        if (!status.isSetup || !status.onboardingComplete) {
          router.replace('/setup');
          return;
        }

        const enabledProviders = await authProvidersApi.getEnabled();
        setProviders(enabledProviders);

        if (enabledProviders.some((p) => p.type === 'LOCAL')) {
          setActiveTab('LOCAL');
        } else if (enabledProviders.some((p) => p.type === 'LDAP')) {
          setActiveTab('LDAP');
        }

        try {
          const { selfRegistrationEnabled } = await settingsApi.checkSelfRegistration();
          setSelfRegEnabled(selfRegistrationEnabled);
        } catch {}
      } catch {
        // API not reachable
      }
      setCheckingSetup(false);
    };

    init();
  }, [user, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const providerId = sessionStorage.getItem('htgether_oidc_provider');

    if (code && providerId) {
      sessionStorage.removeItem('htgether_oidc_provider');
      const handleCallback = async () => {
        setLoading(true);
        try {
          const redirectUri = window.location.origin + '/login';
          const response = await authApi.oidcCallback(providerId, window.location.href, redirectUri);
          loginWithTokens(response);
          if (response.user.mustChangePassword) {
            router.push('/change-password');
          } else {
            router.push('/dashboard');
          }
        } catch (err) {
          if (err instanceof ApiError) {
            if (err.status === 403) setError('Ce compte a été désactivé');
            else setError(err.message || 'Échec de l\'authentification SSO');
          } else {
            setError('Échec de l\'authentification SSO. Veuillez réessayer.');
          }
          window.history.replaceState({}, '', '/login');
        } finally {
          setLoading(false);
        }
      };
      handleCallback();
    }
  }, [loginWithTokens, router]);

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(email, password);
      if (response.user.mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError('Email ou mot de passe incorrect');
        else if (err.status === 403) setError('Ce compte a été désactivé');
        else setError(err.message);
      } else {
        setError('Impossible de se connecter au serveur');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLdapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const ldapProvider = providers.find((p) => p.type === 'LDAP');

    try {
      const response = await authApi.ldapLogin(email, password, ldapProvider?.id);
      loginWithTokens(response);
      if (response.user.mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError('Identifiants LDAP incorrects. Vérifiez votre email et mot de passe.');
        else if (err.status === 403) setError('Ce compte a été désactivé');
        else if (err.status === 400) setError('L\'authentification LDAP n\'est pas disponible');
        else setError(err.message);
      } else {
        setError('Impossible de se connecter au serveur LDAP');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOidcLogin = async (provider: AuthProviderInfo) => {
    setSsoLoading(provider.id);
    setError('');

    try {
      const callbackUrl = window.location.origin + '/login';
      const { authUrl } = await authApi.oidcAuthorize(provider.id, callbackUrl);
      sessionStorage.setItem('htgether_oidc_provider', provider.id);
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de démarrer l\'authentification SSO');
      setSsoLoading(null);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regForm.password !== regForm.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setError('');
    setRegLoading(true);
    try {
      await authApi.register({
        email: regForm.email,
        firstName: regForm.firstName,
        lastName: regForm.lastName,
        password: regForm.password,
      });
      setShowRegister(false);
      setRegSuccess('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
      setRegForm({ email: '', firstName: '', lastName: '', password: '', confirmPassword: '' });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) setError('Le domaine de cet email n\'est pas autorisé');
        else if (err.status === 409) setError('Un compte existe déjà avec cet email');
        else setError(err.message);
      } else {
        setError('Erreur lors de la création du compte');
      }
    } finally {
      setRegLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Left — Form */}
      <div className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 lg:px-20 xl:px-28">
        <div className="mx-auto w-full max-w-[420px]">
          {/* Title */}
          <h1
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              color: 'var(--fg)',
              marginBottom: 8,
            }}
          >
            Content de vous revoir
          </h1>
          <p
            style={{
              fontSize: 15,
              color: 'var(--fg-subtle)',
              marginBottom: 36,
              lineHeight: 1.5,
            }}
          >
            Connectez-vous pour accéder à votre espace de travail.
          </p>

          {/* Success (registration) */}
          {regSuccess && (
            <Alert className="mb-4 border-green-500/30 bg-green-500/10">
              <Check className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-600">{regSuccess}</AlertDescription>
            </Alert>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Registration form */}
          {showRegister && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="grid grid-cols-2 gap-3">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label htmlFor="reg-firstName" style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)' }}>Prénom</Label>
                  <Input id="reg-firstName" value={regForm.firstName} onChange={e => setRegForm({...regForm, firstName: e.target.value})} required className="h-10 rounded-lg border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label htmlFor="reg-lastName" style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)' }}>Nom</Label>
                  <Input id="reg-lastName" value={regForm.lastName} onChange={e => setRegForm({...regForm, lastName: e.target.value})} required className="h-10 rounded-lg border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label htmlFor="reg-email" style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)' }}>Email</Label>
                <Input id="reg-email" type="email" value={regForm.email} onChange={e => setRegForm({...regForm, email: e.target.value})} required placeholder="prenom.nom@entreprise.com" className="h-10 rounded-lg border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label htmlFor="reg-password" style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)' }}>Mot de passe</Label>
                <Input id="reg-password" type="password" value={regForm.password} onChange={e => setRegForm({...regForm, password: e.target.value})} required minLength={8} className="h-10 rounded-lg border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label htmlFor="reg-confirm" style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)' }}>Confirmer le mot de passe</Label>
                <Input id="reg-confirm" type="password" value={regForm.confirmPassword} onChange={e => setRegForm({...regForm, confirmPassword: e.target.value})} required minLength={8} className="h-10 rounded-lg border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm" />
              </div>
              <button
                type="submit"
                disabled={regLoading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '11px 16px', background: 'var(--accent)',
                  color: 'var(--accent-fg)', border: 'none', borderRadius: 'var(--r-lg)',
                  fontSize: 14, fontWeight: 500, cursor: regLoading ? 'not-allowed' : 'pointer',
                  opacity: regLoading ? 0.7 : 1, transition: 'background 0.15s, opacity 0.15s',
                  fontFamily: 'inherit', marginTop: 4,
                }}
                onMouseEnter={(e) => { if (!regLoading) e.currentTarget.style.background = 'var(--accent-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
              >
                {regLoading ? (<><Loader2 className="h-4 w-4 animate-spin" />Création...</>) : 'Créer mon compte'}
              </button>
              <div className="flex justify-center">
                <button type="button" onClick={() => { setShowRegister(false); setError(''); }} className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  Déjà un compte ? <span className="text-primary underline">Se connecter</span>
                </button>
              </div>
            </form>
          )}

          {!showRegister && (<>
          {/* SSO Buttons */}
          {(oidcProviders.length > 0 || samlProviders.length > 0) && (
            <div className="flex flex-col gap-2.5 mb-6">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mb-1">
                Authentification SSO
              </p>
              {oidcProviders.map((provider) => {
                const Icon = getProviderIcon(provider.name);
                return (
                  <Button
                    key={provider.id}
                    variant="outline"
                    onClick={() => handleOidcLogin(provider)}
                    disabled={ssoLoading === provider.id}
                    className="w-full h-11 text-sm font-medium gap-2.5 cursor-pointer"
                  >
                    {ssoLoading === provider.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    Continuer avec {provider.name}
                  </Button>
                );
              })}
              {samlProviders.map((provider) => (
                <Button
                  key={provider.id}
                  variant="outline"
                  disabled
                  className="w-full h-11 text-sm font-medium gap-2.5 opacity-50"
                >
                  <KeyRound className="h-4 w-4" />
                  Continuer avec {provider.name}
                </Button>
              ))}
            </div>
          )}

          {/* Separator */}
          {(oidcProviders.length > 0 || samlProviders.length > 0) && hasCredentialForm && (
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-widest">ou identifiants</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {/* Credential tabs */}
          {hasMultipleCredentialMethods && (
            <div className="flex rounded-lg bg-muted p-1 mb-5 border border-border">
              <button
                onClick={() => { setActiveTab('LOCAL'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[13px] font-medium transition-all cursor-pointer ${
                  activeTab === 'LOCAL'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </button>
              <button
                onClick={() => { setActiveTab('LDAP'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-[13px] font-medium transition-all cursor-pointer ${
                  activeTab === 'LDAP'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Server className="h-3.5 w-3.5" />
                Annuaire LDAP
              </button>
            </div>
          )}

          {/* Credential form */}
          {hasCredentialForm && (
            <form
              onSubmit={activeTab === 'LDAP' ? handleLdapSubmit : handleLocalSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
            >
              {activeTab === 'LDAP' && !hasMultipleCredentialMethods && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 border border-border">
                  <Server className="h-3.5 w-3.5 shrink-0" />
                  Connectez-vous avec vos identifiants d&apos;annuaire
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label htmlFor="email" style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)' }}>
                  {activeTab === 'LDAP' ? 'Email LDAP' : 'Email'}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={activeTab === 'LDAP' ? 'user@domain.local' : 'admin@example.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  className="h-10 rounded-lg border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label htmlFor="password" style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-muted)' }}>
                  Mot de passe
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  minLength={8}
                  className="h-10 rounded-lg border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '11px 16px',
                  background: 'var(--accent)',
                  color: 'var(--accent-fg)',
                  border: 'none',
                  borderRadius: 'var(--r-lg)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  transition: 'background 0.15s, opacity 0.15s',
                  fontFamily: 'inherit',
                  marginTop: 4,
                }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--accent-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>
          )}

          {/* Admin login fallback */}
          {!hasLocal && !showAdminLogin && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => { setShowAdminLogin(true); setActiveTab('LOCAL'); setError(''); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Lock className="h-3 w-3" />
                Connexion administrateur
              </button>
            </div>
          )}
          {showAdminLogin && !hasLocal && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Réservé aux super-administrateurs de la plateforme
            </p>
          )}

          {selfRegEnabled && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => { setShowRegister(true); setError(''); setRegSuccess(''); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Pas encore de compte ? <span className="text-primary underline">Créer un compte</span>
              </button>
            </div>
          )}
          </>)}
        </div>
      </div>

      {/* Right — Decorative panel */}
      <div
        className="hidden lg:flex"
        style={{
          width: '50%',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #0c0d1a 0%, #141432 40%, #1a1a3e 100%)',
        }}
      >
        {/* Grid overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(94, 106, 210, 0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(94, 106, 210, 0.06) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Accent glow */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            right: '10%',
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(94, 106, 210, 0.15) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '15%',
            left: '5%',
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(130, 143, 255, 0.10) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* Geometric shapes */}
        <div
          style={{
            position: 'absolute',
            top: '12%',
            left: '15%',
            width: 120,
            height: 120,
            borderRadius: 'var(--r-xl)',
            border: '1px solid rgba(94, 106, 210, 0.20)',
            background: 'rgba(94, 106, 210, 0.05)',
            transform: 'rotate(15deg)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '8%',
            right: '20%',
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: '1px solid rgba(94, 106, 210, 0.15)',
            background: 'rgba(94, 106, 210, 0.04)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '25%',
            right: '15%',
            width: 160,
            height: 160,
            borderRadius: 'var(--r-xxl)',
            border: '1px solid rgba(130, 143, 255, 0.15)',
            background: 'rgba(130, 143, 255, 0.04)',
            transform: 'rotate(-10deg)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '10%',
            left: '20%',
            width: 100,
            height: 100,
            borderRadius: 'var(--r-lg)',
            border: '1px solid rgba(94, 106, 210, 0.12)',
            background: 'rgba(94, 106, 210, 0.03)',
            transform: 'rotate(25deg)',
          }}
        />

        {/* Center badge */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 'var(--r-xl)',
              background: 'rgba(94, 106, 210, 0.10)',
              border: '1px solid rgba(94, 106, 210, 0.20)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}
          >
            <HtgLogo size={32} style={{ opacity: 0.6 }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'rgba(247, 248, 248, 0.80)',
                marginBottom: 4,
              }}
            >
              HTGether
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'rgba(138, 143, 152, 0.70)',
                letterSpacing: '-0.01em',
              }}
            >
              Pentest collaboratif
            </div>
          </div>
        </div>

        {/* Decorative lines */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          viewBox="0 0 600 900"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          <line x1="80" y1="0" x2="80" y2="900" stroke="rgba(94,106,210,0.08)" strokeWidth="1" />
          <line x1="200" y1="0" x2="200" y2="900" stroke="rgba(94,106,210,0.05)" strokeWidth="1" />
          <line x1="400" y1="0" x2="400" y2="900" stroke="rgba(94,106,210,0.08)" strokeWidth="1" />
          <line x1="520" y1="0" x2="520" y2="900" stroke="rgba(94,106,210,0.05)" strokeWidth="1" />
          <line x1="0" y1="200" x2="600" y2="200" stroke="rgba(94,106,210,0.06)" strokeWidth="1" />
          <line x1="0" y1="450" x2="600" y2="450" stroke="rgba(94,106,210,0.04)" strokeWidth="1" />
          <line x1="0" y1="700" x2="600" y2="700" stroke="rgba(94,106,210,0.06)" strokeWidth="1" />
          {/* Diagonal accents */}
          <line x1="0" y1="300" x2="300" y2="0" stroke="rgba(130,143,255,0.06)" strokeWidth="1" />
          <line x1="300" y1="900" x2="600" y2="600" stroke="rgba(130,143,255,0.06)" strokeWidth="1" />
        </svg>

        {/* Corner dots */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            right: 32,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 6px)',
            gap: 8,
          }}
        >
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: `rgba(94, 106, 210, ${0.12 + (i % 4) * 0.04})`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
