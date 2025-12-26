import {AnyObject} from '@loopback/repository';

export enum IdPKey {
  AUTH0 = 'auth0',
  COGNITO = 'cognito',
  KEYCLOAK = 'keycloak',
}

export type ConfigureIdpFunc<T> = (payload: IdpDetails) => Promise<T>;

export interface IdpDetails {
  tenant: AnyObject;
  plan: AnyObject;
}

export interface IdpResp {
  authId: string;
}

/**
 * Parameters for creating a regular user (not admin) in IdP
 */
export interface CreateIdpUserPayload {
  tenantId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Function type for creating users in IdP
 */
export type CreateIdpUserFunc = (
  payload: CreateIdpUserPayload,
) => Promise<IdpResp>;
