import { connectLambda, getStore } from '@netlify/blobs';

export const handler = async (event) => {
  connectLambda(event);

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const store = getStore('bookings');

  if (event.httpMethod === 'GET') {
    const list = (await store.get('all', { type: 'json' })) || [];
    return { statusCode: 200, headers, body: JSON.stringify(list) };
  }

  if (event.httpMethod === 'POST') {
    let data;
    try {
      data = JSON.parse(event.body);
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: '请求格式错误' }) };
    }

    const { platform, device, date, time, name, phone, note } = data;

    if (!platform || !device || !date || !time || !name || !phone) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: '信息不完整' }) };
    }

    const list = (await store.get('all', { type: 'json' })) || [];

    // 检查同一平台+同一设备+同一天的冲突
    const sameCombo = list.filter(b =>
      b.platform === platform && b.device === device && b.date === date
    );
    const hasFullDay = sameCombo.some(b => b.time === '全天');
    const hasPartial = sameCombo.some(b => b.time !== '全天');
    const timeTaken = sameCombo.some(b => b.time === time);

    const comboLabel = `${platform} 平台的 ${device}`;

    if (time === '全天') {
      if (hasFullDay || hasPartial) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: `${comboLabel} 该日期已有预约，无法预约全天` }) };
      }
    } else {
      if (hasFullDay) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: `${comboLabel} 该日期已被预约全天` }) };
      }
      if (timeTaken) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: `${comboLabel} 该时段已被预约` }) };
      }
    }

    list.push({
      platform,
      device,
      date,
      time,
      name,
      phone,
      note: note || '',
      createdAt: new Date().toISOString()
    });

    await store.setJSON('all', list);

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: `预约成功！${comboLabel} · ${date} · ${time}` }) };
  }

  return { statusCode: 405, headers, body: 'Method Not Allowed' };
};
