/**
 * User invitation status enumeration.
 * Tracks the lifecycle of user invitation tokens.
 */
export enum UserInvitationStatus {
  /**
   * Invitation sent, awaiting user acceptance.
   */
  Pending = 0,

  /**
   * Invitation accepted, user account created.
   */
  Accepted = 1,

  /**
   * Invitation expired (past expires_at timestamp).
   * Can no longer be accepted.
   */
  Expired = 2,

  /**
   * Invitation manually revoked by admin.
   * Can no longer be accepted.
   */
  Revoked = 3,
}
