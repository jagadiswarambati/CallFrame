"use client";

export default function LastUpdated() {
  // Build-time date - update when content changes
  const date = "October 18, 2026";
  const dateTime = "2026-10-18";

  return <time dateTime={dateTime}>{date}</time>;
}