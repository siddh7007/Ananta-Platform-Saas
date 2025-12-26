/**
 * User account status enumeration.
 * Represents the lifecycle states of a user account.
 */
export enum UserStatus {
  /**
   * User invited but hasn't accepted invitation yet.
   * Cannot login until invitation is accepted and account is activated.
   */
  Pending = 0,

  /**
   * User account is active and can login.
   * Normal operational state.
   */
  Active = 1,

  /**
   * User account temporarily suspended.
   * Login attempts will be rejected. Can be reactivated.
   */
  Suspended = 2,

  /**
   * User account permanently deactivated.
   * Cannot login. Typically for offboarded users.
   */
  Deactivated = 3,
}
