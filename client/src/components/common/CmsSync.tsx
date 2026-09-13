import { useCms } from "../../state/CmsProvider";

/**
 * Reactivity hook for pages/components that read CMS data through the
 * imperative data/selectors helpers. Calling this subscribes the component
 * to CMS mutations; when the store changes the component re-renders and its
 * selector calls see fresh data. Local state (filters, accordions) is kept.
 *
 * Usage — first line of the page body:
 *   useCmsSync();
 */
export function useCmsSync(): void {
  useCms();
}
