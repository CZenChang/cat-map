export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('此裝置或瀏覽器不支援 GPS 定位'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy || 0),
        });
      },
      (err) => {
        const messages = {
          1: '未允許位置權限，請在瀏覽器設定中開啟定位',
          2: '無法取得目前位置，請確認 GPS 或網路狀態',
          3: '取得位置逾時，請稍後再試或手動在地圖上點選位置',
        };
        reject(new Error(messages[err.code] || '定位失敗'));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 15000,
        ...options,
      }
    );
  });
}

export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&accept-language=zh-TW`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
    if (!res.ok) return '';
    const data = await res.json();
    const addr = data.address || {};
    const parts = [
      addr.city || addr.county || addr.town || addr.village,
      addr.suburb || addr.district || addr.city_district,
      addr.road || addr.pedestrian || addr.neighbourhood,
    ].filter(Boolean);
    if (parts.length > 0) {
      return [...new Set(parts)].join(' ');
    }
    return data.display_name ? data.display_name.split(',').slice(0, 3).join(' ').trim() : '';
  } catch {
    return '';
  }
}

const dtFormatter = new Intl.DateTimeFormat('zh-TW', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return dtFormatter.format(date);
}
