import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserSessionsCard } from './user-sessions-card';
import { UserMfaCard } from './user-mfa-card';
import { UserLoginEventsCard } from './user-login-events-card';
import { UserSecurityActionsCard } from './user-security-actions-card';
import {
  Globe,
  Shield,
  History,
  ShieldAlert,
} from 'lucide-react';

interface UserIdentityPanelProps {
  userId: string;
  userEmail: string;
  onRefresh?: () => void;
}

export function UserIdentityPanel({
  userId,
  userEmail,
  onRefresh,
}: UserIdentityPanelProps) {
  const [activeTab, setActiveTab] = useState('sessions');

  return (
    <div className="space-y-6">
      <div className="border-b pb-2">
        <h2 className="text-xl font-semibold">Identity & Security</h2>
        <p className="text-sm text-muted-foreground">
          Manage user sessions, MFA settings, and security actions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Sessions</span>
          </TabsTrigger>
          <TabsTrigger value="mfa" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">MFA</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="sessions" className="mt-0">
            <UserSessionsCard
              userId={userId}
              onSessionTerminated={onRefresh}
            />
          </TabsContent>

          <TabsContent value="mfa" className="mt-0">
            <UserMfaCard
              userId={userId}
              onMfaChanged={onRefresh}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <UserLoginEventsCard userId={userId} />
          </TabsContent>

          <TabsContent value="actions" className="mt-0">
            <UserSecurityActionsCard
              userId={userId}
              userEmail={userEmail}
              onActionComplete={onRefresh}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
