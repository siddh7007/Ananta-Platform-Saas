export const PermissionKey = {
  // Platform-level super admin (bypasses tenant restrictions)
  SuperAdmin: '99999',

  CreateLead: '10200',
  UpdateLead: '10201',
  DeleteLead: '10202',
  ViewLead: '10203',
  CreateTenant: '10204',
  ProvisionTenant: '10216',
  UpdateTenant: '10205',
  DeleteTenant: '10206',
  ViewTenant: '10207',
  CreateContact: '10208',
  UpdateContact: '10209',
  DeleteContact: '10210',
  ViewContact: '10211',
  CreateInvoice: '10212',
  UpdateInvoice: '10213',
  DeleteInvoice: '10214',
  ViewInvoice: '10215',
  CreateNotification: '2',

  CreateSubscription: '7001',
  UpdateSubscription: '7002',
  ViewSubscription: '7004',
  ViewPlan: '7008',
  CreatePlan: '7009',
  UpdatePlan: '7010',
  DeletePlan: '7011',
  ManagePlans: '7012',
  CreateTenantConfig: '10220',
  ViewTenantConfig: '10221',
  UpdateTenantConfig: '10222',
  DeleteTenantConfig: '10223',

  // notification service
  ViewNotificationTemplate: '8000',
  CreateNotificationTemplate: '8001',
  UpdateNotificationTemplate: '8002',
  DeleteNotificationTemplate: '8003',

  // notification admin (10400 series)
  ViewNotifications: '10400',
  ViewNotificationHistory: '10401',
  ManageNotificationTemplates: '10402',
  SendTestNotification: '10403',
  ManageNotificationPreferences: '10404',

  // User management
  CreateUser: '10300',
  ViewUser: '10301',
  UpdateUser: '10302',
  DeleteUser: '10303',
  ProvisionUser: '10304',
  SuspendUser: '10305',
  ActivateUser: '10306',

  // User role management
  AssignRole: '10310',
  RevokeRole: '10311',
  ViewRole: '10312',
  UpdateRole: '10313',

  // User invitation management
  CreateInvitation: '10320',
  ViewInvitation: '10321',
  RevokeInvitation: '10322',
  ResendInvitation: '10323',
  AcceptInvitation: '10324',

  // User activity / Audit logs
  ViewUserActivity: '10330',
  ViewAuditLogsAnyTenant: '10331', // Platform admin: view any tenant's audit logs

  // Identity management (Keycloak admin operations)
  ViewUserSessions: '10350',
  TerminateUserSession: '10351',
  ViewUserMfa: '10352',
  ManageUserMfa: '10353',
  ViewLoginEvents: '10354',
  ResetUserPassword: '10355',
  UnlockUser: '10356',

  // Workflow management
  ViewWorkflow: '10340',
  RestartWorkflow: '10341',
  CancelWorkflow: '10342',

  CreateBillingCustomer: '5321',
  CreateBillingPaymentSource: '5322',
  CreateBillingInvoice: '5323',
  GetBillingCustomer: '5324',
  GetBillingPaymentSource: '5325',
  GetBillingInvoice: '5326',
  UpdateBillingCustomer: '5327',
  UpdateBillingPaymentSource: '5328',
  UpdateBillingInvoice: '5329',
  DeleteBillingCustomer: '5331',
  DeleteBillingPaymentSource: '5332',
  DeleteBillingInvoice: '5333',
};
