// api/bookings.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const BIN_ID = process.env.BOOKING_BIN_ID;
  const API_KEY = process.env.JSONBIN_KEY;
  const url = `https://api.jsonbin.io/v3/b/${BIN_ID}${req.method === 'GET' ? '/latest' : ''}`;

  if (!BIN_ID || !API_KEY) {
    return res.status(500).json({ error: 'Vercel 环境变量未配置' });
  }

  try {
    // 1. 处理 GET 请求（获取预约列表）
    if (req.method === 'GET') {
      const response = await fetch(url, {
        headers: { 'X-Access-Key': API_KEY } // 注意：确保这里与你填的 Key 类型一致
      });
      const data = await response.json();
      return res.status(200).json(data.record || []);
    }

    // 2. 处理 POST 请求（提交新预约）
    if (req.method === 'POST') {
      const { platform, devices, date, time, name, phone, note } = req.body;

      const getRes = await fetch(`${url}/latest`, {
        headers: { 'X-Access-Key': API_KEY }
      });
      const getJson = await getRes.json();
      const currentRecords = getJson.record || [];

      for (const device of devices) {
        const conflict = currentRecords.some(r => 
          r.platform === platform && 
          r.device === device && 
          r.date === date && 
          (r.time === '全天' || time === '全天' || r.time === time)
        );
        if (conflict) {
          return res.status(400).json({ success: false, message: `设备 ${device} 在 ${date} ${time} 已被预约，请刷新后重试` });
        }
      }

      const newRecords = devices.map(device => ({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
        platform,
        device,
        date,
        time,
        name,
        phone,
        note
      }));

      const updatedRecords = [...currentRecords, ...newRecords];

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Access-Key': API_KEY 
        },
        body: JSON.stringify(updatedRecords)
      });

      if (!putRes.ok) throw new Error('保存数据失败');

      return res.status(200).json({ success: true, message: '预约成功！' });
    }

    // 3. 🟢 新增：处理 DELETE 请求（取消预约）
    if (req.method === 'DELETE') {
      // 从 URL 获取要取消的记录 ID (例如: /api/bookings?id=xxx)
      const { id } = req.query;

      if (!id) return res.status(400).json({ success: false, message: '缺少预约ID' });

      const getRes = await fetch(`${url}/latest`, {
        headers: { 'X-Access-Key': API_KEY }
      });
      const getJson = await getRes.json();
      const currentRecords = getJson.record || [];

      // 过滤掉要取消的那条记录
      const updatedRecords = currentRecords.filter(r => r.id !== id);

      if (currentRecords.length === updatedRecords.length) {
        return res.status(404).json({ success: false, message: '找不到该预约记录，可能已被取消' });
      }

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Access-Key': API_KEY 
        },
        body: JSON.stringify(updatedRecords)
      });

      if (!putRes.ok) throw new Error('取消预约失败');

      return res.status(200).json({ success: true, message: '已成功取消预约' });
    }

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
