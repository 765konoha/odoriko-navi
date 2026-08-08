/** Google Maps の経路検索を開く外部リンク(APIキー不要) */
export function googleMapsRouteUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}
