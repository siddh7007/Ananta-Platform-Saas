/**
 * Organization Profile Component
 * CBP-P2-005: Organization Management - Profile Settings
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useUpdate } from '@refinedev/core';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Upload,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
}

interface OrganizationProfileProps {
  organization?: OrganizationData;
  canEdit?: boolean;
  isLoading?: boolean;
}

// Mock organization data for development
const MOCK_ORGANIZATION: OrganizationData = {
  id: 'org-1',
  name: 'Acme Corporation',
  slug: 'acme-corp',
  description: 'Leading provider of innovative electronic solutions',
  website: 'https://acme.example.com',
  email: 'contact@acme.example.com',
  phone: '+1 (555) 123-4567',
  address: {
    street: '123 Innovation Drive',
    city: 'San Francisco',
    state: 'CA',
    country: 'United States',
    postalCode: '94105',
  },
};

function getOrgInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function OrganizationProfile({
  organization: propOrganization,
  canEdit = false,
  isLoading: propIsLoading = false,
}: OrganizationProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success, error: showError } = useToast();

  // Use mock data if no organization provided
  const organization = propOrganization || MOCK_ORGANIZATION;
  const isLoading = propIsLoading;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<OrganizationData>({
    defaultValues: organization,
  });

  const onSubmit = async (data: OrganizationData) => {
    setError(null);
    setIsSaving(true);

    try {
      // API call
      // await updateOrganization({ resource: 'organizations', id: organization.id, values: data });

      // Mock success
      await new Promise((resolve) => setTimeout(resolve, 500));
      success('Organization updated', 'Your organization profile has been saved');
      setIsEditing(false);
    } catch (err) {
      setError('Failed to save changes. Please try again.');
      showError('Error', 'Failed to update organization');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    reset(organization);
    setIsEditing(false);
    setError(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" aria-hidden="true" />
            Organization Profile
          </CardTitle>
          <CardDescription>
            Manage your organization's public information and settings
          </CardDescription>
        </div>
        {canEdit && !isEditing && (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Logo */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={organization.logo} alt="" />
              <AvatarFallback className="text-xl">
                {getOrgInitials(organization.name)}
              </AvatarFallback>
            </Avatar>
            {isEditing && (
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                  Upload Logo
                </Button>
                <p className="text-xs text-muted-foreground">
                  Recommended: 256x256px, PNG or JPG
                </p>
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              {isEditing ? (
                <>
                  <Input
                    id="org-name"
                    {...register('name', { required: 'Name is required' })}
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </>
              ) : (
                <p className="text-sm font-medium py-2">{organization.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-slug">Organization Slug</Label>
              {isEditing ? (
                <Input
                  id="org-slug"
                  {...register('slug')}
                  disabled
                  className="bg-muted"
                />
              ) : (
                <p className="text-sm text-muted-foreground py-2">{organization.slug}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="org-description">Description</Label>
            {isEditing ? (
              <Textarea
                id="org-description"
                {...register('description')}
                placeholder="Describe your organization..."
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                {organization.description || 'No description provided'}
              </p>
            )}
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="org-website" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" aria-hidden="true" />
                  Website
                </Label>
                {isEditing ? (
                  <Input
                    id="org-website"
                    type="url"
                    {...register('website')}
                    placeholder="https://example.com"
                  />
                ) : (
                  <p className="text-sm py-2">
                    {organization.website ? (
                      <a
                        href={organization.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {organization.website}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not provided</span>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Email
                </Label>
                {isEditing ? (
                  <Input
                    id="org-email"
                    type="email"
                    {...register('email')}
                    placeholder="contact@example.com"
                  />
                ) : (
                  <p className="text-sm py-2">
                    {organization.email || (
                      <span className="text-muted-foreground">Not provided</span>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Phone
                </Label>
                {isEditing ? (
                  <Input
                    id="org-phone"
                    type="tel"
                    {...register('phone')}
                    placeholder="+1 (555) 123-4567"
                  />
                ) : (
                  <p className="text-sm py-2">
                    {organization.phone || (
                      <span className="text-muted-foreground">Not provided</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Address
            </h3>
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="org-street">Street Address</Label>
                  <Input
                    id="org-street"
                    {...register('address.street')}
                    placeholder="123 Main St"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-city">City</Label>
                  <Input
                    id="org-city"
                    {...register('address.city')}
                    placeholder="San Francisco"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-state">State/Province</Label>
                  <Input
                    id="org-state"
                    {...register('address.state')}
                    placeholder="CA"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-country">Country</Label>
                  <Input
                    id="org-country"
                    {...register('address.country')}
                    placeholder="United States"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-postal">Postal Code</Label>
                  <Input
                    id="org-postal"
                    {...register('address.postalCode')}
                    placeholder="94105"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {organization.address ? (
                  <>
                    {organization.address.street && (
                      <span>{organization.address.street}<br /></span>
                    )}
                    {organization.address.city && organization.address.state && (
                      <span>
                        {organization.address.city}, {organization.address.state}{' '}
                        {organization.address.postalCode}
                        <br />
                      </span>
                    )}
                    {organization.address.country && (
                      <span>{organization.address.country}</span>
                    )}
                  </>
                ) : (
                  'No address provided'
                )}
              </p>
            )}
          </div>

          {/* Actions */}
          {isEditing && (
            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !isDirty}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export default OrganizationProfile;
