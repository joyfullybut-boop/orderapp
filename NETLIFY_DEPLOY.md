# 🚀 Развёртывание на Netlify с Functions

## 📋 Что изменилось:

### Добавлено:
1. **Netlify Function** (`netlify/functions/getExcel.js`)
   - Серверная функция для загрузки Excel
   - Работает на стороне Netlify
   - Обходит CORS проблемы

2. **package.json** - зависимости Node.js
3. **netlify.toml** - конфигурация Netlify

### Преимущества:
✅ Надёжная загрузка файлов
✅ Нет CORS проблем
✅ Автоматические обновления
✅ Работает всегда

---

## 🔧 Установка на Netlify:

### Вариант 1: Через Git (Рекомендуется)

#### Шаг 1: Создайте Git репозиторий
```bash
cd OrderAppPWA
git init
git add .
git commit -m "Initial commit with Netlify Functions"
```

#### Шаг 2: Загрузите на GitHub
1. Создайте репозиторий на GitHub
2. Выполните:
```bash
git remote add origin https://github.com/ваш-username/orderapp.git
git branch -M main
git push -u origin main
```

#### Шаг 3: Подключите к Netlify
1. Зайдите на https://netlify.com
2. New site from Git
3. Connect to GitHub
4. Выберите репозиторий
5. Build settings:
   - Build command: `npm install`
   - Publish directory: `.`
6. Deploy site!

---

### Вариант 2: Через Netlify CLI

#### Шаг 1: Установите Netlify CLI
```bash
npm install -g netlify-cli
```

#### Шаг 2: Войдите в аккаунт
```bash
netlify login
```

#### Шаг 3: Инициализируйте проект
```bash
cd OrderAppPWA
netlify init
```

Выберите:
- Create & configure a new site
- Следуйте инструкциям

#### Шаг 4: Деплой
```bash
netlify deploy --prod
```

---

### Вариант 3: Drag & Drop (Простейший, но без Functions!)

⚠️ **ВНИМАНИЕ:** Drag & Drop НЕ поддерживает Functions!

Для Functions ОБЯЗАТЕЛЬНО используйте Вариант 1 или 2.

---

## 📁 Структура проекта:

```
OrderAppPWA/
├── netlify/
│   └── functions/
│       └── getExcel.js          ← Серверная функция
├── icons/
├── index.html
├── app.js
├── telegram.js
├── storage.js
├── excel-parser.js
├── analytics.js
├── performance.js
├── styles.css
├── sw.js
├── manifest.json
├── package.json                  ← Зависимости
└── netlify.toml                  ← Конфигурация Netlify
```

---

## 🧪 Тестирование локально:

### Установите зависимости:
```bash
cd OrderAppPWA
npm install
```

### Запустите локальный сервер:
```bash
netlify dev
```

Откройте: http://localhost:8888

### Проверьте Function:
```bash
curl http://localhost:8888/.netlify/functions/getExcel
```

Должен вернуть JSON с данными файла.

---

## ✅ Как это работает:

### Схема работы:

```
┌─────────────┐
│  Приложение │
└──────┬──────┘
       │ fetch('/.netlify/functions/getExcel')
       ↓
┌─────────────────┐
│ Netlify Function│
└──────┬──────────┘
       │ 1. Получает ссылку
       │ 2. Скачивает Excel
       │ 3. Конвертирует в base64
       ↓
┌──────────────┐
│ Яндекс.Диск  │
└──────────────┘
```

### Код на фронте:
```javascript
// В telegram.js автоматически определяет:
if (isNetlify) {
  // Использует Function
  fetch('/.netlify/functions/getExcel')
} else {
  // Fallback на прямую загрузку
}
```

---

## 🔄 Обновление файла:

1. Измените файл на Яндекс.Диске
2. В приложении: Настройки → "Обновить прайс-лист"
3. Function скачает новую версию автоматически!

**Кеширование:** Нет! Всегда актуальная версия.

---

## 🐛 Решение проблем:

### Function не работает:
1. Проверьте что сайт на Netlify
2. Проверьте логи: Netlify Dashboard → Functions → Logs
3. Убедитесь что `node-fetch` установлен

### "Function returned error":
1. Откройте логи Functions
2. Скопируйте ошибку
3. Проверьте ссылку на Яндекс.Диск

### Локально работает, на Netlify нет:
1. Убедитесь что деплой через Git или CLI
2. Drag & Drop НЕ поддерживает Functions!
3. Проверьте `netlify.toml` присутствует

---

## 💡 Советы:

### Для больших файлов (>10MB):
Добавьте в `getExcel.js`:
```javascript
// Кеширование на 5 минут
headers['Cache-Control'] = 'public, max-age=300';
```

### Для отладки:
В Function добавьте:
```javascript
console.log('Downloading:', fileUrl);
console.log('Size:', buffer.byteLength);
```

Смотрите логи в Netlify Dashboard.

---

## 📊 Мониторинг:

Netlify Dashboard показывает:
- Количество вызовов Function
- Время выполнения
- Ошибки
- Логи

Лимиты бесплатного плана:
- 125,000 вызовов/месяц
- 100 часов выполнения

Этого **более чем достаточно** для вашего приложения!

---

## 🎯 Чеклист готовности:

- [ ] Создан Git репозиторий
- [ ] Загружено на GitHub
- [ ] Подключено к Netlify
- [ ] Build успешный
- [ ] Function работает
- [ ] Приложение загружает прайс
- [ ] Все функции работают

---

## 🚀 Быстрый старт:

### Если уже есть на Netlify (через Drag & Drop):

**НУЖНО ПЕРЕДЕЛАТЬ!** Drag & Drop не поддерживает Functions.

1. Создайте GitHub репозиторий
2. Загрузите код
3. Пересоздайте сайт на Netlify через Git
4. Готово!

### Если нового проекта:

1. Создайте репозиторий на GitHub
2. Загрузите OrderAppPWA
3. Netlify → New site from Git
4. Выберите репозиторий
5. Deploy!

---

**Всё готово! Netlify Function обеспечивает надёжную работу! 🎉**
