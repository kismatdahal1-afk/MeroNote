/**
 * Barrel export for the Phase 5 storage layer.
 * Only the service/rules/keys surface is public — the raw B2 client stays
 * behind the service (import b2.client only to reset in tests).
 */
export * from "./b2.service";
export * from "./fileRules";
export * from "./objectKeys";
export { b2Bucket, b2Endpoint, requireB2Config } from "./b2.client";
