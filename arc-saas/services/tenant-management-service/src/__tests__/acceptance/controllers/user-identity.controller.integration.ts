import {Client, expect, sinon} from '@loopback/testlab';
import {TenantMgmtServiceApplication} from '../../..';
import {PermissionKey} from '../../../permissions';
import {
  TenantRepository,
  UserRepository,
} from '../../../repositories/sequelize';
import {User, Tenant} from '../../../models';
import {getRepo, setupApplication} from '../test-helper';
import {STATUS_CODE} from '@sourceloop/core';
import {sign} from 'jsonwebtoken';

describe('UserIdentityController (integration)', () => {
  let app: TenantMgmtServiceApplication;
  let client: Client;
  let tenantRepo: TenantRepository;
  let userRepo: UserRepository;

  let tenantA: Tenant;
  let tenantB: Tenant;
  let tenantUser: User;
  let otherTenantUser: User;

  const auditLoggerStub = {
    log: sinon.stub().resolves(),
  };

  const keycloakAdminStub = {
    getRealmForTenant: sinon.stub().callsFake(async (tenantId: string) => `realm-${tenantId}`),
    getUserSessions: sinon.stub(),
    terminateSession: sinon.stub().resolves(),
    terminateAllUserSessions: sinon.stub().resolves(),
    getLoginEvents: sinon.stub().resolves({events: [], count: 0}),
    isUserLockedOut: sinon.stub().resolves(false),
  };

  before('setupApplication', async () => {
    ({app, client} = await setupApplication());
    tenantRepo = await getRepo(app, 'repositories.TenantRepository');
    userRepo = await getRepo(app, 'repositories.UserRepository');

    app.bind('services.KeycloakAdminService').to(keycloakAdminStub);
    app.bind('services.AuditLoggerService').to(auditLoggerStub);
  });

  after(async () => {
    await app.stop();
  });

  beforeEach(async () => {
    auditLoggerStub.log.resetHistory();
    resetKeycloakStubHistory();

    await userRepo.deleteAllHard();
    await tenantRepo.deleteAllHard();

    tenantA = await tenantRepo.create({
      name: 'Tenant A',
      key: `tenant-a-${Date.now()}`,
      status: 1,
    });
    tenantB = await tenantRepo.create({
      name: 'Tenant B',
      key: `tenant-b-${Date.now()}`,
      status: 1,
    });

    tenantUser = await userRepo.create({
      email: 'tenant.a@example.com',
      firstName: 'Tenant',
      lastName: 'Admin',
      status: 1,
      tenantId: tenantA.id,
      authId: '11111111-1111-4111-8111-111111111111',
    });

    otherTenantUser = await userRepo.create({
      email: 'tenant.b@example.com',
      firstName: 'Tenant',
      lastName: 'User',
      status: 1,
      tenantId: tenantB.id,
      authId: '22222222-2222-4222-8222-222222222222',
    });

    seedDefaultSessionResponse();
  });

  function resetKeycloakStubHistory() {
    keycloakAdminStub.getRealmForTenant.resetHistory();
    keycloakAdminStub.getUserSessions.resetHistory();
    keycloakAdminStub.terminateSession.resetHistory();
    keycloakAdminStub.terminateAllUserSessions.resetHistory();
    keycloakAdminStub.getLoginEvents.resetHistory();
    keycloakAdminStub.isUserLockedOut.resetHistory();
  }

  function seedDefaultSessionResponse() {
    keycloakAdminStub.getUserSessions.resolves({
      sessions: [
        {
          id: 'session-1',
          username: tenantUser.email,
          userId: tenantUser?.authId ?? '11111111-1111-4111-8111-111111111111',
          ipAddress: '127.0.0.1',
          start: Date.now(),
          lastAccess: Date.now(),
          clients: {admin: 'admin-app'},
        },
      ],
      count: 1,
    });
  }

  function buildAuthHeader(tenantId: string, permissions: string[]): string {
    const token = sign(
      {
        id: 'test-admin',
        tenantId,
        userTenantId: tenantId,
        permissions,
        iss: process.env.JWT_ISSUER || 'arc-saas',
      },
      process.env.JWT_SECRET ?? 'test',
    );
    return `Bearer ${token}`;
  }

  it('returns sessions for a user in the same tenant', async () => {
    const token = buildAuthHeader(tenantA.id, [PermissionKey.ViewUserSessions]);

    const {body} = await client
      .get(`/users/${tenantUser.id}/identity/sessions`)
      .set('Authorization', token)
      .expect(STATUS_CODE.OK);

    expect(body.count).to.equal(1);
    sinon.assert.calledWith(keycloakAdminStub.getRealmForTenant, tenantA.id);
    sinon.assert.calledWith(
      keycloakAdminStub.getUserSessions,
      `realm-${tenantA.id}`,
      tenantUser.authId,
    );
  });

  it('enforces tenant isolation when accessing identity endpoints', async () => {
    const token = buildAuthHeader(tenantA.id, [PermissionKey.ViewUserSessions]);

    await client
      .get(`/users/${otherTenantUser.id}/identity/sessions`)
      .set('Authorization', token)
      .expect(STATUS_CODE.FORBIDDEN);
  });

  it('requires ViewUserSessions permission', async () => {
    const token = buildAuthHeader(tenantA.id, []);

    await client
      .get(`/users/${tenantUser.id}/identity/sessions`)
      .set('Authorization', token)
      .expect(STATUS_CODE.FORBIDDEN);
  });

  it('terminates a session only when it belongs to the user', async () => {
    const token = buildAuthHeader(tenantA.id, [
      PermissionKey.TerminateUserSession,
    ]);

    await client
      .del(`/users/${tenantUser.id}/identity/sessions/session-1`)
      .set('Authorization', token)
      .expect(STATUS_CODE.NO_CONTENT);

    sinon.assert.calledWith(
      keycloakAdminStub.terminateSession,
      `realm-${tenantA.id}`,
      'session-1',
    );
  });

  it('rejects session termination when the session is not owned by the user', async () => {
    keycloakAdminStub.getUserSessions.resolves({
      sessions: [],
      count: 0,
    });

    const token = buildAuthHeader(tenantA.id, [
      PermissionKey.TerminateUserSession,
    ]);

    await client
      .del(`/users/${tenantUser.id}/identity/sessions/unknown-session`)
      .set('Authorization', token)
      .expect(STATUS_CODE.FORBIDDEN);

    sinon.assert.notCalled(keycloakAdminStub.terminateSession);
  });

  it('accepts legacy maxResults query parameter for login events', async () => {
    keycloakAdminStub.getLoginEvents.resolves({events: [], count: 0});

    const token = buildAuthHeader(tenantA.id, [PermissionKey.ViewLoginEvents]);

    await client
      .get(
        `/users/${tenantUser.id}/identity/login-events?maxResults=25`,
      )
      .set('Authorization', token)
      .expect(STATUS_CODE.OK);

    sinon.assert.calledWith(
      keycloakAdminStub.getLoginEvents,
      `realm-${tenantA.id}`,
      tenantUser.authId,
      25,
    );
  });

  it('requires ViewUserMfa permission for lockout checks and returns Keycloak status', async () => {
    keycloakAdminStub.isUserLockedOut.resolves(true);

    const token = buildAuthHeader(tenantA.id, [PermissionKey.ViewUserMfa]);

    const {body} = await client
      .get(`/users/${tenantUser.id}/identity/lockout-status`)
      .set('Authorization', token)
      .expect(STATUS_CODE.OK);

    expect(body).to.deepEqual({isLockedOut: true});
    sinon.assert.calledWith(
      keycloakAdminStub.isUserLockedOut,
      `realm-${tenantA.id}`,
      tenantUser.authId,
    );
  });
});
