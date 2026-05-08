const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100/api';

interface ApiOptions extends RequestInit {
  token?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    headers,
    ...rest,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(error.message || 'Request failed', res.status);
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Auth Providers API
export const authProvidersApi = {
  getEnabled: () =>
    apiRequest<AuthProviderInfo[]>('/auth-providers/enabled'),

  getAll: (token: string) =>
    apiRequest<AuthProviderFull[]>('/auth-providers', { token }),

  getOne: (id: string, token: string) =>
    apiRequest<AuthProviderFull>(`/auth-providers/${id}`, { token }),

  create: (data: CreateAuthProviderData, token: string) =>
    apiRequest<AuthProviderFull>('/auth-providers', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (id: string, data: Partial<CreateAuthProviderData>, token: string) =>
    apiRequest<AuthProviderFull>(`/auth-providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  remove: (id: string, token: string) =>
    apiRequest<void>(`/auth-providers/${id}`, {
      method: 'DELETE',
      token,
    }),
};

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // OIDC: get authorization URL
  oidcAuthorize: (providerId: string, callbackUrl: string) =>
    apiRequest<{ authUrl: string; providerId: string }>(
      `/auth/oidc/authorize?providerId=${providerId}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    ),

  // OIDC: exchange code for tokens
  oidcCallback: (providerId: string, currentUrl: string, redirectUri: string) =>
    apiRequest<LoginResponse>('/auth/oidc/callback', {
      method: 'POST',
      body: JSON.stringify({ providerId, currentUrl, redirectUri }),
    }),

  // LDAP login
  ldapLogin: (email: string, password: string, providerId?: string) =>
    apiRequest<LoginResponse>('/auth/ldap/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, providerId }),
    }),

  refresh: (refreshToken: string) =>
    apiRequest<LoginResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  getProfile: (token: string) =>
    apiRequest<User>('/auth/profile', { token }),

  changePassword: (currentPassword: string, newPassword: string, token: string) =>
    apiRequest<LoginResponse>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
      token,
    }),
};

