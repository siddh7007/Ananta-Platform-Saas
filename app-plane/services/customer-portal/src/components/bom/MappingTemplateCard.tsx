/**
 * Mapping Template Card Component
 * Displays template information with actions
 * @module components/bom/MappingTemplateCard
 */

import React from 'react';
import { Edit2, Trash2, Users, User } from 'lucide-react';
import type { MappingTemplate } from '../../types/column-mapping';

export interface MappingTemplateCardProps {
  /** Template data */
  template: MappingTemplate;
  /** Current user ID (for ownership check) */
  currentUserId?: string;
  /** Apply template handler */
  onApply: (templateId: string) => void;
  /** Edit template handler */
  onEdit?: (templateId: string) => void;
  /** Delete template handler */
  onDelete?: (templateId: string) => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;

  return date.toLocaleDateString();
}

/**
 * Mapping Template Card Component
 *
 * Displays template information:
 * - Name and description
 * - Usage statistics
 * - Created by and date
 * - Sharing status
 * - Action buttons (Apply, Edit, Delete)
 *
 * @example
 * ```tsx
 * <MappingTemplateCard
 *   template={template}
 *   currentUserId="user-123"
 *   onApply={(id) => handleApply(id)}
 *   onEdit={(id) => handleEdit(id)}
 *   onDelete={(id) => handleDelete(id)}
 * />
 * ```
 */
export const MappingTemplateCard: React.FC<MappingTemplateCardProps> = ({
  template,
  currentUserId,
  onApply,
  onEdit,
  onDelete,
  className = '',
}) => {
  const { id, name, description, usageCount, lastUsed, createdBy, createdAt, isShared } =
    template;

  const isOwner = currentUserId === createdBy;
  const canEdit = isOwner && onEdit;
  const canDelete = isOwner && onDelete;

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{name}</h3>
            {isShared ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                title="Shared with organization"
              >
                <Users className="h-3 w-3" aria-hidden="true" />
                Shared
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800"
                title="Personal template"
              >
                <User className="h-3 w-3" aria-hidden="true" />
                Personal
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-gray-600" title={description}>
              {description.length > 100
                ? `${description.slice(0, 100)}...`
                : description}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-600">
        <div>
          <span className="font-medium">Used:</span> {usageCount} times
        </div>
        <div>
          <span className="font-medium">Last used:</span> {formatDate(new Date(lastUsed))}
        </div>
        <div>
          <span className="font-medium">Created:</span> {formatDate(new Date(createdAt))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => onApply(id)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={`Apply ${name} template`}
        >
          Apply Template
        </button>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(id)}
              className="rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label={`Edit ${name} template`}
            >
              <Edit2 className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Edit</span>
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(id)}
              className="rounded-md p-2 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              aria-label={`Delete ${name} template`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

MappingTemplateCard.displayName = 'MappingTemplateCard';
