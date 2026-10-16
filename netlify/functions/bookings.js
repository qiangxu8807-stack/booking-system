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

    const list = (await store.get('all', { type: 'json' })) || [];
    const hasFullDay = list.some(b => b.date === data.date && b.time === '全天');
    const hasPartial = list.some(b => b.date === data.date && b.time !== '全天');
    const timeTaken = list.some(b => b.date === data.date && b.time === data.time);

    if (data.time === '全天') {
      if (hasFullDay || hasPartial) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: '该日期已有预约，无法预约全天' }) };
      }
    } else {
      if (hasFullDay) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: '该日期已被预约全天' }) };
      }
      if (timeTaken) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: false, message: '该时段已被预约' }) };
      }
    }

    list.push({
      date: data.date,
      time: data.time,
      name: data.name,
      phone: data.phone,
      note: data.note || '',
      createdAt: new Date().toISOString()
    });

    await store.setJSON('all', list);

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: '预约成功！' }) };
  }

  return { statusCode: 405, headers, body: 'Method Not Allowed' };
};
