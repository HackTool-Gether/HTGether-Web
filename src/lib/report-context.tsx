'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import type { Project, Finding } from './api';

export interface ReportVariable {
  path: string;
  label: string;
  group: 'Projet' | 'Client' | 'Findings';
}

export const REPORT_VARIABLES: ReportVariable[] = [
  { path: 'project.name', label: 'Nom du projet', group: 'Projet' },
  { path: 'project.type', label: 'Type d’audit', group: 'Projet' },
  { path: 'project.status', label: 'Statut', group: 'Projet' },
  { path: 'project.startDate', label: 'Date de début', group: 'Projet' },
  { path: 'project.endDate', label: 'Date de fin', group: 'Projet' },
  { path: 'project.client', label: 'Client', group: 'Client' },
  { path: 'project.need', label: 'Besoin client', group: 'Client' },
  { path: 'project.context', label: 'Contexte', group: 'Client' },
  { path: 'findings.count', label: 'Nombre total de findings', group: 'Findings' },
  { path: 'findings.critical', label: 'Findings critiques', group: 'Findings' },
  { path: 'findings.high', label: 'Findings hauts', group: 'Findings' },
  { path: 'findings.medium', label: 'Findings moyens', group: 'Findings' },
  { path: 'findings.low', label: 'Findings bas', group: 'Findings' },
  { path: 'findings.info', label: 'Findings info', group: 'Findings' },
];

interface ReportContextValue {
  project: Project | null;
  findings: Finding[];
  resolveVariable: (path: string) => string;
}

const ReportContext = createContext<ReportContextValue | null>(null);

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function severityCount(findings: Finding[], sev: string) {
  return findings.filter((f) => f.severity === sev).length;
}

export function ReportProvider({
  project,
  findings,
  children,
}: {
  project: Project | null;
  findings: Finding[];
  children: ReactNode;
}) {
  const value = useMemo<ReportContextValue>(() => {
    const resolveVariable = (path: string): string => {
      if (!project) return `{{ ${path} }}`;
      switch (path) {
        case 'project.name':
          return project.name;
        case 'project.type':
          return project.auditType;
        case 'project.status':
          return project.status;
        case 'project.startDate':
          return formatDate(project.startDate);
        case 'project.endDate':
          return formatDate(project.endDate);
        case 'project.client':
          return project.clientCompany;
        case 'project.need':
          return project.clientNeed || '';
        case 'project.context':
          return project.context || '';
        case 'findings.count':
          return String(findings.length);
        case 'findings.critical':
          return String(severityCount(findings, 'CRITICAL'));
        case 'findings.high':
          return String(severityCount(findings, 'HIGH'));
        case 'findings.medium':
          return String(severityCount(findings, 'MEDIUM'));
        case 'findings.low':
          return String(severityCount(findings, 'LOW'));
        case 'findings.info':
          return String(severityCount(findings, 'INFO'));
        default:
          return `{{ ${path} }}`;
      }
    };
    return { project, findings, resolveVariable };
  }, [project, findings]);

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReport(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) {
    return {
      project: null,
      findings: [],
      resolveVariable: (path) => `{{ ${path} }}`,
    };
  }
  return ctx;
}
