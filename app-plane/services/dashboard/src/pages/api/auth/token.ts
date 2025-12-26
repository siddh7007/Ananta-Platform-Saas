/**
 * Get Auth0 Access Token
 *
 * Returns the access token for making authenticated API calls
 */

import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextApiRequest, NextApiResponse } from 'next';

export default withApiAuthRequired(async function token(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { accessToken } = await getAccessToken(req, res, {
      scopes: ['openid', 'profile', 'email'],
    });

    res.status(200).json({ accessToken });
  } catch (error: any) {
    console.error('[Auth0] Token endpoint error:', error);
    res.status(error.status || 500).json({
      error: error.code || 'access_token_error',
      message: error.message || 'Failed to get access token',
    });
  }
});
