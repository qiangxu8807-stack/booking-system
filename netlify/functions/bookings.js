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

    const { platform, devices, date, time, name, phone, note } = data;

    if (!platform || !devices || !devices.length || !date || !time || !name || !phone) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: '信息不完整' }) };
    }

    const list = (await store.get('all', { type: 'json' })) || [];

    // 检查所有选中设备是否都空闲
    const conflicts = [];
    for (const device of devices) {
      const sameCombo = list.filter(b =>
        b.platform === platform && b.device === device && b.date === date
      );
      const hasFullDay = sameCombo.some(b => b.time === '全天');
      const hasPartial = sameCombo.some(b => b.time !== '全天');
      const timeTaken = sameCombo.some(b => b.time === time);

      if (time === '全天') {
        if (hasFullDay || hasPartial) conflicts.push(device);
      } else {
        if (hasFullDay || timeTaken) conflicts.push(device);
      }
    }

    if (conflicts.length) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          message: `以下设备在该时段已被预约：${conflicts.join('、')}`
        })
      };
    }

    // 为每台选中设备追加一条记录
    const now = new Date().toISOString();
    for (const device of devices) {
      list.push({
        platform,
        device,
        date,
        time,
        name,
        phone,
        note: note || '',
        createdAt: now
      });
    }

    await store.setJSON('all', list);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `预约成功！共 ${devices.length} 台设备`
      })
    };
  }

  return { statusCode: 405, headers, body: 'Method Not Allowed' };
};
