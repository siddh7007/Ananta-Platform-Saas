/**
 * Manage Templates Dialog
 * Dialog for viewing, editing, and deleting saved column mapping templates
 */

import { useState } from 'react';
import { Settings, Star, Trash2, Edit2, Clock, Check, X } from 'lucide-react';
import {
  useColumnMappingTemplates,
  useDeleteTemplate,
  useSetDefaultTemplate,
  useUpdateTemplate,
} from '@/hooks/useColumnMappingTemplates';
import { ColumnMappingTemplate } from '@/services/column-mapping.service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ManageTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageTemplatesDialog({
  open,
  onOpenChange,
}: ManageTemplatesDialogProps) {
  const { templates, isLoading } = useColumnMappingTemplates();
  const deleteTemplate = useDeleteTemplate();
  const setDefaultTemplate = useSetDefaultTemplate();
  const updateTemplate = useUpdateTemplate();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleStartEdit = (template: ColumnMappingTemplate) => {
    setEditingId(template.id);
    setEditName(template.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;

    await updateTemplate.mutateAsync({
      id: editingId,
      data: { name: editName.trim() },
    });

    setEditingId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSetDefault = async (templateId: string) => {
    await setDefaultTemplate.mutateAsync(templateId);
  };

  const handleDelete = async (templateId: string) => {
    await deleteTemplate.mutateAsync(templateId);
    setDeleteConfirmId(null);
  };

  const templateToDelete = templates.find((t: ColumnMappingTemplate) => t.id === deleteConfirmId);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Manage Column Mapping Templates
            </DialogTitle>
            <DialogDescription>
              View, edit, and organize your saved column mapping templates.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[500px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Settings className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No templates saved yet</p>
                <p className="text-sm text-muted-foreground/75 mt-1">
                  Save your first mapping template during BOM upload
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template: ColumnMappingTemplate) => (
                  <div
                    key={template.id}
                    className="rounded-lg border bg-card p-4 space-y-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        {editingId === template.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="h-8"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={handleSaveEdit}
                              disabled={!editName.trim()}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{template.name}</h4>
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
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {Object.keys(template.mappings).length} fields mapped
                          </span>

                          {template.lastUsedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last used {formatRelativeTime(template.lastUsedAt)}
                            </span>
                          )}

                          <span>
                            Created {template.createdAt.toLocaleDateString()}
                          </span>
                        </div>

                        {/* Show mapped fields */}
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(template.mappings).map(([field, column]) => (
                            <Badge
                              key={field}
                              variant="outline"
                              className="text-xs font-normal"
                            >
                              {String(column)}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {!template.isDefault && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleSetDefault(template.id)}
                            title="Set as default"
                          >
                            <Star className="h-4 w-4 text-muted-foreground hover:text-yellow-500" />
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleStartEdit(template)}
                          title="Rename"
                        >
                          <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => setDeleteConfirmId(template.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
