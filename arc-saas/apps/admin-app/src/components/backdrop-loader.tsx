import { Loader2 } from 'lucide-react';

interface BackdropLoaderProps {
  /** Loading message to display */
  message?: string;
}

/**
 * Full-screen loading overlay with backdrop blur.
 * Used for blocking operations like logout, page transitions, etc.
 */
export function BackdropLoader({ message = 'Loading...' }: BackdropLoaderProps) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl px-8 py-6 flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-gray-600 dark:text-gray-300 font-medium">{message}</p>
      </div>
    </div>
  );
}

export default BackdropLoader;
