/**
 * ExportButton Component
 * Dropdown button for exporting dashboard data
 * @module components/dashboard/widgets
 */

import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Table, Check } from 'lucide-react';
import type { ExportFormat, ExportOptions } from '../../../types/dashboard';

export interface ExportButtonProps {
  /** Callback when export requested */
  onExport: (options: ExportOptions) => Promise<void>;
  /** Loading state */
  isLoading?: boolean;
  /** Available export formats */
  formats?: ExportFormat[];
  /** Include charts in export */
  includeCharts?: boolean;
  /** CSS class name for customization */
  className?: string;
}

/**
 * ExportButton provides a dropdown to export dashboard in PDF or CSV format
 * Shows loading state and success notification
 */
export const ExportButton: React.FC<ExportButtonProps> = ({
  onExport,
  isLoading = false,
  formats = ['pdf', 'csv'],
  includeCharts = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  // Handle export
  const handleExport = async (format: ExportFormat) => {
    setIsOpen(false);

    const options: ExportOptions = {
      format,
      includeCharts,
    };

    try {
      await onExport(options);

      // Show success notification
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      // Error handling would be done by parent component
    }
  };

  // Get icon for format
  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'pdf':
        return <FileText size={16} aria-hidden="true" />;
      case 'csv':
        return <Table size={16} aria-hidden="true" />;
      default:
        return <Download size={16} aria-hidden="true" />;
    }
  };

  // Get label for format
  const getFormatLabel = (format: ExportFormat): string => {
    switch (format) {
      case 'pdf':
        return 'Export as PDF';
      case 'csv':
        return 'Export as CSV';
    }
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Main Export Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Export dashboard"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <Download size={16} aria-hidden="true" />
            <span>Export</span>
            <svg
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && !isLoading && (
        <div
          className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-1">
            {formats.map((format) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-left"
                role="menuitem"
                aria-label={getFormatLabel(format)}
              >
                {getFormatIcon(format)}
                <span>{getFormatLabel(format)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Success Notification Toast */}
      {showSuccess && (
        <div
          className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-up"
          role="alert"
          aria-live="polite"
        >
          <Check size={20} aria-hidden="true" />
          <span className="font-medium">Export completed successfully!</span>
          <button
            onClick={() => setShowSuccess(false)}
            className="ml-2 text-white hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-green-600 rounded"
            aria-label="Close notification"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Additional styles for toast animation */}
      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

ExportButton.displayName = 'ExportButton';

export default ExportButton;
