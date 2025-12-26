/**
 * Touch Target Examples Component
 *
 * Demonstrates proper usage of touch-friendly components and utilities.
 * This component can be used for testing and documentation purposes.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Edit, Trash2, Share2, Download, Save } from 'lucide-react';

export function TouchTargetExamples() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Touch Target Examples</h1>
        <p className="text-muted-foreground">
          All interactive elements meet minimum 44x44px touch targets on mobile devices.
        </p>
      </div>

      {/* Button Sizes */}
      <Card>
        <CardHeader>
          <CardTitle>Button Sizes</CardTitle>
          <CardDescription>
            Buttons automatically adapt to touch-friendly sizes on mobile (44px minimum)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-touch">
            <Button size="sm">Small Button</Button>
            <Button size="default">Default Button</Button>
            <Button size="lg">Large Button</Button>
          </div>

          <div className="flex flex-wrap gap-touch">
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </CardContent>
      </Card>

      {/* Icon Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Icon Buttons</CardTitle>
          <CardDescription>
            Icon-only buttons maintain 44x44px minimum on mobile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-touch">
            <Button size="icon" variant="outline" aria-label="Edit">
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Share">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Download">
              <Download className="h-4 w-4" />
            </Button>
            <Button size="icon" aria-label="Save">
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Form Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Form Controls</CardTitle>
          <CardDescription>
            All form inputs have touch-friendly heights (44px minimum on mobile)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <Input id="name" type="text" placeholder="Enter your name" />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input id="email" type="email" placeholder="you@example.com" />
          </div>

          <div className="space-y-2">
            <label htmlFor="country" className="text-sm font-medium">
              Country
            </label>
            <Select>
              <SelectTrigger id="country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">United States</SelectItem>
                <SelectItem value="uk">United Kingdom</SelectItem>
                <SelectItem value="ca">Canada</SelectItem>
                <SelectItem value="au">Australia</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Touch Spacing */}
      <Card>
        <CardHeader>
          <CardTitle>Touch Target Spacing</CardTitle>
          <CardDescription>
            Minimum 8px spacing between adjacent touch targets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-2">Horizontal Spacing (gap-touch)</p>
              <div className="flex gap-touch">
                <Button>Action 1</Button>
                <Button>Action 2</Button>
                <Button>Action 3</Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Larger Spacing (gap-touch-lg)</p>
              <div className="flex gap-touch-lg">
                <Button variant="outline">Cancel</Button>
                <Button>Confirm</Button>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Vertical Spacing (space-y-touch)</p>
              <div className="space-y-touch">
                <Button className="w-full">First Action</Button>
                <Button className="w-full">Second Action</Button>
                <Button className="w-full">Third Action</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Touch Targets */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Touch Targets</CardTitle>
          <CardDescription>
            Apply touch-target utilities to custom components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Using .touch-target class</p>
              <div className="flex gap-touch">
                <div className="touch-target border rounded-md px-4 cursor-pointer hover:bg-accent">
                  Custom Element 1
                </div>
                <div className="touch-target border rounded-md px-4 cursor-pointer hover:bg-accent">
                  Custom Element 2
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Using .touch-target-expanded</p>
              <div className="flex gap-touch">
                <div className="touch-target-expanded border rounded-md px-4 cursor-pointer hover:bg-accent">
                  Expanded Target
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Icon with .touch-target-overlay</p>
              <div className="flex gap-touch">
                <div className="touch-target-overlay cursor-pointer">
                  <Edit className="h-4 w-4" />
                </div>
                <div className="touch-target-overlay cursor-pointer">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div className="touch-target-overlay cursor-pointer">
                  <Share2 className="h-4 w-4" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                These small icons have expanded hit areas for easier tapping
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile vs Desktop Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Responsive Behavior</CardTitle>
          <CardDescription>
            Components adapt based on screen size and input method
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border rounded-md bg-muted/50">
              <p className="text-sm font-medium mb-2">On Mobile (Touch Devices)</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>- Buttons: 44-48px minimum height</li>
                <li>- Inputs: 44px minimum height</li>
                <li>- Select items: 44px minimum height</li>
                <li>- Icon buttons: 44x44px minimum</li>
                <li>- 8px minimum spacing between targets</li>
              </ul>
            </div>

            <div className="p-4 border rounded-md bg-muted/50">
              <p className="text-sm font-medium mb-2">On Desktop (Mouse/Trackpad)</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>- Buttons: 36-44px height (more compact)</li>
                <li>- Inputs: 40px height</li>
                <li>- Select items: 40px height</li>
                <li>- Icon buttons: 40x40px</li>
                <li>- Maintains visual density for productivity</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
          <CardDescription>
            Guidelines for implementing touch-friendly interfaces
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <div className="font-bold text-green-600">✓</div>
              <div>
                <strong>Use standard components:</strong> Button, Input, and Select components
                automatically have touch-friendly sizes
              </div>
            </div>
            <div className="flex gap-2">
              <div className="font-bold text-green-600">✓</div>
              <div>
                <strong>Apply gap-touch:</strong> Use gap-touch or gap-touch-lg for spacing
                between interactive elements
              </div>
            </div>
            <div className="flex gap-2">
              <div className="font-bold text-green-600">✓</div>
              <div>
                <strong>Icon buttons need size="icon":</strong> This ensures 44x44px minimum on
                mobile
              </div>
            </div>
            <div className="flex gap-2">
              <div className="font-bold text-green-600">✓</div>
              <div>
                <strong>Custom elements:</strong> Add touch-target class or min-h-[44px]
                md:min-h-[40px]
              </div>
            </div>
            <div className="flex gap-2">
              <div className="font-bold text-red-600">✗</div>
              <div>
                <strong>Avoid fixed heights below 44px:</strong> Don't use h-8 or h-9 for touch
                targets on mobile
              </div>
            </div>
            <div className="flex gap-2">
              <div className="font-bold text-red-600">✗</div>
              <div>
                <strong>Don't pack buttons too closely:</strong> Maintain at least 8px spacing
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
