'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { setupApi, authProvidersApi, authApi, ApiError } from '@/lib/api';
import type { AuthProviderInfo } from '@/lib/api';
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
import { Shield, Loader2, AlertCircle, KeyRound, Globe, Server } from 'lucide-react';

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

        // Set default tab based on available providers
        if (enabledProviders.some((p) => p.type === 'LOCAL')) {
          setActiveTab('LOCAL');
        } else if (enabledProviders.some((p) => p.type === 'LDAP')) {
          setActiveTab('LDAP');
        }
      } catch {
        // API not reachable
      }
      setCheckingSetup(false);
    };

    init();
  }, [user, router]);

  // Handle OIDC callback if we're returning from SSO
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    // Retrieve providerId from sessionStorage (stored before redirect)
    const providerId = sessionStorage.getItem('htgether_oidc_provider');

    if (code && providerId) {
      sessionStorage.removeItem('htgether_oidc_provider');
      const handleCallback = async () => {
        setLoading(true);
        try {
          const redirectUri = window.location.origin + '/login';
          const response = await authApi.oidcCallback(providerId, window.location.href, redirectUri);
          loginWithTokens(response);
          router.push('/dashboard');
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'SSO authentication failed');
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
      await login(email, password);
      router.push('/dashboard');
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
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError('Identifiants LDAP incorrects');
        else if (err.status === 403) setError('Ce compte a été désactivé');
        else setError(err.message);
      } else {
        setError('Impossible de se connecter au serveur');
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
      // Store providerId before redirecting — Google won't send it back
      sessionStorage.setItem('htgether_oidc_provider', provider.id);
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start SSO');
      setSsoLoading(null);
    }
  };

  if (checkingSetup) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'OIDC':
        return <Globe className="mr-2 h-4 w-4" />;
      case 'LDAP':
        return <Server className="mr-2 h-4 w-4" />;
      case 'SAML':
        return <KeyRound className="mr-2 h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">HTGether</h1>
            <p className="text-sm text-muted-foreground">
              Plateforme collaborative de pentest
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle>Connexion</CardTitle>
            <CardDescription>
              Connectez-vous pour accéder à la plateforme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* SSO Buttons (OIDC / SAML) */}
            {(oidcProviders.length > 0 || samlProviders.length > 0) && (
              <div className="space-y-2">
                {oidcProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    variant="outline"
                    className="w-full"
                    onClick={() => handleOidcLogin(provider)}
                    disabled={ssoLoading === provider.id}
                  >
                    {ssoLoading === provider.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      getProviderIcon('OIDC')
                    )}
                    Continuer avec {provider.name}
                  </Button>
                ))}
                {samlProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    variant="outline"
                    className="w-full"
                    disabled
                  >
                    {getProviderIcon('SAML')}
                    Continuer avec {provider.name}
                  </Button>
                ))}
              </div>
            )}

            {/* Separator */}
            {(oidcProviders.length > 0 || samlProviders.length > 0) &&
              hasCredentialForm && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      ou
                    </span>
                  </div>
                </div>
              )}

            {/* Credential tabs (Local / LDAP) */}
            {hasMultipleCredentialMethods && (
              <div className="flex rounded-lg border p-1">
                <button
                  onClick={() => { setActiveTab('LOCAL'); setError(''); }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === 'LOCAL'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Email
                </button>
                <button
                  onClick={() => { setActiveTab('LDAP'); setError(''); }}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === 'LDAP'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  LDAP
                </button>
              </div>
            )}

            {/* Credential form */}
            {hasCredentialForm && (
              <form
                onSubmit={activeTab === 'LDAP' ? handleLdapSubmit : handleLocalSubmit}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={activeTab === 'LDAP' ? 'user@domain.local' : 'admin@example.com'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    minLength={8}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Admin login fallback — always accessible */}
        {!hasLocal && !showAdminLogin && (
          <div className="text-center">
            <button
              onClick={() => { setShowAdminLogin(true); setActiveTab('LOCAL'); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Connexion administrateur
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
