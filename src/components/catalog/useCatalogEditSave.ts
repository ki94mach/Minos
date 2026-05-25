import { useCallback } from "react";
import {
  confirmCatalogEditSave,
  formatCatalogPutSuccess,
  type CatalogEntityKind,
} from "./catalogEditSave";

/** Confirm + success messaging for catalog PUT saves (docs/CATALOG_SYNC.md). */
export function useCatalogEditSave(kind: CatalogEntityKind) {
  const confirmBeforePut = useCallback(
    (editingId: string) => confirmCatalogEditSave(editingId, kind),
    [kind]
  );

  const formatPutSuccess = useCallback(
    (baseMessage: string, data: unknown) =>
      formatCatalogPutSuccess(baseMessage, data, kind),
    [kind]
  );

  return { confirmBeforePut, formatPutSuccess };
}
