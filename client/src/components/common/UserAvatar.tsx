import { useState } from "react";

/**
 * Shared user avatar (Step 7: Google profile integration).
 *
 * Google users with a valid `profileImageUrl` (from `/me`) see their
 * picture; everyone else — password users, Google users without a picture,
 * or a picture that fails to load — sees the existing initials circle.
 * Broken images fall back locally without retries and never touch the DB.
 */

/** First letters of the first two words ("Aarav Sharma" → "AS"). */
export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

/**
 * Totally blank values and non-HTTPS schemes never reach `<img>`: the
 * backend stores only verified HTTPS picture URLs, and this mirrors that
 * contract for any legacy/manual document value.
 */
export function avatarSrc(imageUrl?: string): string {
  const src = imageUrl?.trim() ?? "";
  return /^https:\/\//i.test(src) ? src : "";
}

type AvatarSize = "sm" | "md" | "lg";

/** Exact circle geometry previously inlined at each usage site. */
const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: "size-8 text-xs",
  md: "size-9 text-xs",
  lg: "size-20 shrink-0 text-2xl shadow-card sm:size-24 sm:text-3xl",
};

interface UserAvatarProps {
  /** Display name: initials fallback source and image alt text. */
  name: string;
  /** Optional `/me` profile image URL. Absent/blank/broken → fallback. */
  imageUrl?: string;
  size?: AvatarSize;
}

export function UserAvatar({ name, imageUrl, size = "md" }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const src = avatarSrc(imageUrl);
  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        className={`flex ${SIZE_CLASS[size]} items-center justify-center rounded-full bg-primary font-bold text-primary-foreground`}
      >
        {initialsOf(name)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className={`${SIZE_CLASS[size]} rounded-full object-cover`}
    />
  );
}
