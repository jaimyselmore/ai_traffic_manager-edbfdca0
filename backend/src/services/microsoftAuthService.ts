/**
 * Microsoft Authentication Service
 * Handles OAuth2 flow with Microsoft Identity Platform
 */

import { ConfidentialClientApplication, AuthorizationUrlRequest, AuthorizationCodeRequest } from '@azure/msal-node';
import { encryptToken, decryptToken } from '../utils/encryption';
import { supabase as supabaseAdmin } from '../config/supabase';

// MSAL Configuration
const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
  },
};

const msalClient = new ConfidentialClientApplication(msalConfig);

const REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/auth/microsoft/callback';
const SCOPES = ['User.Read', 'Calendars.ReadWrite', 'offline_access'];

/**
 * Generate Microsoft login URL
 */
export async function getMicrosoftLoginUrl(werknemerId: string): Promise<string> {
  const authCodeUrlParameters: AuthorizationUrlRequest = {
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
    state: werknemerId, // We gebruiken state om te weten welke werknemer aan het inloggen is
  };

  const authUrl = await msalClient.getAuthCodeUrl(authCodeUrlParameters);
  return authUrl;
}

/**
 * Handle OAuth callback and exchange code for tokens
 */
export async function handleMicrosoftCallback(code: string, werknemerId: string) {
  // Exchange authorization code for tokens
  const tokenRequest: AuthorizationCodeRequest = {
    code,
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  };

  const response = await msalClient.acquireTokenByCode(tokenRequest);

  if (!response || !response.accessToken) {
    throw new Error('Failed to acquire tokens from Microsoft');
  }

  // MSAL caches tokens internally, we'll store account info for token refresh
  const account = response.account;
  if (!account) {
    throw new Error('No account information in response');
  }

  // Store the access token and account info for future token refresh
  const encryptedAccessToken = encryptToken(response.accessToken);
  const encryptedAccountInfo = encryptToken(JSON.stringify(account));

  // Calculate token expiration from expiresOn (Date object)
  const expiresAt = response.expiresOn || new Date(Date.now() + 3600 * 1000);

  // Store encrypted tokens in database
  const { error: tokenError } = await supabaseAdmin
    .from('microsoft_tokens')
    .upsert({
      werknemer_id: parseInt(werknemerId),
      access_token_encrypted: encryptedAccessToken,
      refresh_token_encrypted: encryptedAccountInfo, // Store account info for refresh
      token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (tokenError) {
    throw new Error(`Failed to store tokens: ${tokenError.message}`);
  }

  // Update medewerker status
  const { error: medewerkError } = await supabaseAdmin
    .from('medewerkers')
    .update({
      microsoft_connected: true,
      microsoft_connected_at: new Date().toISOString(),
    })
    .eq('werknemer_id', parseInt(werknemerId));

  if (medewerkError) {
    throw new Error(`Failed to update employee: ${medewerkError.message}`);
  }

  return {
    success: true,
    message: 'Microsoft account successfully connected',
  };
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(werknemerId: number): Promise<string> {
  // Get tokens from database
  const { data: tokenData, error } = await supabaseAdmin
    .from('microsoft_tokens')
    .select('*')
    .eq('werknemer_id', werknemerId)
    .single();

  if (error || !tokenData) {
    throw new Error('No Microsoft tokens found for this employee');
  }

  // Check if token is expired
  const now = new Date();
  const expiresAt = new Date(tokenData.token_expires_at);

  if (now < expiresAt) {
    // Token is still valid
    return decryptToken(tokenData.access_token_encrypted);
  }

  // Token expired, refresh it using silent token acquisition
  const accountInfo = JSON.parse(decryptToken(tokenData.refresh_token_encrypted));

  const response = await msalClient.acquireTokenSilent({
    account: accountInfo,
    scopes: SCOPES,
  });

  if (!response || !response.accessToken) {
    throw new Error('Failed to refresh access token');
  }

  // Update tokens in database
  const newExpiresAt = response.expiresOn || new Date(Date.now() + 3600 * 1000);

  const encryptedAccessToken = encryptToken(response.accessToken);
  // Keep the account info for future refreshes
  const encryptedAccountInfo = tokenData.refresh_token_encrypted;

  await supabaseAdmin
    .from('microsoft_tokens')
    .update({
      access_token_encrypted: encryptedAccessToken,
      refresh_token_encrypted: encryptedAccountInfo,
      token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('werknemer_id', werknemerId);

  return response.accessToken;
}

/**
 * Disconnect Microsoft account
 */
export async function disconnectMicrosoft(werknemerId: number) {
  // Delete tokens
  await supabaseAdmin
    .from('microsoft_tokens')
    .delete()
    .eq('werknemer_id', werknemerId);

  // Update medewerker status
  await supabaseAdmin
    .from('medewerkers')
    .update({
      microsoft_connected: false,
      microsoft_connected_at: null,
    })
    .eq('werknemer_id', werknemerId);

  return { success: true };
}
