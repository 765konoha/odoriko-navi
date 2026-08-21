import type {
  Announcement,
  FestivalData,
  FestivalParticipant,
  ScheduleItem,
} from "../types/domain";
import type { UserSelection } from "./storage";

// 予定・お知らせの表示対象判定。
// すべてクライアント側で判定する(認証なしの表示切替であり、秘匿目的ではない)。

/** 現在の利用者を祭りデータに照らして解決した結果 */
export interface Viewer {
  /** 参加者として解決できた場合の参加者情報(番号指定なし・不参加時は null) */
  participant: FestivalParticipant | null;
  /** 表示判定に使う役職ID。番号指定なし・役職未付与は既定役職(踊り子一般) */
  roleIds: string[];
  /** 選択中のシリアルが今回の祭りに不参加(番号指定なし扱いで表示) */
  notParticipating: boolean;
  serial: string | null;
}

export function resolveViewer(
  data: FestivalData,
  selection: UserSelection | null,
): Viewer {
  const defaultRoleIds = data.roles
    .filter((r) => r.isDefault)
    .map((r) => r.id);
  const serial = selection?.serial ?? null;
  if (serial == null) {
    return { participant: null, roleIds: defaultRoleIds, notParticipating: false, serial: null };
  }
  const participant = data.participants.find((p) => p.serial === serial) ?? null;
  if (!participant) {
    // 今回の祭りに不参加のシリアル → 番号指定なし(踊り子一般)として表示
    return { participant: null, roleIds: defaultRoleIds, notParticipating: true, serial };
  }
  return {
    participant,
    // 役職未付与の参加者は踊り子一般として扱う(全員向け以外が何も見えなくなるのを防ぐ)
    roleIds: participant.roleIds.length > 0 ? participant.roleIds : defaultRoleIds,
    notParticipating: false,
    serial,
  };
}

/** 予定が現在の利用者に表示されるか(複数役職はOR判定) */
export function isScheduleItemVisible(
  item: ScheduleItem,
  viewer: Viewer,
): boolean {
  if (item.audienceAll ?? true) return true;
  return (item.audienceRoleIds ?? []).some((id) => viewer.roleIds.includes(id));
}

export function visibleScheduleItems(
  items: ScheduleItem[],
  viewer: Viewer,
): ScheduleItem[] {
  return items.filter((item) => isScheduleItemVisible(item, viewer));
}

/** お知らせが現在の利用者に配信されているか */
export function isAnnouncementVisible(
  announcement: Announcement,
  viewer: Viewer,
): boolean {
  const type = announcement.audienceType ?? "all";
  if (type === "all") return true;
  if (type === "roles") {
    return (announcement.audienceRoleIds ?? []).some((id) =>
      viewer.roleIds.includes(id),
    );
  }
  // 個人向け: 番号指定なし・不参加者には表示しない
  return (
    viewer.participant != null &&
    (announcement.audienceParticipantIds ?? []).includes(viewer.participant.id)
  );
}

export function visibleAnnouncements(
  list: Announcement[],
  viewer: Viewer,
): Announcement[] {
  return list.filter((a) => isAnnouncementVisible(a, viewer));
}

/** 利用者の表示ラベル(シリアル + ニックネーム) */
export function viewerLabel(viewer: Viewer): string {
  if (viewer.serial == null) return "番号指定なし / 踊り子一般";
  if (viewer.participant) {
    return `${viewer.serial} / ${viewer.participant.nickname}`;
  }
  return `${viewer.serial} / 今回は不参加`;
}

/** シリアルの並び("001" "033" "615" "K-010" の順になる自然順) */
export function compareSerial(a: string, b: string): number {
  return a.localeCompare(b, "ja", { numeric: true });
}
