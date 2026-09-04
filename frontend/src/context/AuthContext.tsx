import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  initials: string;
  merchantId: string;
  merchantName: string;
  merchantTier: string;
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

export const DEMO_PERSONAS = [
  {
    id: 'user_01',
    name: 'Mohan Kumar',
    email: 'mohan.k@abcelectronics.com',
    role: 'Risk Operations Lead',
    initials: 'MK',
    merchantId: 'merchant_001',
    merchantName: 'ABC Electronics Pvt Ltd',
    merchantTier: 'Tier 1 (High Velocity)',
    description: 'Full administrative access to risk policies, automated gates & live actions.',
  },
  {
    id: 'user_02',
    name: 'Sarah Verma',
    email: 'sarah.v@abcelectronics.com',
    role: 'Senior Fraud Analyst',
    initials: 'SV',
    merchantId: 'merchant_001',
    merchantName: 'ABC Electronics Pvt Ltd',
    merchantTier: 'Tier 1 (High Velocity)',
    description: 'Triage live anomalies, run agent investigations & review flagged spikes.',
  },
  {
    id: 'user_03',
    name: 'Arun Nair',
    email: 'arun.n@apexretail.in',
    role: 'Head of Compliance & Risk',
    initials: 'AN',
    merchantId: 'merchant_004',
    merchantName: 'Apex Luxury Retail',
    merchantTier: 'Tier 2 (High Ticket)',
    description: 'Oversees SOC-2 / PCI audit trails, model performance benchmarks & KYC.',
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
  login: (email: string, password?: string) => boolean;
  loginAsPersona: (personaId: string) => void;
  logout: () => void;
  switchMerchant: (merchantId: string) => void;
  updateRiskPolicy: (updates: Partial<RiskPolicyConfig>) => void;
  updateMerchantProfile: (updates: Partial<Merchant>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'razorshield_auth_user';
const POLICY_STORAGE_KEY = 'razorshield_risk_policy';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    // Default demo user logged in for immediate hackathon view
    return {
      id: DEMO_PERSONAS[0].id,
      name: DEMO_PERSONAS[0].name,
      email: DEMO_PERSONAS[0].email,
      role: DEMO_PERSONAS[0].role,
      initials: DEMO_PERSONAS[0].initials,
      merchantId: DEMO_PERSONAS[0].merchantId,
      merchantName: DEMO_PERSONAS[0].merchantName,
      merchantTier: DEMO_PERSONAS[0].merchantTier,
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

  const login = (email: string, _password?: string): boolean => {
    // Check if matching any demo persona
    const foundPersona = DEMO_PERSONAS.find(p => p.email.toLowerCase() === email.toLowerCase());
    if (foundPersona) {
      setUser({
        id: foundPersona.id,
        name: foundPersona.name,
        email: foundPersona.email,
        role: foundPersona.role,
        initials: foundPersona.initials,
        merchantId: foundPersona.merchantId,
        merchantName: foundPersona.merchantName,
        merchantTier: foundPersona.merchantTier,
      });
      return true;
    }

    // Custom merchant user
    const username = email.split('@')[0] || 'Merchant';
    const initials = username.slice(0, 2).toUpperCase();
    setUser({
      id: `usr_${Math.random().toString(36).slice(2, 7)}`,
      name: username.charAt(0).toUpperCase() + username.slice(1),
      email,
      role: 'Merchant Risk Manager',
      initials,
      merchantId: 'merchant_001',
      merchantName: 'ABC Electronics Pvt Ltd',
      merchantTier: 'Tier 1 (High Velocity)',
    });
    return true;
  };

  const loginAsPersona = (personaId: string) => {
    const persona = DEMO_PERSONAS.find(p => p.id === personaId) || DEMO_PERSONAS[0];
    setUser({
      id: persona.id,
      name: persona.name,
      email: persona.email,
      role: persona.role,
      initials: persona.initials,
      merchantId: persona.merchantId,
      merchantName: persona.merchantName,
      merchantTier: persona.merchantTier,
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