// Setup API
export const setupApi = {
  getStatus: () =>
    apiRequest<{ isSetup: boolean; onboardingComplete: boolean }>('/setup/status'),

  init: (data: SetupData) =>
    apiRequest<{ message: string; user: User }>('/setup/init', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  onboarding: (data: OnboardingData) =>
    apiRequest<{ message: string }>('/setup/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Settings API
export const settingsApi = {
  getCompany: () =>
    apiRequest<CompanySettings>('/settings/company'),

  getOnboardingStatus: () =>
    apiRequest<{ completed: boolean }>('/settings/onboarding/status'),

  getAll: (token: string) =>
    apiRequest<Record<string, any>>('/settings', { token }),

  update: (key: string, value: any, token: string) =>
    apiRequest<any>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
      token,
    }),
};

// Users API
export const usersApi = {
  getAll: (token: string) =>
    apiRequest<User[]>('/users', { token }),

  getOne: (id: string, token: string) =>
    apiRequest<User>(`/users/${id}`, { token }),

  create: (data: CreateUserData, token: string) =>
    apiRequest<CreateUserResponse>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  toggleActive: (id: string, token: string) =>
    apiRequest<User>(`/users/${id}/toggle-active`, {
      method: 'PATCH',
      token,
    }),
};

// Projects API
export const projectsApi = {
  getAll: (token: string) =>
    apiRequest<Project[]>('/projects', { token }),

  getOne: (id: string, token: string) =>
    apiRequest<ProjectDetail>(`/projects/${id}`, { token }),

  create: (data: CreateProjectData, token: string) =>
    apiRequest<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (id: string, data: Partial<CreateProjectData & { status: string }>, token: string) =>
    apiRequest<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  remove: (id: string, token: string) =>
    apiRequest<void>(`/projects/${id}`, {
      method: 'DELETE',
      token,
    }),

  addMember: (projectId: string, data: { userId: string; role: string }, token: string) =>
    apiRequest<ProjectMember>(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  removeMember: (projectId: string, memberId: string, token: string) =>
    apiRequest<void>(`/projects/${projectId}/members/${memberId}`, {
      method: 'DELETE',
      token,
    }),
};

// Scopes API
export const scopesApi = {
  getAll: (projectId: string, token: string) =>
    apiRequest<Scope[]>(`/projects/${projectId}/scopes`, { token }),

  getOne: (projectId: string, scopeId: string, token: string) =>
    apiRequest<ScopeDetail>(`/projects/${projectId}/scopes/${scopeId}`, { token }),

  create: (projectId: string, data: { name: string; description?: string }, token: string) =>
    apiRequest<Scope>(`/projects/${projectId}/scopes`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (projectId: string, scopeId: string, data: Partial<{ name: string; description: string; status: string }>, token: string) =>
    apiRequest<Scope>(`/projects/${projectId}/scopes/${scopeId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  remove: (projectId: string, scopeId: string, token: string) =>
    apiRequest<void>(`/projects/${projectId}/scopes/${scopeId}`, {
      method: 'DELETE',
      token,
    }),
};

// Findings API
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type FindingStatus = 'DRAFT' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'FIXED';

export interface Finding {
  id: string;
  slug?: string;
  title: string;
  severity: Severity;
  cvssScore?: number;
  cvssVector?: string;
  description: string;
  proof?: string;
  impact?: string;
  remediation?: string;
  references?: string;
  tags?: string;
  status: FindingStatus;
  projectId: string;
  componentId?: string;
  noteId?: string;
  authorId: string;
  author?: { id: string; firstName: string; lastName: string; email: string };
  component?: { id: string; name: string; status: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateFindingData {
  title: string;
  severity: Severity;
  cvssScore?: number;
  cvssVector?: string;
  description?: string;
  proof?: string;
  impact?: string;
  remediation?: string;
  references?: string;
  tags?: string;
  status?: FindingStatus;
  componentId?: string;
  noteId?: string;
}

export const findingsApi = {
  getAllByProject: (projectId: string, token: string) =>
    apiRequest<Finding[]>(`/projects/${projectId}/findings`, { token }),

  create: (projectId: string, data: CreateFindingData, token: string) =>
    apiRequest<Finding>(`/projects/${projectId}/findings`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  getOne: (id: string, token: string) =>
    apiRequest<Finding>(`/findings/${id}`, { token }),

  update: (id: string, data: Partial<CreateFindingData>, token: string) =>
    apiRequest<Finding>(`/findings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  remove: (id: string, token: string) =>
    apiRequest<void>(`/findings/${id}`, { method: 'DELETE', token }),
};

// Reports API
export interface Report {
  id: string;
  projectId: string;
  content: any; // ProseMirror JSON document
  createdAt: string;
  updatedAt: string;
}

export const reportsApi = {
  get: (projectId: string, token: string) =>
    apiRequest<Report>(`/projects/${projectId}/report`, { token }),

  update: (projectId: string, content: any, token: string) =>
    apiRequest<Report>(`/projects/${projectId}/report`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
      token,
    }),
};

// Notes API
export const notesApi = {
  getByScope: (projectId: string, scopeId: string, token: string) =>
    apiRequest<Note[]>(`/projects/${projectId}/scopes/${scopeId}/notes`, { token }),

  getOne: (noteId: string, token: string) =>
    apiRequest<NoteDetail>(`/notes/${noteId}`, { token }),

  create: (projectId: string, scopeId: string, data: { title: string; content?: string }, token: string) =>
    apiRequest<Note>(`/projects/${projectId}/scopes/${scopeId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  update: (noteId: string, data: { title?: string; content?: string }, token: string) =>
    apiRequest<Note>(`/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      token,
    }),

  remove: (noteId: string, token: string) =>
    apiRequest<void>(`/notes/${noteId}`, {
      method: 'DELETE',
      token,
    }),
};

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'USER';
  isActive?: boolean;
  mustChangePassword?: boolean;
  createdAt?: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface SetupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  role?: 'SUPER_ADMIN' | 'USER';
}

export interface CreateUserResponse extends User {
  generatedPassword: string;
}

export type AuthProviderType = 'LOCAL' | 'OIDC' | 'LDAP' | 'SAML';

export interface AuthProviderInfo {
  id: string;
  type: AuthProviderType;
  name: string;
  displayOrder: number;
}

export interface AuthProviderFull extends AuthProviderInfo {
  isEnabled: boolean;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAuthProviderData {
  type: AuthProviderType;
  name: string;
  isEnabled?: boolean;
  config?: Record<string, any>;
  displayOrder?: number;
}

export interface CompanySettings {
  name: string;
  domain?: string;
  logoUrl?: string;
}

export type ProjectStatus = 'DRAFT' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DELIVERED' | 'ARCHIVED';
export type AuditType = 'WEB' | 'INTERNAL_AD' | 'LINUX' | 'MOBILE' | 'OTHER';
export type ScopeStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'IN_REVIEW';

export interface ProjectMember {
  id: string;
  role: 'MANAGER' | 'PENTESTER' | 'CLIENT';
  user: { id: string; firstName: string; lastName: string; email: string };
}

export interface Project {
  id: string;
  name: string;
  clientCompany: string;
  clientNeed: string;
  context: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  auditType: AuditType;
  members: ProjectMember[];
  _count?: { scopes: number };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends Project {
  scopes: Scope[];
}

export interface Scope {
  id: string;
  name: string;
  description?: string;
  status: ScopeStatus;
  _count?: { notes: number; components: number };
  createdAt: string;
  updatedAt: string;
}

export interface ScopeDetail extends Scope {
  project: { id: string; name: string };
  notes: Note[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  author: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface NoteDetail extends Note {
  scope: {
    id: string;
    name: string;
    project: { id: string; name: string };
  };
}

export interface CreateProjectData {
  name: string;
  clientCompany: string;
  clientNeed: string;
  context: string;
  startDate: string;
  endDate: string;
  auditType: AuditType;
}

export interface OnboardingData {
  admin: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };
  company: {
    name: string;
    domain?: string;
    logoUrl?: string;
  };
  auth: {
    providers: Array<{
      type: string;
      enabled: boolean;
      config?: Record<string, any>;
    }>;
  };
  ai: {
    enabled: boolean;
    provider?: string;
    apiKey?: string;
    model?: string;
  };
  smtp?: {
    enabled: boolean;
    provider?: string; // 'smtp' | 'mailgun'
    // SMTP fields
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    fromEmail?: string;
    fromName?: string;
    secure?: boolean;
    // Mailgun fields
    apiKey?: string;
    domain?: string;
  };
}
