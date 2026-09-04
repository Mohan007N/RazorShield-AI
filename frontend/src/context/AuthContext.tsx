import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type UserRole = 'analyst' | 'risk_manager' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  avatar?: string;
  initials: string;
  merchantId: string;
  merchantName: string;
  merchantTier: string;
  permissions: string[];
  token?: string;
}

export interface Merchant {
  id: string;
  name: string;
  category: string;
  tier: string;
  baselineRate: number;
  monthlyVolume: string;
  status: 'active' | 'review' | 'restricted';
}

export interface RiskPolicyConfig {
  autoBlockThreshold: number;
  humanReviewThreshold: number;
  autoAllowThreshold: number;
  spikeMultiplierThreshold: number;
  autoHoldSettlement: boolean;
  strictDeviceFingerprint: boolean;
  geoFencingEnabled: boolean;
  rateLimitPerMinute: number;
  slackAlerts: boolean;
  pagerDutyAlerts: boolean;
  emailAlerts: boolean;
  webhookUrl: string;
}

export const MERCHANTS: Merchant[] = [
  {
    id: 'merchant_001',
    name: 'ABC Electronics Pvt Ltd',
    category: 'Consumer Electronics & Gadgets',
    tier: 'Tier 1 (High Velocity)',
    baselineRate: 120,
    monthlyVolume: '₹4.8 Cr / mo',
    status: 'active',
  },
  {
    id: 'merchant_004',
    name: 'Apex Luxury Retail',
    category: 'Luxury Fashion & Jewelry',
    tier: 'Tier 2 (High Ticket)',
    baselineRate: 45,
    monthlyVolume: '₹2.1 Cr / mo',
    status: 'active',
  },
  {
    id: 'merchant_008',
    name: 'CloudScale SaaS India',
    category: 'Digital B2B Software',
    tier: 'Tier 1 (Subscription & Recurring)',
    baselineRate: 85,
    monthlyVolume: '₹1.5 Cr / mo',
    status: 'active',
  },
  {
    id: 'merchant_016',
    name: 'BharatMart UPI Superstore',
    category: 'Omnichannel Grocery & Retail',
    tier: 'Tier 3 (Micro-Transactions)',
    baselineRate: 350,
    monthlyVolume: '₹8.4 Cr / mo',
    status: 'active',
  },
];

export const DEMO_PERSONAS: (Omit<User, 'token'> & { description: string })[] = [
  {
    id: 'usr_mohan_001',
    name: 'Mohan Kumar',
    email: 'mohan.k@abcelectronics.com',
    role: 'admin',
    roleTitle: 'Risk Operations Lead (Admin)',
    initials: 'MK',
    merchantId: 'merchant_001',
    merchantName: 'ABC Electronics Pvt Ltd',
    merchantTier: 'Tier 1 (High Velocity)',
    permissions: ['*'],
    description: 'Full administrative authority over risk policies, automated gates & live actions.',
  },
  {
    id: 'usr_sarah_002',
    name: 'Sarah Verma',
    email: 'sarah.v@abcelectronics.com',
    role: 'risk_manager',
    roleTitle: 'Senior Fraud Analyst (Risk Manager)',
    initials: 'SV',
    merchantId: 'merchant_001',
    merchantName: 'ABC Electronics Pvt Ltd',
    merchantTier: 'Tier 1 (High Velocity)',
    permissions: ['alerts:read', 'investigate:run', 'evidence:read', 'shap:read', 'action:approve', 'action:reject'],
    description: 'Investigate live anomalies, inspect SHAP, and digitally sign off on gated actions.',
  },
  {
    id: 'usr_arun_003',
    name: 'Arun Nair',
    email: 'arun.n@apexretail.in',
    role: 'analyst',
    roleTitle: 'Compliance & Risk Analyst',
    initials: 'AN',
    merchantId: 'merchant_004',
    merchantName: 'Apex Luxury Retail',
    merchantTier: 'Tier 2 (High Ticket)',
    permissions: ['alerts:read', 'investigate:read', 'evidence:read', 'shap:read'],
    description: 'View-only investigation & compliance audit inspection.',
  },
];

