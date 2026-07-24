// src/utils/formatNextReviewDate.ts

import {
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
} from "date-fns";

export function formatNextReviewDate(
  isoDateString: string
): string {
  const reviewDate = new Date(isoDateString);

  if (isNaN(reviewDate.getTime())) {
    return "Unknown";
  }

  const now = new Date();

  if (reviewDate <= now) {
    return "Ready for review";
  }

  if (isToday(reviewDate)) {
    return `Today at ${format(reviewDate, "HH:mm")}`;
  }

  if (isTomorrow(reviewDate)) {
    return `Tomorrow at ${format(reviewDate, "HH:mm")}`;
  }

  return formatDistanceToNow(reviewDate, {
    addSuffix: true,
  });
}