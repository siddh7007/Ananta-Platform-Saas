import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for Team & Invitations RBAC
 * Verifies role-based access control for team management features
 */

// Mock axios for API calls
vi.mock('@/lib/axios', () => ({
  platformApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Team Types & Helpers', () => {
  describe('ROLE_CONFIG', () => {
    it('should define 5-level role hierarchy', async () => {
      const { ROLE_CONFIG } = await import('@/types/team');

      expect(ROLE_CONFIG.analyst.level).toBe(1);
      expect(ROLE_CONFIG.engineer.level).toBe(2);
      expect(ROLE_CONFIG.admin.level).toBe(3);
      expect(ROLE_CONFIG.owner.level).toBe(4);
      expect(ROLE_CONFIG.super_admin.level).toBe(5);
    });

    it('should have all required display properties', async () => {
      const { ROLE_CONFIG } = await import('@/types/team');

      Object.values(ROLE_CONFIG).forEach((config) => {
        expect(config).toHaveProperty('label');
        expect(config).toHaveProperty('color');
        expect(config).toHaveProperty('description');
        expect(config).toHaveProperty('level');
      });
    });
  });

  describe('INVITABLE_ROLES', () => {
    it('should include only customer-facing roles', async () => {
      const { INVITABLE_ROLES } = await import('@/types/team');

      expect(INVITABLE_ROLES).toContain('analyst');
      expect(INVITABLE_ROLES).toContain('engineer');
      expect(INVITABLE_ROLES).toContain('admin');
      expect(INVITABLE_ROLES).toContain('owner');
      expect(INVITABLE_ROLES).not.toContain('super_admin');
    });

    it('should have exactly 4 invitable roles', async () => {
      const { INVITABLE_ROLES } = await import('@/types/team');

      expect(INVITABLE_ROLES).toHaveLength(4);
    });
  });

  describe('canManageRole function', () => {
    it('should allow owner to manage admin', async () => {
      const { canManageRole } = await import('@/types/team');

      expect(canManageRole('owner', 'admin')).toBe(true);
    });

    it('should allow admin to manage engineer', async () => {
      const { canManageRole } = await import('@/types/team');

      expect(canManageRole('admin', 'engineer')).toBe(true);
    });

    it('should NOT allow admin to manage owner', async () => {
      const { canManageRole } = await import('@/types/team');

      expect(canManageRole('admin', 'owner')).toBe(false);
    });

    it('should NOT allow same-level role management', async () => {
      const { canManageRole } = await import('@/types/team');

      expect(canManageRole('admin', 'admin')).toBe(false);
      expect(canManageRole('engineer', 'engineer')).toBe(false);
    });

    it('should NOT allow lower role to manage higher', async () => {
      const { canManageRole } = await import('@/types/team');

      expect(canManageRole('analyst', 'admin')).toBe(false);
      expect(canManageRole('engineer', 'owner')).toBe(false);
    });

    it('should allow super_admin to manage any role', async () => {
      const { canManageRole } = await import('@/types/team');

      expect(canManageRole('super_admin', 'owner')).toBe(true);
      expect(canManageRole('super_admin', 'admin')).toBe(true);
      expect(canManageRole('super_admin', 'analyst')).toBe(true);
    });
  });

  describe('getAssignableRoles function', () => {
    it('should return empty array for analyst', async () => {
      const { getAssignableRoles } = await import('@/types/team');

      expect(getAssignableRoles('analyst')).toHaveLength(0);
    });

    it('should return [analyst] for engineer', async () => {
      const { getAssignableRoles } = await import('@/types/team');

      const roles = getAssignableRoles('engineer');
      expect(roles).toContain('analyst');
      expect(roles).toHaveLength(1);
    });

    it('should return [analyst, engineer] for admin', async () => {
      const { getAssignableRoles } = await import('@/types/team');

      const roles = getAssignableRoles('admin');
      expect(roles).toContain('analyst');
      expect(roles).toContain('engineer');
      expect(roles).toHaveLength(2);
    });

    it('should return [analyst, engineer, admin] for owner', async () => {
      const { getAssignableRoles } = await import('@/types/team');

      const roles = getAssignableRoles('owner');
      expect(roles).toContain('analyst');
      expect(roles).toContain('engineer');
      expect(roles).toContain('admin');
      expect(roles).toHaveLength(3);
    });

    it('should return all invitable roles for super_admin', async () => {
      const { getAssignableRoles } = await import('@/types/team');

      const roles = getAssignableRoles('super_admin');
      expect(roles).toContain('analyst');
      expect(roles).toContain('engineer');
      expect(roles).toContain('admin');
      expect(roles).toContain('owner');
      expect(roles).toHaveLength(4);
    });
  });
});

describe('Invitation Status Helpers', () => {
  describe('isInvitationExpired', () => {
    it('should return true for expired status', async () => {
      const { isInvitationExpired } = await import('@/types/team');

      const invitation = {
        id: '1',
        email: 'test@example.com',
        roleKey: 'engineer' as const,
        tenantId: 'tenant-1',
        invitedBy: 'user-1',
        status: 'expired' as const,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
      };

      expect(isInvitationExpired(invitation)).toBe(true);
    });

    it('should return true for past expiration date', async () => {
      const { isInvitationExpired } = await import('@/types/team');

      const invitation = {
        id: '1',
        email: 'test@example.com',
        roleKey: 'engineer' as const,
        tenantId: 'tenant-1',
        invitedBy: 'user-1',
        status: 'pending' as const,
        expiresAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        createdAt: new Date().toISOString(),
      };

      expect(isInvitationExpired(invitation)).toBe(true);
    });

    it('should return false for future expiration date', async () => {
      const { isInvitationExpired } = await import('@/types/team');

      const invitation = {
        id: '1',
        email: 'test@example.com',
        roleKey: 'engineer' as const,
        tenantId: 'tenant-1',
        invitedBy: 'user-1',
        status: 'pending' as const,
        expiresAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        createdAt: new Date().toISOString(),
      };

      expect(isInvitationExpired(invitation)).toBe(false);
    });
  });

  describe('getExpirationText', () => {
    it('should return "Expired" for past dates', async () => {
      const { getExpirationText } = await import('@/types/team');

      const pastDate = new Date(Date.now() - 86400000).toISOString();
      expect(getExpirationText(pastDate)).toBe('Expired');
    });

    it('should return days left for future dates', async () => {
      const { getExpirationText } = await import('@/types/team');

      const futureDate = new Date(Date.now() + 2 * 86400000).toISOString();
      expect(getExpirationText(futureDate)).toMatch(/\d+ days? left/);
    });

    it('should return hours left for same-day expiration', async () => {
      const { getExpirationText } = await import('@/types/team');

      const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour
      expect(getExpirationText(futureDate)).toMatch(/\d+ hours? left/);
    });

    it('should return "Expiring soon" for very close expiration', async () => {
      const { getExpirationText } = await import('@/types/team');

      const futureDate = new Date(Date.now() + 1000).toISOString(); // 1 second
      expect(getExpirationText(futureDate)).toBe('Expiring soon');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email formats', async () => {
      const { isValidEmail } = await import('@/types/team');

      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email formats', async () => {
      const { isValidEmail } = await import('@/types/team');

      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('no@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
    });
  });

  describe('getInitials', () => {
    it('should get initials from full name', async () => {
      const { getInitials } = await import('@/types/team');

      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Alice Bob Charlie')).toBe('AB');
    });

    it('should handle single word names', async () => {
      const { getInitials } = await import('@/types/team');

      expect(getInitials('John')).toBe('JO');
    });

    it('should fall back to email', async () => {
      const { getInitials } = await import('@/types/team');

      expect(getInitials(undefined, 'test@example.com')).toBe('TE');
    });

    it('should return ?? for no input', async () => {
      const { getInitials } = await import('@/types/team');

      expect(getInitials()).toBe('??');
    });
  });
});

describe('Navigation RBAC for Team', () => {
  describe('filterNavByRole', () => {
    it('should hide team for analyst', async () => {
      const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

      const filtered = filterNavByRole(navigationManifest, 'analyst');
      const teamItem = filtered.find((item) => item.name === 'team');

      expect(teamItem).toBeUndefined();
    });

    it('should hide team for engineer', async () => {
      const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

      const filtered = filterNavByRole(navigationManifest, 'engineer');
      const teamItem = filtered.find((item) => item.name === 'team');

      expect(teamItem).toBeUndefined();
    });

    it('should show team for admin', async () => {
      const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

      const filtered = filterNavByRole(navigationManifest, 'admin');
      const teamItem = filtered.find((item) => item.name === 'team');

      expect(teamItem).toBeDefined();
      expect(teamItem?.children).toBeDefined();
    });

    it('should show team for owner', async () => {
      const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

      const filtered = filterNavByRole(navigationManifest, 'owner');
      const teamItem = filtered.find((item) => item.name === 'team');

      expect(teamItem).toBeDefined();
    });

    it('should show team for super_admin', async () => {
      const { filterNavByRole, navigationManifest } = await import('@/config/navigation');

      const filtered = filterNavByRole(navigationManifest, 'super_admin');
      const teamItem = filtered.find((item) => item.name === 'team');

      expect(teamItem).toBeDefined();
    });
  });

  describe('canAccessRoute', () => {
    it('should allow /team for analyst', async () => {
      const { canAccessRoute } = await import('@/config/navigation');

      expect(canAccessRoute('analyst', '/team')).toBe(true);
    });

    it('should allow /team for engineer', async () => {
      const { canAccessRoute } = await import('@/config/navigation');

      expect(canAccessRoute('engineer', '/team')).toBe(true);
    });

    it('should allow /team for admin', async () => {
      const { canAccessRoute } = await import('@/config/navigation');

      expect(canAccessRoute('admin', '/team')).toBe(true);
    });

    it('should allow /team/invitations for admin', async () => {
      const { canAccessRoute } = await import('@/config/navigation');

      expect(canAccessRoute('admin', '/team/invitations')).toBe(true);
    });

    it('should deny /team/invitations for engineer', async () => {
      const { canAccessRoute } = await import('@/config/navigation');

      expect(canAccessRoute('engineer', '/team/invitations')).toBe(false);
    });
  });

  describe('getBreadcrumbs', () => {
    it('should return correct breadcrumbs for /team', async () => {
      const { getBreadcrumbs } = await import('@/config/navigation');

      const breadcrumbs = getBreadcrumbs('/team');

      expect(breadcrumbs).toHaveLength(2);
      expect(breadcrumbs[0]).toEqual({ label: 'Home', href: '/' });
      expect(breadcrumbs[1]).toEqual({ label: 'Team', href: '/team' });
    });

    it('should return correct breadcrumbs for /team/invitations', async () => {
      const { getBreadcrumbs } = await import('@/config/navigation');

      const breadcrumbs = getBreadcrumbs('/team/invitations');

      expect(breadcrumbs).toHaveLength(3);
      expect(breadcrumbs[0]).toEqual({ label: 'Home', href: '/' });
      expect(breadcrumbs[1]).toEqual({ label: 'Team', href: '/team' });
      expect(breadcrumbs[2]).toEqual({ label: 'Invitations', href: '/team/invitations' });
    });
  });

  describe('getNavigationForRole', () => {
    it('should include admin panel only for super_admin', async () => {
      const { getNavigationForRole } = await import('@/config/navigation');

      const superAdminNav = getNavigationForRole('super_admin');
      const ownerNav = getNavigationForRole('owner');

      const superAdminPanel = superAdminNav.find((item) => item.name === 'admin-panel');
      const ownerAdminPanel = ownerNav.find((item) => item.name === 'admin-panel');

      expect(superAdminPanel).toBeDefined();
      expect(ownerAdminPanel).toBeUndefined();
    });
  });
});

describe('Team Navigation Children', () => {
  it('should have members and invitations as children', async () => {
    const { navigationManifest } = await import('@/config/navigation');

    const teamNav = navigationManifest.find((item) => item.name === 'team');

    expect(teamNav?.children).toBeDefined();
    expect(teamNav?.children).toHaveLength(3);

    const memberChild = teamNav?.children?.find((c) => c.name === 'team-members');
    const inviteChild = teamNav?.children?.find((c) => c.name === 'team-invitations');

    expect(memberChild).toBeDefined();
    expect(memberChild?.href).toBe('/team');
    expect(memberChild?.minRole).toBe('analyst');

    expect(inviteChild).toBeDefined();
    expect(inviteChild?.href).toBe('/team/invitations');
    expect(inviteChild?.minRole).toBe('admin');

    const activityChild = teamNav?.children?.find((c) => c.name === 'team-activity');
    expect(activityChild).toBeDefined();
    expect(activityChild?.href).toBe('/team/activity');
    expect(activityChild?.minRole).toBe('analyst');
  });

  it('should use correct icons for team items', async () => {
    const { navigationManifest } = await import('@/config/navigation');

    const teamNav = navigationManifest.find((item) => item.name === 'team');

    // Team uses Users icon
    expect(teamNav?.icon.displayName || teamNav?.icon.name).toMatch(/Users/i);

    // Invitations child uses UserPlus icon
    const inviteChild = teamNav?.children?.find((c) => c.name === 'team-invitations');
    expect(inviteChild?.icon.displayName || inviteChild?.icon.name).toMatch(/UserPlus/i);
  });
});

describe('Status Color Helpers', () => {
  describe('getMemberStatusColor', () => {
    it('should return green for active', async () => {
      const { getMemberStatusColor } = await import('@/types/team');

      expect(getMemberStatusColor('active')).toContain('green');
    });

    it('should return yellow for pending', async () => {
      const { getMemberStatusColor } = await import('@/types/team');

      expect(getMemberStatusColor('pending')).toContain('yellow');
    });

    it('should return red for suspended', async () => {
      const { getMemberStatusColor } = await import('@/types/team');

      expect(getMemberStatusColor('suspended')).toContain('red');
    });
  });

  describe('getInvitationStatusColor', () => {
    it('should return yellow for pending', async () => {
      const { getInvitationStatusColor } = await import('@/types/team');

      expect(getInvitationStatusColor('pending')).toContain('yellow');
    });

    it('should return green for accepted', async () => {
      const { getInvitationStatusColor } = await import('@/types/team');

      expect(getInvitationStatusColor('accepted')).toContain('green');
    });

    it('should return gray for expired', async () => {
      const { getInvitationStatusColor } = await import('@/types/team');

      expect(getInvitationStatusColor('expired')).toContain('gray');
    });

    it('should return red for cancelled', async () => {
      const { getInvitationStatusColor } = await import('@/types/team');

      expect(getInvitationStatusColor('cancelled')).toContain('red');
    });
  });

  describe('getRoleColor', () => {
    it('should return gray for analyst', async () => {
      const { getRoleColor } = await import('@/types/team');

      expect(getRoleColor('analyst')).toContain('gray');
    });

    it('should return blue for engineer', async () => {
      const { getRoleColor } = await import('@/types/team');

      expect(getRoleColor('engineer')).toContain('blue');
    });

    it('should return purple for admin', async () => {
      const { getRoleColor } = await import('@/types/team');

      expect(getRoleColor('admin')).toContain('purple');
    });

    it('should return amber for owner', async () => {
      const { getRoleColor } = await import('@/types/team');

      expect(getRoleColor('owner')).toContain('amber');
    });

    it('should return red for super_admin', async () => {
      const { getRoleColor } = await import('@/types/team');

      expect(getRoleColor('super_admin')).toContain('red');
    });
  });
});

describe('Team Service API Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint for getTeamMembers', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.get).mockResolvedValue({ data: { data: [], total: 0 } });

    const { getTeamMembers } = await import('@/services/team.service');
    await getTeamMembers({ page: 1, limit: 10 });

    expect(platformApi.get).toHaveBeenCalledWith('/tenant-users', {
      params: { page: 1, limit: 10, status: undefined, search: undefined },
    });
  });

  it('should call correct endpoint for inviteMember', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.post).mockResolvedValue({ data: {} });

    const { inviteMember } = await import('@/services/team.service');
    await inviteMember({
      email: 'test@example.com',
      roleKey: 'engineer',
      tenantId: 'test-tenant-id',
    });

    expect(platformApi.post).toHaveBeenCalledWith('/user-invitations', {
      email: 'test@example.com',
      roleKey: 'engineer',
      tenantId: 'test-tenant-id',
      customMessage: undefined,
    });
  });

  it('should call correct endpoint for updateMemberRole', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.patch).mockResolvedValue({ data: {} });

    const { updateMemberRole } = await import('@/services/team.service');
    await updateMemberRole({ userId: 'user-123', roleKey: 'admin' });

    expect(platformApi.patch).toHaveBeenCalledWith('/tenant-users/user-123', {
      roleKey: 'admin',
    });
  });

  it('should call correct endpoint for removeMember', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.delete).mockResolvedValue({ data: {} });

    const { removeMember } = await import('@/services/team.service');
    await removeMember('user-123');

    expect(platformApi.delete).toHaveBeenCalledWith('/tenant-users/user-123');
  });

  it('should call correct endpoint for resendInvitation', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.post).mockResolvedValue({ data: {} });

    const { resendInvitation } = await import('@/services/team.service');
    await resendInvitation('invite-123');

    expect(platformApi.post).toHaveBeenCalledWith('/user-invitations/invite-123/resend');
  });

  it('should call correct endpoint for cancelInvitation', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.delete).mockResolvedValue({ data: {} });

    const { cancelInvitation } = await import('@/services/team.service');
    await cancelInvitation('invite-123');

    expect(platformApi.delete).toHaveBeenCalledWith('/user-invitations/invite-123');
  });

  it('should call correct endpoint for transferOwnership', async () => {
    const { platformApi } = await import('@/lib/axios');
    vi.mocked(platformApi.post).mockResolvedValue({ data: {} });

    const { transferOwnership } = await import('@/services/team.service');
    await transferOwnership('new-owner-123');

    expect(platformApi.post).toHaveBeenCalledWith('/tenants/transfer-ownership', {
      newOwnerId: 'new-owner-123',
    });
  });
});
