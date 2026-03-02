const fetch = require('node-fetch'); // ← верни эту строку (установи пакет обратно)

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
    let targetUrl;

    // Если вызвали с ?url=... — это прокси-режим (скачиваем по переданной ссылке)
    if (event.queryStringParameters?.url) {
      targetUrl = decodeURIComponent(event.queryStringParameters.url);
    } else {
      // Обычный режим — получаем временную ссылку от Яндекса
      const publicLink = "https://disk.yandex.ru/i/HPfnJ8OPM-ZEYg";
      const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicLink)}`;
      
      const apiResponse = await fetch(apiUrl);
      const apiData = await apiResponse.json();

      if (!apiData.href) {
        throw new Error('Не удалось получить ссылку на скачивание');
      }
      
      targetUrl = apiData.href;
    }

    // Скачиваем файл (в любом режиме)
    console.log('Downloading from:', targetUrl);
    const fileResponse = await fetch(targetUrl);
    
    if (!fileResponse.ok) {
      throw new Error(`Download failed: ${fileResponse.status}`);
    }

    const buffer = await fileResponse.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        file: base64,
        size: buffer.byteLength,
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
        error: error.message || 'Ошибка'
      })
    };
  }
};
