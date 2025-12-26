/**
 * Button Component Examples
 *
 * This file demonstrates the enhanced Button component capabilities
 * including loading states, icons, and icon-only buttons.
 */

import { Button } from "./button"
import { Plus, Save, Settings, Trash2, Download, Upload } from "lucide-react"

export function ButtonExamples() {
  return (
    <div className="space-y-8 p-8">
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Loading States</h2>

        <div className="flex flex-wrap gap-4">
          <Button loading={true}>
            Loading (with spinner)
          </Button>

          <Button loading={true} loadingText="Saving...">
            Save Changes
          </Button>

          <Button loading={true} loadingText="Processing..." variant="secondary">
            Process
          </Button>

          <Button loading={true} variant="destructive">
            Delete
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Buttons with Icons</h2>

        <div className="flex flex-wrap gap-4">
          <Button leftIcon={<Plus className="h-4 w-4" />}>
            Add Item
          </Button>

          <Button leftIcon={<Save className="h-4 w-4" />} variant="secondary">
            Save
          </Button>

          <Button rightIcon={<Download className="h-4 w-4" />} variant="outline">
            Download
          </Button>

          <Button
            leftIcon={<Upload className="h-4 w-4" />}
            rightIcon={<Plus className="h-4 w-4" />}
          >
            Upload & Add
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Icon-Only Buttons</h2>

        <div className="flex flex-wrap gap-4 items-center">
          <Button iconOnly>
            <Settings className="h-4 w-4" />
          </Button>

          <Button iconOnly variant="secondary">
            <Save className="h-4 w-4" />
          </Button>

          <Button iconOnly variant="outline">
            <Plus className="h-4 w-4" />
          </Button>

          <Button iconOnly variant="destructive">
            <Trash2 className="h-4 w-4" />
          </Button>

          <Button iconOnly variant="ghost">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Icon-Only with Different Sizes</h2>

        <div className="flex flex-wrap gap-4 items-center">
          <Button iconOnly size="sm">
            <Settings className="h-4 w-4" />
          </Button>

          <Button iconOnly size="default">
            <Settings className="h-4 w-4" />
          </Button>

          <Button iconOnly size="lg">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Loading with Icons</h2>

        <div className="flex flex-wrap gap-4">
          <Button
            loading={true}
            loadingText="Uploading..."
            leftIcon={<Upload className="h-4 w-4" />}
          >
            Upload File
          </Button>

          <Button
            loading={true}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Save
          </Button>

          <Button
            loading={true}
            variant="destructive"
            leftIcon={<Trash2 className="h-4 w-4" />}
          >
            Delete
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">All Variants</h2>

        <div className="flex flex-wrap gap-4">
          <Button variant="default">Default</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">All Sizes</h2>

        <div className="flex flex-wrap gap-4 items-end">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Disabled States</h2>

        <div className="flex flex-wrap gap-4">
          <Button disabled>Disabled</Button>
          <Button disabled leftIcon={<Save className="h-4 w-4" />}>
            Disabled with Icon
          </Button>
          <Button disabled variant="destructive">
            Disabled Destructive
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Touch-Friendly (Minimum 44px on Mobile)</h2>
        <p className="text-sm text-muted-foreground">
          All buttons have a minimum 44px touch target on mobile devices (40px on desktop).
          Icon-only buttons are square with the same minimum dimensions.
        </p>

        <div className="flex flex-wrap gap-4">
          <Button size="sm">
            Small Button (40px mobile)
          </Button>
          <Button size="default">
            Default Button (44px mobile)
          </Button>
          <Button size="lg">
            Large Button (48px mobile)
          </Button>
        </div>
      </section>
    </div>
  )
}

export default ButtonExamples
