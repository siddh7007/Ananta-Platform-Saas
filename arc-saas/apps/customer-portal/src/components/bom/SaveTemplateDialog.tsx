/**
 * Save Template Dialog
 * Dialog for saving current column mapping as a template
 */

import { useState, useEffect } from 'react';
import { Save, Star } from 'lucide-react';
import { BomColumnMapping } from '@/types/bom';
import { ColumnMappingTemplate } from '@/services/column-mapping.service';
import { useSaveTemplate, useSetDefaultTemplate } from '@/hooks/useColumnMappingTemplates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMapping: BomColumnMapping;
  defaultTemplate?: ColumnMappingTemplate;
}

export function SaveTemplateDialog({
  open,
  onOpenChange,
  currentMapping,
  defaultTemplate,
}: SaveTemplateDialogProps) {
  const [templateName, setTemplateName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const saveTemplate = useSaveTemplate();
  const setDefaultTemplate = useSetDefaultTemplate();

  // Generate default name when dialog opens
  useEffect(() => {
    if (open && !templateName) {
      const timestamp = new Date().toLocaleDateString();
      setTemplateName(`Mapping Template ${timestamp}`);
    }
  }, [open, templateName]);

  const handleSave = async () => {
    if (!templateName.trim()) return;

    // Save the template
    const newTemplate = await saveTemplate.mutateAsync({
      name: templateName.trim(),
      mappings: currentMapping,
    });

    // If user checked "set as default", call the set-default endpoint
    if (setAsDefault && newTemplate.id) {
      await setDefaultTemplate.mutateAsync(newTemplate.id);
    }

    // Close dialog and reset form
    onOpenChange(false);
    setTemplateName('');
    setSetAsDefault(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
    setTemplateName('');
    setSetAsDefault(false);
  };

  // Count mapped fields
  const mappedFieldCount = Object.entries(currentMapping).filter(
    ([_, value]) => value && value.trim() !== ''
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save Column Mapping Template
          </DialogTitle>
          <DialogDescription>
            Save your current column mapping configuration for future uploads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              placeholder="e.g., Standard BOM Format"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="text-sm font-medium">Current Mapping Preview</div>
            <div className="space-y-1 text-sm">
              {Object.entries(currentMapping).map(([field, column]) => {
                if (!column) return null;
                return (
                  <div
                    key={field}
                    className="flex items-center justify-between rounded bg-background px-2 py-1"
                  >
                    <span className="text-muted-foreground capitalize">
                      {field.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className="font-medium">{column}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              {mappedFieldCount} field{mappedFieldCount !== 1 ? 's' : ''} mapped
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="set-default"
              checked={setAsDefault}
              onCheckedChange={(checked) => setSetAsDefault(checked === true)}
              className="mt-1"
            />
            <div className="flex-1 space-y-1">
              <Label
                htmlFor="set-default"
                className="flex items-center gap-2 font-medium cursor-pointer"
              >
                <Star className="h-4 w-4 text-yellow-500" />
                Set as default template
              </Label>
              <p className="text-sm text-muted-foreground">
                This template will be automatically loaded when uploading new BOMs.
                {defaultTemplate && (
                  <span className="block mt-1 text-xs">
                    Current default: "{defaultTemplate.name}"
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!templateName.trim() || saveTemplate.isPending || setDefaultTemplate.isPending}
          >
            {saveTemplate.isPending || setDefaultTemplate.isPending ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
