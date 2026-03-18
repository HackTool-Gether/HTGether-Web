'use client';

import { useAuth } from '@/lib/auth-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FolderOpen, Users, Shield, Activity } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Bonjour, {user?.firstName}
        </h1>
        <p className="text-muted-foreground">
          Bienvenue sur votre plateforme HTGether
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Projets actifs
            </CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Aucun projet en cours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Vulnérabilités
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Findings totaux
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membres</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">
              Utilisateur(s) actif(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activité</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">
              Aucune activité récente
            </p>
          </CardContent>
        </Card>
      </div>

      {user?.role === 'SUPER_ADMIN' && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Premiers pas</CardTitle>
              <CardDescription>
                Configurez votre plateforme pour commencer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Créer des comptes utilisateurs
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ajoutez vos collaborateurs à la plateforme
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Créer votre premier projet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Définissez le scope, ajoutez des membres et commencez
                    l&apos;audit
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Configurer un template de rapport
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Personnalisez le format de vos rapports d&apos;audit
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
