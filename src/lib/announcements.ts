import type { Announcement } from "../types/domain";

/** 現在公開中のお知らせか(公開日時を過ぎていて、公開終了していない) */
export function isActiveAnnouncement(a: Announcement, now: Date): boolean {
  if (new Date(a.publishedAt).getTime() > now.getTime()) return false;
  if (a.expiresAt && new Date(a.expiresAt).getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

/** 公開中のお知らせを新しい順で返す */
export function activeAnnouncements(
  list: Announcement[],
  now: Date,
): Announcement[] {
  return list
    .filter((a) => isActiveAnnouncement(a, now))
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
}
