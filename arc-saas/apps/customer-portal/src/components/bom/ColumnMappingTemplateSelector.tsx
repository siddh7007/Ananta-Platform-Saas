/**
 * Column Mapping Template Selector
 * Dropdown component for selecting and managing column mapping templates
 */

import { useState } from 'react';
import { Check, ChevronDown, Save, Settings, Star, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useColumnMappingTemplates,
  useApplyTemplate,
} from '@/hooks/useColumnMappingTemplates';
import { type ColumnMappingTemplate } from '@/services/column-mapping.service';
import { BomColumnMapping } from '@/types/bom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SaveTemplateDialog } from './SaveTemplateDialog';
import { ManageTemplatesDialog } from './ManageTemplatesDialog';

interface ColumnMappingTemplateSelectorProps {
  currentMapping: BomColumnMapping;
  onMappingChange: (mapping: BomColumnMapping) => void;
  className?: string;
}

export function ColumnMappingTemplateSelector({
  currentMapping,
  onMappingChange,
  className,
}: ColumnMappingTemplateSelectorProps) {
  const { templates, isLoading, defaultTemplate } = useColumnMappingTemplates();
  const applyTemplate = useApplyTemplate();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);

  const handleSelectTemplate = async (templateId: string) => {
    const mapping = await applyTemplate(templateId);
    if (mapping) {
      onMappingChange(mapping);
      setSelectedTemplateId(templateId);
    }
  };

  const selectedTemplate = templates.find((t: ColumnMappingTemplate) => t.id === selectedTemplateId);

  return (
    <>
      <div className={cn('flex items-center gap-2', className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="justify-between min-w-[200px]"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="text-muted-foreground">Loading...</span>
              ) : selectedTemplate ? (
                <span className="flex items-center gap-2">
                  {selectedTemplate.isDefault && (
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  )}
                  {selectedTemplate.name}
                </span>
              ) : (
                <span className="text-muted-foreground">Select template...</span>
              )}
              <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-[280px]">
            {templates.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                No saved templates yet
              </div>
            ) : (
              <>
                {templates.map((template: ColumnMappingTemplate) => (
                  <DropdownMenuItem
                    key={template.id}
                    onClick={() => handleSelectTemplate(template.id)}
                    className="flex items-start gap-2 py-2"
                  >
                    <div className="flex h-5 w-5 items-center justify-center">
                      {selectedTemplateId === template.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        {template.isDefault && (
                          <Badge
                            variant="secondary"
                            className="h-5 text-xs bg-yellow-100 text-yellow-800"
                          >
                            <Star className="mr-1 h-3 w-3 fill-yellow-500" />
                            Default
                          </Badge>
                        )}
                      </div>

                      {template.lastUsedAt && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Last used{' '}
                          {formatRelativeTime(template.lastUsedAt)}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        {Object.keys(template.mappings).length} fields mapped
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
              <Save className="mr-2 h-4 w-4" />
              Save current mapping
            </DropdownMenuItem>

            {templates.length > 0 && (
              <DropdownMenuItem onClick={() => setShowManageDialog(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Manage templates
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedTemplate && (
          <span className="text-sm text-muted-foreground">
            {Object.keys(selectedTemplate.mappings).length} fields
          </span>
        )}
      </div>

      <SaveTemplateDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        currentMapping={currentMapping}
        defaultTemplate={defaultTemplate}
      />

      <ManageTemplatesDialog
        open={showManageDialog}
        onOpenChange={setShowManageDialog}
      />
    </>
  );
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
