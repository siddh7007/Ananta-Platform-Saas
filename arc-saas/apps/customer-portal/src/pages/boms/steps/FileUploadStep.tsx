import { Upload, FileText, RotateCcw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadStepProps {
  // Dropzone props from react-dropzone
  getRootProps: () => object;
  getInputProps: () => object;
  isDragActive: boolean;
  // Restore session
  showRestorePrompt: boolean;
  restoredState: { fileName?: string } | null;
  onDismissRestore: () => void;
  // Error display
  error: string | null;
}

export function FileUploadStep({
  getRootProps,
  getInputProps,
  isDragActive,
  showRestorePrompt,
  restoredState,
  onDismissRestore,
  error,
}: FileUploadStepProps) {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Restore session prompt */}
      {showRestorePrompt && restoredState?.fileName && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <RotateCcw className="mt-0.5 h-5 w-5 text-blue-600 shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-900">Resume Previous Upload</h3>
              <p className="mt-1 text-sm text-blue-700">
                You have an incomplete upload session for <strong>{restoredState.fileName}</strong>.
                Re-upload the same file to continue where you left off.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={onDismissRestore}
                  className="rounded px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100"
                >
                  Start Fresh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="text-center">
        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">Upload Your BOM</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag and drop your BOM file or click to browse
        </p>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          'cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-all',
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <input {...getInputProps()} />
        <FileText className="mx-auto h-16 w-16 text-muted-foreground/50" />
        <p className="mt-4 text-sm text-muted-foreground">
          Supports <strong>CSV</strong>, <strong>XLS</strong>, <strong>XLSX</strong>
        </p>
        <p className="mt-1 text-xs text-muted-foreground/75">Maximum file size: 10MB</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
