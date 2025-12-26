# Legacy CBP Cutover Plan

This document outlines the strategy for transitioning from the legacy Customer Business Portal (CBP) to the new CBP built on Refine + Shadcn.

## Overview

| Aspect | Legacy CBP | New CBP |
|--------|------------|---------|
| Framework | React Admin | Refine + Shadcn |
| Auth | Custom Keycloak integration | oidc-client-ts + Keycloak PKCE |
| State | Local + Supabase direct | Tenant context + API providers |
| Styling | Custom CSS | Tailwind + Shadcn |
| Port | 27100 | 27555 (dev), TBD (prod) |

---

## Phase 1: Parallel Operation (Current)

### Status: IN PROGRESS

Both portals run simultaneously:
- Legacy CBP: `http://localhost:27100`
- New CBP: `http://localhost:27555`

### Prerequisites Checklist

- [x] New CBP feature parity for core flows:
  - [x] Auth (Keycloak login/logout)
  - [x] Tenant selection
  - [x] BOM list/upload/detail
  - [x] Component search/detail
  - [x] Billing overview
  - [x] Team management
  - [x] Organization settings

- [x] API compatibility verified:
  - [x] Platform API (tenant-management-service)
  - [x] CNS API (cns-service)
  - [x] Supabase API (component catalog)

- [x] RBAC alignment:
  - [x] 5-level role hierarchy implemented
  - [x] Navigation filtering by role
  - [x] Action-level permissions

- [ ] Data migration (if needed):
  - [ ] User preferences (none stored locally in legacy)
  - [ ] No database changes required

---

## Phase 2: Beta Testing

### Status: PENDING

### Duration: 1-2 weeks

### Actions

1. **Select beta users**
   - Invite 5-10 power users to test new CBP
   - Provide feedback form/channel

2. **Enable feature flag**
   ```bash
   # In .env
   VITE_ENABLE_NEW_CBP_BANNER=true
   ```
   This shows a banner in legacy CBP: "Try the new CBP (Beta)"

3. **Monitor metrics**
   - Error rates via Sentry (if configured)
   - API response times
   - User feedback

4. **Bug fixes**
   - Address issues found during beta
   - Prioritize blockers

### Exit Criteria

- [ ] No P0/P1 bugs in new CBP
- [ ] Positive feedback from >80% of beta users
- [ ] All core flows tested by beta users
- [ ] Performance on par with legacy

---

## Phase 3: Gradual Rollout

### Status: PENDING

### Duration: 1-2 weeks

### Actions

1. **Traffic split**
   - Route 10% → 50% → 100% of traffic to new CBP
   - Use environment variable or load balancer rules

2. **DNS/Routing options**

   **Option A: Subdomain**
   ```
   cbp.example.com     → Legacy CBP (initially)
   new-cbp.example.com → New CBP (beta)

   After cutover:
   cbp.example.com     → New CBP
   legacy.cbp.example.com → Legacy (for emergencies)
   ```

   **Option B: Same domain, path-based**
   ```
   cbp.example.com/     → New CBP
   cbp.example.com/v1/  → Legacy CBP (emergency access)
   ```

   **Option C: Feature flag per tenant**
   ```typescript
   // In tenant-management-service
   if (tenant.features.newPortal) {
     redirect to new CBP
   } else {
     serve legacy CBP
   }
   ```

3. **Keycloak client configuration**
   - Ensure `cbp-frontend` client has correct redirect URIs for both portals
   - Add new CBP URLs to allowed origins

---

## Phase 4: Full Cutover

### Status: PENDING

### Checklist

1. **Pre-cutover (1 day before)**
   - [ ] Final backup of legacy CBP assets
   - [ ] Verify all Keycloak redirect URIs
   - [ ] Notify users of scheduled cutover
   - [ ] Prepare rollback script

2. **Cutover (maintenance window)**
   - [ ] Update DNS/routing to point to new CBP
   - [ ] Update Keycloak client redirect URIs
   - [ ] Clear any CDN caches
   - [ ] Verify login flow works
   - [ ] Test all critical paths

