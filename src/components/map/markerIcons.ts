import L from "leaflet";

// divIcon による自前 SVG ピン。
// Leaflet デフォルトアイコンのバンドラー環境でのパス問題を回避しつつ、種別で色分けする。
function pin(color: string, innerHtml: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 1C8.7 1 2 7.7 2 16c0 10.5 15 27 15 27s15-16.5 15-27C32 7.7 25.3 1 17 1z"
        fill="${color}" stroke="white" stroke-width="2"/>
      ${innerHtml}
    </svg>`,
    iconSize: [34, 44],
    iconAnchor: [17, 43],
  });
}

export const meetingPointIcon = pin(
  "#1d4ed8",
  '<circle cx="17" cy="16" r="6" fill="white"/>',
);

export const toiletIcon = pin(
  "#059669",
  '<text x="17" y="21" text-anchor="middle" font-size="12" font-weight="bold" fill="white" font-family="sans-serif">WC</text>',
);

export const changingRoomIcon = pin(
  "#7c3aed",
  '<text x="17" y="21" text-anchor="middle" font-size="13" font-weight="bold" fill="white" font-family="sans-serif">更</text>',
);

/** 種別からマーカーアイコンを選ぶ */
export function locationIcon(kind: string): L.DivIcon {
  if (kind === "toilet") return toiletIcon;
  if (kind === "changing_room") return changingRoomIcon;
  return meetingPointIcon;
}

/** 現在地の青い点(アニメーションは index.css の .geo-dot) */
export const currentLocationIcon = L.divIcon({
  className: "",
  html: '<div class="geo-dot"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
