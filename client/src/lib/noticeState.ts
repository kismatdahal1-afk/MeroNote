import type { Notice, NoticeWithState } from "../types";

/** Attach computed day state ("X Days Remaining"/"Today"/"Past") to a notice. */
export function noticeWithState(notice: Notice): NoticeWithState {
  const today = new Date();
  const date = new Date(notice.date);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfDay - startOfToday) / 86400000);
  const dayState: NoticeWithState["dayState"] = diffDays > 0 ? "upcoming" : diffDays === 0 ? "today" : "past";
  return {
    ...notice,
    dayCount: Math.abs(diffDays),
    dayState,
  };
}

const PRIORITY_WEIGHT: Record<Notice["priority"], number> = { urgent: 4, high: 3, normal: 2, low: 1 };

export function noticeSort(a: NoticeWithState, b: NoticeWithState): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const pa = PRIORITY_WEIGHT[a.priority] ?? 0;
  const pb = PRIORITY_WEIGHT[b.priority] ?? 0;
  if (pa !== pb) return pb - pa;
  if (a.dayState !== b.dayState) {
    const order: Record<NoticeWithState["dayState"], number> = { today: 0, upcoming: 1, past: 2 };
    return order[a.dayState] - order[b.dayState];
  }
  return +new Date(a.date) - +new Date(b.date);
}
