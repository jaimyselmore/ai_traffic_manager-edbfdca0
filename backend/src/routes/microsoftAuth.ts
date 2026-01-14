/**
 * Microsoft OAuth Routes
 */

import express from 'express';
import { getMicrosoftLoginUrl, handleMicrosoftCallback, disconnectMicrosoft } from '../services/microsoftAuthService';

const router = express.Router();

/**
 * GET /api/auth/microsoft/login/:werknemerId
 * Start Microsoft OAuth flow for a specific employee
 */
router.get('/login/:werknemerId', async (req, res) => {
  try {
    const { werknemerId } = req.params;

    if (!werknemerId) {
      return res.status(400).json({ error: 'werknemerId is required' });
    }

    const loginUrl = await getMicrosoftLoginUrl(werknemerId);

    // Redirect to Microsoft login page
    res.redirect(loginUrl);
  } catch (error) {
    console.error('Error generating Microsoft login URL:', error);
    res.status(500).json({ error: 'Failed to generate login URL' });
  }
});

/**
 * GET /api/auth/microsoft/callback
 * Handle OAuth callback from Microsoft
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Check if user denied consent
    if (oauthError) {
      console.error('OAuth error:', oauthError);
      return res.redirect(`${process.env.FRONTEND_URL}/agendas?error=access_denied`);
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    const werknemerId = state as string;

    // Exchange code for tokens and store them
    await handleMicrosoftCallback(code as string, werknemerId);

    // Redirect back to frontend with success
    res.redirect(`${process.env.FRONTEND_URL}/agendas?microsoft_connected=true`);
  } catch (error) {
    console.error('Error handling Microsoft callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/agendas?error=connection_failed`);
  }
});

/**
 * POST /api/auth/microsoft/disconnect/:werknemerId
 * Disconnect Microsoft account for an employee
 */
router.post('/disconnect/:werknemerId', async (req, res) => {
  try {
    const { werknemerId } = req.params;

    if (!werknemerId) {
      return res.status(400).json({ error: 'werknemerId is required' });
    }

    await disconnectMicrosoft(parseInt(werknemerId));

    res.json({ success: true, message: 'Microsoft account disconnected' });
  } catch (error) {
    console.error('Error disconnecting Microsoft:', error);
    res.status(500).json({ error: 'Failed to disconnect Microsoft account' });
  }
});

/**
 * GET /api/auth/microsoft/status/:werknemerId
 * Check if employee has Microsoft connected
 */
router.get('/status/:werknemerId', async (req, res) => {
  try {
    const { werknemerId } = req.params;

    if (!werknemerId) {
      return res.status(400).json({ error: 'werknemerId is required' });
    }

    const { supabase: supabaseAdmin } = await import('../config/supabase');

    const { data, error } = await supabaseAdmin
      .from('medewerkers')
      .select('microsoft_connected, microsoft_connected_at, microsoft_email')
      .eq('werknemer_id', parseInt(werknemerId))
      .single();

    if (error) {
      throw error;
    }

    res.json({
      connected: data.microsoft_connected || false,
      connectedAt: data.microsoft_connected_at,
      email: data.microsoft_email,
    });
  } catch (error) {
    console.error('Error checking Microsoft status:', error);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

export default router;
