/**
 * Simple in-memory store to hand off File objects between routes.
 * We cannot serialize File instances into sessionStorage, so we
 * stash them here before navigating and let the target screen
 * consume them once.
 */

let pendingFiles: File[] = [];

export function setPendingUploadFiles(files: File[]) {
  pendingFiles = files;
}

export function consumePendingUploadFiles(): File[] {
  const toUpload = pendingFiles;
  pendingFiles = [];
  return toUpload;
}
