# GigaCaller Agent

Веб-демо для голосовых квестов через `gigacaller-gateway`: оператор вводит номер участника, выбирает сценарий, запускает звонок и видит live transcript, технические события и итоговую карточку разговора.

Итоговая карточка генерируется через GigaChat. Если GigaChat не настроен или временно недоступен, приложение покажет локальную fallback-карточку, а звонки продолжат работать.

![GigaCaller Agent UI](docs/assets/gigacaller-agent-desktop.png)

## Что умеет

- React UI и Node.js backend.
- REST API для старта и остановки звонка.
- SSE для live transcript и статусов.
- WebSocket-клиент для `gigacaller-gateway`.
- Cookie-aware WebSocket handshake для gateway-стендов за nginx.
- GigaChat post-call генерация итоговой карточки.
- Свободный промпт отправляется в `systemPrompt` как есть, без backend-добавок.
- Binary audio chunks не выводятся в UI.

## Квесты

- `Айтишный Архетип` - шуточное интервью, которое превращает участника в инженерный архетип.
- `Исповедь Отладчика` - история бага превращается в мини-postmortem.
- `Мини-RPG: Прод Упал` - голосовой incident-квест.
- `Свободный промпт` - полностью ваш системный промпт для звонка.

## Требования

- Node.js 20+.
- npm.
- Доступный `gigacaller-gateway`.
- GigaChat Authorization Key, если нужна LLM-карточка вместо fallback.

Проверка Node.js:

```bash
node -v
npm -v
```

## Установка

```bash
git clone https://github.com/dianagerdt/caller-agent.git
cd caller-agent
npm ci
cp .env.example .env
```

На Windows вместо `cp`:

```powershell
Copy-Item .env.example .env
```

Используйте `npm ci`, а не `npm install`: в репе есть `package-lock.json`, поэтому `npm ci` ставит ровно зафиксированные версии зависимостей.

## Быстрый запуск для разработки

```bash
npm run dev
```

Команда поднимает два процесса:

- backend API на `http://localhost:3000`;
- Vite UI на `http://localhost:5173`.

Открывайте UI:

```text
http://localhost:5173
```

Если открыть `http://localhost:3000` в dev-режиме, это backend-порт. Для страницы `/` там будет `Route GET:/ not found`, и это не ошибка UI.

## Production-сборка

```bash
npm run build
npm start
```

После production-сборки backend отдает собранный UI сам. В этом режиме открывайте:

```text
http://localhost:3000
```

## Настройка `.env`

Минимальная настройка для звонков:

```env
PORT=3000
GIGACALLER_GATEWAY_WS_URL=wss://your-gateway.example.test
GIGACALLER_GATEWAY_USERNAME=your_gateway_login
GIGACALLER_GATEWAY_PASSWORD=your_gateway_password
GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED=true
DEFAULT_RETRY=0
DEFAULT_VOICE=Bik-Freespeech_8000
```

Для workshop-стенда gateway использует Basic Auth и cookie на redirect'ах.

Если локальный стенд использует недоверенный сертификат, временно поставьте:

```env
GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED=false
```

## GigaChat

GigaChat нужен только для красивой итоговой карточки. Без него звонок и fallback-карточка работают.

1. Откройте https://developers.sber.ru/studio.
2. Создайте или откройте проект GigaChat API.
3. Получите Authorization Key в настройках API.
4. Заполните `.env`:

```env
GIGACHAT_API_KEY=your_authorization_key
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_AUTH_URL=https://ngw.devices.sberbank.ru:9443/api/v2/oauth
GIGACHAT_API_BASE_URL=https://gigachat.devices.sberbank.ru/api/v1
GIGACHAT_MODEL=GigaChat
GIGACHAT_TLS_REJECT_UNAUTHORIZED=true
```

Если GigaChat-стенд использует недоверенный сертификат, для локального демо можно временно поставить:

```env
GIGACHAT_TLS_REJECT_UNAUTHORIZED=false
```

## Как провести демо

1. Запустите `npm run dev`.
2. Откройте `http://localhost:5173`.
3. Введите номер участника в формате `+7XXXXXXXXXX` или `8XXXXXXXXXX`.
4. Выберите квест и freespeech-голос.
5. Нажмите `Старт звонка`.
6. Следите за live transcript.
7. После завершения звонка посмотрите карточку справа.

## Доступные голоса

- `Bik-Freespeech_8000`
- `Che-Freespeech_8000`
- `Erm-Freespeech_8000`
- `She-Freespeech_8000`
- `Ved-Freespeech_8000`

## Команды

```bash
npm run dev         # backend на 3000 + UI на 5173
npm run dev:server  # только backend
npm run dev:client  # только Vite UI
npm test            # тесты
npm run build       # production build
npm start           # запуск production build
```

## Troubleshooting

### `SELF_SIGNED_CERT_IN_CHAIN` при `npm ci`

На Windows в корпоративной сети npm может падать на скачивании пакетов с ошибкой `SELF_SIGNED_CERT_IN_CHAIN`. Обычно это значит, что HTTPS до `registry.npmjs.org` проходит через корпоративный прокси или антивирус, а Node.js не доверяет его сертификату.

Проверьте настройки:

```powershell
npm config get strict-ssl
npm config get cafile
npm config get proxy
npm config get https-proxy
```

Если корпоративный CA экспортирован в PEM-файл, укажите его для npm и Node.js:

```powershell
npm config set cafile "C:\Users\your-user\certs\corp-root.pem"
setx NODE_EXTRA_CA_CERTS "C:\Users\your-user\certs\corp-root.pem"
```

После `setx` откройте новый PowerShell и проверьте:

```powershell
npm ping --verbose
```

Если сертификат пока не настроен, для локального демо можно временно отключить strict SSL и audit:

```powershell
npm config set strict-ssl false
npm ci --no-audit
```

После успешного `npm ci --no-audit` делать `npm install` не нужно. Зависимости уже установлены из `package-lock.json`, можно запускать:

```powershell
npm run dev
```

После установки верните проверку TLS:

```powershell
npm config set strict-ssl true
```

### `Route GET:/ not found` на `localhost:3000`

В dev-режиме `3000` - это backend API, а UI отдает Vite на `5173`.

Открывайте:

```text
http://localhost:5173
```

Если нужен один процесс на `3000`, используйте production-сборку:

```powershell
npm run build
npm start
```

### `Unsupported engine`

Нужен Node.js 20+.

```bash
node -v
```

### `Invalid phone number`

Используйте российский номер:

```text
+7XXXXXXXXXX
8XXXXXXXXXX
```

### Карточка показывает `fallback`

Проверьте:

- `GIGACHAT_API_KEY` заполнен Authorization Key из Studio;
- `GIGACHAT_MODEL=GigaChat` или другая доступная модель;
- при ошибке сертификата поставьте `GIGACHAT_TLS_REJECT_UNAUTHORIZED=false` для локального демо.

## Безопасность

- Не коммитьте `.env`.
- Не вводите номера без согласия участника.
- Не просите у участника пароли, коды, документы или банковские данные.
- TLS bypass используйте только для локального демо.
