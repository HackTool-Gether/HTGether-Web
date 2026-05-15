'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authApi, ApiError } from '@/lib/api';
import { AVATAR_STYLES, generateAvatarSvg } from '@/lib/dicebear';
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
  Loader2,
  AlertCircle,
  Check,
  Save,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  Shuffle,
} from 'lucide-react';

const VARIANTS_COUNT = 18;

function generateSeeds(base: number): string[] {
  const seeds: string[] = [];
  for (let i = 0; i < VARIANTS_COUNT; i++) {
    seeds.push(`${base}-${i}`);
  }
  return seeds;
}

export default function ProfilePage() {
  const { user, token, updateUser } = useAuth();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Avatar — step 1: style, step 2: variant
  const [avatarStyle, setAvatarStyle] = useState(user?.avatarStyle || 'adventurer');
  const [avatarSeed, setAvatarSeed] = useState(user?.avatarSeed || user?.email || '');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [step, setStep] = useState<'style' | 'variant'>('style');
  const [variantBase, setVariantBase] = useState(() => Date.now());

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const showSuccess = useCallback((msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 3000);
  }, []);

  const currentAvatarSvg = useMemo(
    () => generateAvatarSvg(avatarStyle, avatarSeed),
    [avatarStyle, avatarSeed],
  );

  const variantSeeds = useMemo(() => generateSeeds(variantBase), [variantBase]);

  const saveAvatar = async () => {
    if (!token) return;
    setSavingAvatar(true);
    setError('');
    try {
      await authApi.updateAvatar({ avatarStyle, avatarSeed }, token);
      updateUser({ avatarStyle, avatarSeed, avatarOptions: {} });
      showSuccess('Avatar mis à jour');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSavingAvatar(false);
    }
  };

  const selectStyle = (key: string) => {
    setAvatarStyle(key);
    setVariantBase(Date.now());
    setStep('variant');
  };

  const selectVariant = (seed: string) => {
    setAvatarSeed(seed);
  };

  const shuffleVariants = () => {
    setVariantBase(Date.now());
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères');
      return;
    }
    setChangingPassword(true);
    setError('');
    try {
      await authApi.changePassword(currentPassword, newPassword, token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showSuccess('Mot de passe modifié');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur lors du changement de mot de passe');
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) return null;

  const currentStyleLabel = AVATAR_STYLES.find((s) => s.key === avatarStyle)?.label || avatarStyle;

  return (
    <div className="p-4 sm:p-8 max-w-4xl pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Mon profil</h1>
        <p className="text-muted-foreground">Gérez votre avatar et vos identifiants</p>
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

      {/* Informations */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase">Prénom</p>
              <p className="text-sm">{user.firstName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase">Nom</p>
              <p className="text-sm">{user.lastName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase">Email</p>
              <p className="text-sm font-mono">{user.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase">Rôle</p>
              <p className="text-sm">{user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Utilisateur'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avatar */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Avatar</CardTitle>
              <CardDescription>
                {step === 'style'
                  ? 'Choisissez un style d\'avatar'
                  : `Style : ${currentStyleLabel} — Choisissez une variante`
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div
                className="h-16 w-16 rounded-full overflow-hidden border-2 border-border bg-secondary shrink-0"
                dangerouslySetInnerHTML={{ __html: currentAvatarSvg }}
              />
              <Button size="sm" onClick={saveAvatar} disabled={savingAvatar}>
                {savingAvatar ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Save className="mr-2 h-3 w-3" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'style' ? (
            <>
              {/* Style grid */}
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-3">
                {AVATAR_STYLES.map((style) => {
                  const svg = generateAvatarSvg(style.key, user.email || 'default');
                  const isActive = avatarStyle === style.key;
                  return (
                    <button
                      key={style.key}
                      type="button"
                      onClick={() => selectStyle(style.key)}
                      className="flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all"
                      style={{
                        borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                        background: isActive ? 'var(--accent-tint)' : 'transparent',
                        cursor: 'pointer',
                      }}
                      title={style.label}
                    >
                      <div
                        className="h-14 w-14 rounded-full overflow-hidden bg-secondary"
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                      <span className="text-[10px] text-muted-foreground leading-tight text-center line-clamp-2">{style.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Back + shuffle */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep('style')}>
                  <ArrowLeft className="mr-1 h-3 w-3" />
                  Changer de style
                </Button>
                <Button variant="outline" size="sm" onClick={shuffleVariants}>
                  <Shuffle className="mr-1 h-3 w-3" />
                  Nouvelles variantes
                </Button>
              </div>

              {/* Variants grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {variantSeeds.map((seed) => {
                  const svg = generateAvatarSvg(avatarStyle, seed);
                  const isActive = avatarSeed === seed;
                  return (
                    <button
                      key={seed}
                      type="button"
                      onClick={() => selectVariant(seed)}
                      className="flex flex-col items-center rounded-xl border-2 p-3 transition-all"
                      style={{
                        borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                        background: isActive ? 'var(--accent-tint)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        className="h-16 w-16 rounded-full overflow-hidden bg-secondary"
                        dangerouslySetInnerHTML={{ __html: svg }}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Custom seed */}
              <div className="space-y-2 pt-2">
                <Label className="text-xs text-muted-foreground">Ou entrez un texte personnalisé</Label>
                <div className="flex gap-2">
                  <Input
                    value={avatarSeed}
                    onChange={(e) => setAvatarSeed(e.target.value)}
                    placeholder="Texte pour générer un avatar unique"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setAvatarSeed(Math.random().toString(36).substring(2, 10))}
                    title="Aléatoire"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Changer le mot de passe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Mot de passe actuel</Label>
              <div className="relative">
                <Input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                >
                  {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPw(!showNewPw)}
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirmer le nouveau mot de passe</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={changingPassword}>
                {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Changer le mot de passe
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