3. **Post-cutover (monitoring)**
   - [ ] Monitor error rates for 24 hours
   - [ ] Watch for user-reported issues
   - [ ] Keep legacy CBP running but not routed

---

## Phase 5: Decommission Legacy

### Status: PENDING

### Duration: After 2 weeks of stable new CBP

### Actions

1. **Archive legacy code**
   ```bash
   # Create archive branch
   git checkout -b archive/legacy-cbp-2024
   git push origin archive/legacy-cbp-2024
   ```

2. **Stop legacy containers**
   ```bash
   docker-compose stop legacy-cbp
   ```

3. **Remove from CI/CD**
   - Remove legacy CBP build jobs
   - Remove legacy CBP deployment configs

4. **Update documentation**
   - Remove legacy CBP references
   - Update architecture diagrams
   - Archive legacy docs

5. **Clean up Keycloak**
   - Remove legacy redirect URIs from `cbp-frontend` client
   - Remove any legacy-specific client scopes (if any)

---

## Rollback Procedure

If issues arise after cutover:

### Immediate Rollback (< 1 hour to restore)

```bash
# 1. Revert DNS/routing
# This depends on your infrastructure

# 2. Update Keycloak client (if URIs changed)
# Restore previous redirect URIs

# 3. Clear CDN cache (if applicable)

# 4. Notify users
# Send communication about temporary revert
```

### Partial Rollback (specific features)

If only certain features are broken:

1. Enable feature flag to disable broken feature in new CBP
2. Provide link to legacy CBP for that feature only
3. Fix issue in new CBP
4. Re-enable feature

---

## Communication Template

### Pre-cutover announcement

```
Subject: Upcoming Customer Portal Upgrade

We're upgrading the Customer Business Portal to a new, improved version.

What's new:
- Faster performance
- Improved navigation
- Better mobile experience
- Enhanced team management

When: [DATE/TIME]
Expected downtime: None (seamless transition)

What you need to do: Nothing - your login credentials remain the same.

Questions? Contact support@example.com
```

### Post-cutover confirmation

```
Subject: Customer Portal Upgrade Complete

The Customer Business Portal has been upgraded successfully.

If you experience any issues:
1. Try clearing your browser cache
2. Log out and log back in
3. Contact support@example.com

Thank you for your patience!
```

---

## Metrics to Track

| Metric | Tool | Target |
|--------|------|--------|
| Error rate | Sentry | < 0.1% |
| Page load time | Browser timing | < 2s |
| API response time | Backend logs | < 500ms p95 |
| Login success rate | Keycloak metrics | > 99% |
| User satisfaction | Survey/feedback | > 80% positive |

---

## Dependencies

| Dependency | Owner | Status |
|------------|-------|--------|
| DNS changes | DevOps | PENDING |
| Keycloak config | Platform team | READY |
| CDN config | DevOps | PENDING |
| User communication | Product | PENDING |
| Support training | Support | PENDING |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Auth issues | Low | High | Test thoroughly, keep Keycloak config rollback ready |
| Data inconsistency | Very Low | Medium | No data migration needed |
| Performance degradation | Low | Medium | Load test before cutover |
| User confusion | Medium | Low | Clear communication, help docs |
| Feature gaps | Low | High | Feature parity verified |

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Product Owner | | | [ ] |
| Tech Lead | | | [ ] |
| DevOps | | | [ ] |
| QA Lead | | | [ ] |
| Support Lead | | | [ ] |

---

## Appendix: Quick Reference Commands

```bash
# Start new CBP locally
cd apps/customer-portal && npm run dev

# Run tests
cd apps/customer-portal && npm test

# Build for production
cd apps/customer-portal && npm run build

# Check container status
docker ps | grep cbp

# View logs
docker logs app-plane-customer-portal --tail 100 -f

# Health check
curl http://localhost:27555/
```
