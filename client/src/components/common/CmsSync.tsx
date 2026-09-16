import { useCms } from "../../state/CmsProvider";
import type { CmsDb } from "../../state/cmsStore";

/**
 * Reactivity hook for pages/components that read CMS data through the
 * imperative data/selectors helpers. Calling this subscribes the component
 * to CMS mutations; when the store changes the component re-renders and its
 * selector calls see fresh data. Local state (filters, accordions) is kept.
 *
 * Returns the live CMS snapshot so memoized selector results can depend on
 * it (otherwise useMemo would keep serving pre-mutation objects).
 *
 * Usage — first line of the page body:
 *   const cmsDb = useCmsSync();
 */
export function useCmsSync(): CmsDb {
  return useCms();
}