const DEFAULT_RISK_POLICY: RiskPolicyConfig = {
  autoBlockThreshold: 85,
  humanReviewThreshold: 60,
  autoAllowThreshold: 59,
  spikeMultiplierThreshold: 4.0,
  autoHoldSettlement: true,
  strictDeviceFingerprint: true,
  geoFencingEnabled: false,
  rateLimitPerMinute: 800,
  slackAlerts: true,
  pagerDutyAlerts: false,
  emailAlerts: true,
  webhookUrl: 'https://api.abcelectronics.com/webhooks/razorshield',
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  activeMerchant: Merchant;
  allMerchants: Merchant[];
  riskPolicy: RiskPolicyConfig;
  hasPermission: (permission: string) => boolean;
  canApproveActions: boolean;
  canEditPolicies: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  loginAsPersona: (personaId: string) => void;
  logout: () => void;
  switchMerchant: (merchantId: string) => void;
  updateRiskPolicy: (updates: Partial<RiskPolicyConfig>) => void;
  updateMerchantProfile: (updates: Partial<Merchant>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'razorshield_auth_user_v2';
const POLICY_STORAGE_KEY = 'razorshield_risk_policy_v2';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    // Default active persona: Admin (Mohan Kumar)
    return {
      ...DEMO_PERSONAS[0],
      token: 'demo-jwt-token-admin',
    };
  });

  const [allMerchants, setAllMerchants] = useState<Merchant[]>(MERCHANTS);

  const [riskPolicy, setRiskPolicy] = useState<RiskPolicyConfig>(() => {
    try {
      const saved = localStorage.getItem(POLICY_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_RISK_POLICY;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(riskPolicy));
  }, [riskPolicy]);

  const activeMerchant = allMerchants.find(m => m.id === (user?.merchantId || 'merchant_001')) || allMerchants[0];

  const hasPermission = (perm: string): boolean => {
    if (!user) return false;
    if (user.permissions.includes('*') || user.role === 'admin') return true;
    return user.permissions.includes(perm);
  };

  const canApproveActions = user?.role === 'admin' || user?.role === 'risk_manager';
  const canEditPolicies = user?.role === 'admin';

  const login = async (email: string, password?: string): Promise<boolean> => {
    try {
      // Try backend JWT auth endpoint
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: password || 'password123' }),
      });

      if (res.ok) {
        const data = await res.json();
        const role = data.user.role as UserRole;
        const roleTitle = role === 'admin' ? 'Risk Operations Lead (Admin)' : role === 'risk_manager' ? 'Risk Manager' : 'Fraud Analyst';
        setUser({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: role,
          roleTitle,
          initials: data.user.name.slice(0, 2).toUpperCase(),
          merchantId: data.user.merchant_id,
          merchantName: data.user.merchant_name,
          merchantTier: 'Tier 1 (High Velocity)',
          permissions: data.user.permissions,
          token: data.access_token,
        });
        return true;
      }
    } catch {
      // Fallback local logic
    }

    const found = DEMO_PERSONAS.find(p => p.email.toLowerCase() === email.toLowerCase()) || DEMO_PERSONAS[0];
    setUser({ ...found, token: `jwt-${found.id}` });
    return true;
  };

  const loginAsPersona = (personaId: string) => {
    const persona = DEMO_PERSONAS.find(p => p.id === personaId) || DEMO_PERSONAS[0];
    setUser({
      ...persona,
      token: `jwt-${persona.id}`,
    });
  };

  const logout = () => {
    setUser(null);
  };

  const switchMerchant = (merchantId: string) => {
    const target = allMerchants.find(m => m.id === merchantId);
    if (!target) return;
    if (user) {
      setUser({
        ...user,
        merchantId: target.id,
        merchantName: target.name,
        merchantTier: target.tier,
      });
    }
  };

  const updateRiskPolicy = (updates: Partial<RiskPolicyConfig>) => {
    setRiskPolicy(prev => ({ ...prev, ...updates }));
  };

  const updateMerchantProfile = (updates: Partial<Merchant>) => {
    setAllMerchants(prev =>
      prev.map(m => (m.id === activeMerchant.id ? { ...m, ...updates } : m))
    );
    if (user && updates.name) {
      setUser(prev => prev ? { ...prev, merchantName: updates.name! } : null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        activeMerchant,
        allMerchants,
        riskPolicy,
        hasPermission,
        canApproveActions,
        canEditPolicies,
        login,
        loginAsPersona,
        logout,
        switchMerchant,
        updateRiskPolicy,
        updateMerchantProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
