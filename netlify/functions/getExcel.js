// netlify/functions/getExcel.js
exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const publicLink = "https://disk.yandex.ru/i/HPfnJ8OPM-ZEYg";

    const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicLink)}`;
    
    const apiResponse = await fetch(apiUrl);   // ← встроенный fetch (без node-fetch)
    const apiData = await apiResponse.json();

    if (!apiData.href) {
      throw new Error('Не удалось получить ссылку на скачивание');
    }

    console.log('✅ Прямая ссылка получена');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        downloadUrl: apiData.href,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Ошибка получения ссылки'
      })
    };
  }
};
