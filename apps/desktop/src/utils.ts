export function formatTimestamp(ts: number | null): string {
  if (!ts) return "Never";

  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  if (sameYear) {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDate(ts: number): string {
  if (!ts) return "Unknown date";

  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  if (sameYear) {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
