const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const publicLink = "https://disk.yandex.ru/i/HPfnJ8OPM-ZEYg";

    // Метод 1: Попытка прямой загрузки
    let fileUrl;
    
    try {
      // Получаем прямую ссылку через API
      const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicLink)}`;
      
      const apiResponse = await fetch(apiUrl);
      const apiData = await apiResponse.json();
      
      if (apiData.href) {
        fileUrl = apiData.href;
      } else {
        throw new Error('No download link');
      }
    } catch (apiError) {
      console.log('API method failed, trying direct link');
      // Метод 2: Прямая ссылка
      fileUrl = publicLink.replace('/i/', '/d/');
    }

    // Скачиваем файл
    console.log('Downloading from:', fileUrl);
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      throw new Error(`Download failed: ${fileResponse.status}`);
    }

    const buffer = await fileResponse.arrayBuffer();
    
    // Конвертируем в base64 для передачи
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
        error: error.message,
        details: error.stack
      })
    };
  }
};
