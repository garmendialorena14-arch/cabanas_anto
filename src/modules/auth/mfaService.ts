import { createClient } from '@/shared/lib/supabase/client';

export interface MfaStatus {
  hasMfa: boolean;
  currentLevel: 'aal1' | 'aal2';
  factorId?: string;
}

export async function checkMfaStatus(): Promise<MfaStatus> {
  const supabase = createClient();
  const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || !aalData) {
    return { hasMfa: false, currentLevel: 'aal1' };
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const verifiedFactor = factorsData?.totp?.find((f) => f.status === 'verified');

  return {
    hasMfa: !!verifiedFactor,
    currentLevel: aalData.currentLevel as 'aal1' | 'aal2',
    factorId: verifiedFactor?.id,
  };
}

export async function enrollTotpFactor() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Cabañas Anto 2FA',
  });

  if (error) throw error;
  return data;
}

export async function verifyTotpEnrollment(factorId: string, code: string) {
  const supabase = createClient();
  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });

  if (challengeError) throw challengeError;

  const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });

  if (verifyError) throw verifyError;
  return verifyData;
}

export async function verifyTotpChallenge(factorId: string, code: string) {
  const supabase = createClient();
  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });

  if (challengeError) throw challengeError;

  const { data, error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });

  if (error) throw error;
  return data;
}
