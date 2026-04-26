import Constants from 'expo-constants';

export type Role = 'trader' | 'driver' | 'sme';

export type RegisterPayload = {
  role: Role;
  name: string;
  phone: string;
  email: string;
  password: string;
  city?: string;
  cnic?: string;
  truckType?: string;
  truckReg?: string;
  capacity?: string;
  businessName?: string;
  businessType?: string;
  ntn?: string;
  address?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
  role?: Role;
};

function deriveApiUrlFromExpoHost(): string | undefined {
  const constantsAny = Constants as any;
  const possibleHosts = [
    constantsAny?.expoConfig?.hostUri,
    constantsAny?.manifest2?.extra?.expoGo?.debuggerHost,
    constantsAny?.manifest?.debuggerHost,
    constantsAny?.expoGoConfig?.debuggerHost,
  ].filter(Boolean) as string[];

  const hostEntry = possibleHosts.find(Boolean);
  if (!hostEntry) return undefined;

  const host = hostEntry.split(':')[0];
  if (!host) return undefined;

  return `http://${host}/api`;
}

const fallbackUrl = deriveApiUrlFromExpoHost() ?? 'http://13.233.124.213:8000/api';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  deriveApiUrlFromExpoHost() ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  fallbackUrl;

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const url = `http://13.233.124.213:8000/api${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const raw = await response.text();
  let data: any;

  try {
    data = raw ? JSON.parse(raw) : undefined;
  } catch (_err) {
    data = raw;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.detail ||
      data?.error ||
      (typeof data === 'string' && data) ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }

  return (data ?? {}) as T;
}

export function registerUser(payload: RegisterPayload) {
  return request('/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: LoginPayload) {
  return request('/login/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
