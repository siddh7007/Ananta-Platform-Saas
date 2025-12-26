import {Provider, ValueOrPromise, service} from '@loopback/core';
import {verify} from 'jsonwebtoken';
import {VerifyFunction} from 'loopback4-authentication';
import {LeadUser, LeadUserWithToken} from '../types';
import {HttpErrors} from '@loopback/rest';
import {LeadAuthenticator} from '../services/lead-authenticator.service';
export class LeadTokenVerifierProvider
  implements Provider<VerifyFunction.BearerFn<LeadUser>>
{
  constructor(
    @service(LeadAuthenticator)
    public leadAuthenticator: LeadAuthenticator,
  ) {}
  value(): ValueOrPromise<VerifyFunction.BearerFn<LeadUser>> {
    return async token => {
      const response = await this.leadAuthenticator.getToken(token);
      if (!response || !response.token) {
        throw new HttpErrors.Unauthorized();
      }
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error(
          'JWT_SECRET is not defined in the environment variables.',
        );
      }
      //sonarignore:start
      const data = verify(response.token, secret, {
        //sonarignore:end
        issuer: process.env.JWT_ISSUER,
        algorithms: ['HS256'],
      }) as Object;
      return {
        token: response.token,
        ...data,
      } as LeadUserWithToken;
    };
  }
}
