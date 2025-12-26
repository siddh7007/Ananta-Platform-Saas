import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';
import { Button } from './button';

/**
 * Card Component Examples
 *
 * This file demonstrates all variants and features of the enhanced Card component.
 */

export function CardExamples() {
  const [loadingCard, setLoadingCard] = React.useState(false);

  return (
    <div className="space-y-8 p-8">
      <h1 className="text-3xl font-bold">Card Component Variants</h1>

      {/* Elevation Variants */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Elevation Variants</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card elevation="none">
            <CardHeader>
              <CardTitle>None</CardTitle>
              <CardDescription>No shadow</CardDescription>
            </CardHeader>
            <CardContent>
              <p>elevation="none"</p>
            </CardContent>
          </Card>

          <Card elevation="flat">
            <CardHeader>
              <CardTitle>Flat</CardTitle>
              <CardDescription>Default - shadow-sm</CardDescription>
            </CardHeader>
            <CardContent>
              <p>elevation="flat"</p>
            </CardContent>
          </Card>

          <Card elevation="raised">
            <CardHeader>
              <CardTitle>Raised</CardTitle>
              <CardDescription>Medium shadow</CardDescription>
            </CardHeader>
            <CardContent>
              <p>elevation="raised"</p>
            </CardContent>
          </Card>

          <Card elevation="floating">
            <CardHeader>
              <CardTitle>Floating</CardTitle>
              <CardDescription>Large shadow</CardDescription>
            </CardHeader>
            <CardContent>
              <p>elevation="floating"</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Hover Variants */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Hover Variants</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card elevation="raised" hover="none">
            <CardHeader>
              <CardTitle>None</CardTitle>
              <CardDescription>No hover effect</CardDescription>
            </CardHeader>
            <CardContent>
              <p>hover="none"</p>
            </CardContent>
          </Card>

          <Card elevation="raised" hover="lift">
            <CardHeader>
              <CardTitle>Lift</CardTitle>
              <CardDescription>Hover to lift up</CardDescription>
            </CardHeader>
            <CardContent>
              <p>hover="lift"</p>
            </CardContent>
          </Card>

          <Card elevation="raised" hover="glow">
            <CardHeader>
              <CardTitle>Glow</CardTitle>
              <CardDescription>Hover to glow</CardDescription>
            </CardHeader>
            <CardContent>
              <p>hover="glow"</p>
            </CardContent>
          </Card>

          <Card elevation="raised" hover="scale">
            <CardHeader>
              <CardTitle>Scale</CardTitle>
              <CardDescription>Hover to scale</CardDescription>
            </CardHeader>
            <CardContent>
              <p>hover="scale"</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Status Variants */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Status Variants</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card elevation="raised" status="success">
            <CardHeader>
              <CardTitle>Success</CardTitle>
              <CardDescription>Green left border</CardDescription>
            </CardHeader>
            <CardContent>
              <p>status="success"</p>
            </CardContent>
          </Card>

          <Card elevation="raised" status="warning">
            <CardHeader>
              <CardTitle>Warning</CardTitle>
              <CardDescription>Yellow left border</CardDescription>
            </CardHeader>
            <CardContent>
              <p>status="warning"</p>
            </CardContent>
          </Card>

          <Card elevation="raised" status="error">
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>Red left border</CardDescription>
            </CardHeader>
            <CardContent>
              <p>status="error"</p>
            </CardContent>
          </Card>

          <Card elevation="raised" status="info">
            <CardHeader>
              <CardTitle>Info</CardTitle>
              <CardDescription>Blue left border</CardDescription>
            </CardHeader>
            <CardContent>
              <p>status="info"</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Clickable Cards */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Clickable Cards</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card
            elevation="raised"
            hover="lift"
            clickable
            onClick={() => alert('Card clicked!')}
          >
            <CardHeader>
              <CardTitle>Clickable with Lift</CardTitle>
              <CardDescription>Click me!</CardDescription>
            </CardHeader>
            <CardContent>
              <p>clickable + hover="lift"</p>
            </CardContent>
          </Card>

          <Card
            elevation="raised"
            hover="glow"
            clickable
            onClick={() => alert('Card clicked!')}
          >
            <CardHeader>
              <CardTitle>Clickable with Glow</CardTitle>
              <CardDescription>Click me!</CardDescription>
            </CardHeader>
            <CardContent>
              <p>clickable + hover="glow"</p>
            </CardContent>
          </Card>

          <Card
            elevation="raised"
            hover="scale"
            clickable
            onClick={() => alert('Card clicked!')}
          >
            <CardHeader>
              <CardTitle>Clickable with Scale</CardTitle>
              <CardDescription>Click me!</CardDescription>
            </CardHeader>
            <CardContent>
              <p>clickable + hover="scale"</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Loading State */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Loading State</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card elevation="raised" loading={loadingCard}>
            <CardHeader>
              <CardTitle>Interactive Loading</CardTitle>
              <CardDescription>Toggle the loading state</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This card demonstrates the loading overlay.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                When loading is true, an overlay with a spinner appears.
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={() => setLoadingCard(!loadingCard)}>
                {loadingCard ? 'Stop Loading' : 'Start Loading'}
              </Button>
            </CardFooter>
          </Card>

          <Card elevation="raised" loading>
            <CardHeader>
              <CardTitle>Always Loading</CardTitle>
              <CardDescription>Static loading example</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This card is always in loading state.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Combined Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Combined Examples</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card
            elevation="floating"
            hover="lift"
            status="success"
            clickable
            onClick={() => alert('Success card clicked!')}
          >
            <CardHeader>
              <CardTitle>Success + Lift</CardTitle>
              <CardDescription>Combined variant example</CardDescription>
            </CardHeader>
            <CardContent>
              <p>elevation="floating"</p>
              <p>hover="lift"</p>
              <p>status="success"</p>
              <p>clickable</p>
            </CardContent>
          </Card>

          <Card
            elevation="raised"
            hover="glow"
            status="warning"
            clickable
            onClick={() => alert('Warning card clicked!')}
          >
            <CardHeader>
              <CardTitle>Warning + Glow</CardTitle>
              <CardDescription>Combined variant example</CardDescription>
            </CardHeader>
            <CardContent>
              <p>elevation="raised"</p>
              <p>hover="glow"</p>
              <p>status="warning"</p>
              <p>clickable</p>
            </CardContent>
          </Card>

          <Card
            elevation="floating"
            hover="scale"
            status="info"
            clickable
            onClick={() => alert('Info card clicked!')}
          >
            <CardHeader>
              <CardTitle>Info + Scale</CardTitle>
              <CardDescription>Combined variant example</CardDescription>
            </CardHeader>
            <CardContent>
              <p>elevation="floating"</p>
              <p>hover="scale"</p>
              <p>status="info"</p>
              <p>clickable</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Backward Compatibility */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Backward Compatibility</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Default Card</CardTitle>
              <CardDescription>No props specified</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This card uses default values:</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                <li>elevation="flat" (shadow-sm)</li>
                <li>hover="none"</li>
                <li>clickable=false</li>
                <li>No status border</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle>Custom Styling</CardTitle>
              <CardDescription className="text-primary-foreground/70">
                With className override
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>className prop still works for custom styling</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Real-World Use Cases */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Real-World Use Cases</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card
            elevation="raised"
            hover="lift"
            clickable
            onClick={() => alert('Navigate to project details')}
          >
            <CardHeader>
              <CardTitle>Project Card</CardTitle>
              <CardDescription>Active development</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Click to view project details</p>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">Last updated: 2 hours ago</p>
            </CardFooter>
          </Card>

          <Card elevation="raised" status="error">
            <CardHeader>
              <CardTitle>Error Notification</CardTitle>
              <CardDescription>Build failed</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">The build process encountered errors.</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm">View Logs</Button>
            </CardFooter>
          </Card>

          <Card elevation="raised" status="success">
            <CardHeader>
              <CardTitle>Deployment Success</CardTitle>
              <CardDescription>Production environment</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Successfully deployed version 2.1.0</p>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">Deployed 5 minutes ago</p>
            </CardFooter>
          </Card>
        </div>
      </section>
    </div>
  );
}

export default CardExamples;
