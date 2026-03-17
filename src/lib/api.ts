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
    apiRequest<User>('/users', {
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

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'USER';
  isActive?: boolean;
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
  password: string;
  firstName: string;
  lastName: string;
  role?: 'SUPER_ADMIN' | 'USER';
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
