# GigaCaller Agent

GigaCaller Agent - демо-агент для телефонных звонков на конференции CodeFest 2026.

Приложение позволяет запустить голосовой квест по реальному номеру телефона: участник разговаривает с LLM через GigaCaller, а оператор демо видит живую расшифровку и итоговую карточку разговора в веб-интерфейсе.

![GigaCaller Agent UI](docs/assets/gigacaller-agent-desktop.png)

## Что умеет агент

- звонит участнику через `gigacaller-gateway`;
- ведет один из готовых русскоязычных демо-квестов;
- поддерживает свободный безопасный промпт;
- стримит расшифровку разговора в браузер;
- показывает итоговую карточку после завершения звонка;
- генерирует карточку через GigaChat, если он настроен;
- использует локальную fallback-карточку, если GigaChat недоступен;
- не показывает binary audio в UI;
- не требует изменений в сервисах GigaCaller.

## Квесты

- `Айтишный Архетип` - шуточное интервью, которое превращает участника в инженерный архетип.
- `Исповедь Отладчика` - история странного бага превращается в короткий postmortem.
- `Мини-RPG: Прод Упал` - голосовой incident-квест, где участник спасает production.
- `Свободный промпт` - свой безопасный сценарий для демо-звонка.

## Как это устроено

Это один Node.js-процесс:

- React UI отдается тем же сервером;
- браузер отправляет команды через REST API;
- браузер получает live-события через SSE;
- backend держит in-memory сессии звонков;
- backend подключается к `gigacaller-gateway` по WebSocket;
- backend отправляет `initialRequest` в GigaCaller Gateway;
- backend игнорирует binary audio chunks;
- backend вызывает GigaChat только после завершения звонка, чтобы собрать result card.

```text
Browser UI
  | REST commands
  | SSE live events
  v
Agent Backend
  | WebSocket initialRequest/status/transcription/functionCall
  v
gigacaller-gateway
  | GigaCaller internals
  v
Phone call with participant

Agent Backend
  | post-call HTTP request
  v
GigaChat result-card generation
```

Основные API:

- `GET /api/quests` - список квестов и голосов;
- `POST /api/calls` - старт звонка;
- `GET /api/calls/:sessionId` - состояние сессии;
- `GET /api/calls/:sessionId/events` - SSE-поток событий;
- `POST /api/calls/:sessionId/interrupt` - прервать звонок.

## Требования

- Node.js 20 или новее.
- npm.
- Доступный `gigacaller-gateway`.
- Доступ к GigaChat, если нужны LLM-generated result cards.

Проверить Node.js:

```bash
node -v
```

Если версия ниже 20, установите Node.js 20. Удобный вариант для локальной разработки:

```bash
nvm install 20
nvm use 20
```

## Быстрый старт

Этот путь нужен, если хочется просто поднять UI и проверить, что проект запускается.

```bash
git clone git@github.com:dianagerdt/caller-agent.git
cd caller-agent
npm install
cp .env.example .env
```

Заполните `.env`, затем запустите:

```bash
npm run dev
```

Откройте:

```text
http://localhost:3000
```

## Первый успешный звонок за 5 минут

1. Убедитесь, что Node.js версии 20+:

   ```bash
   node -v
   ```

2. Установите зависимости:

   ```bash
   npm install
   ```

3. Создайте `.env`:

   ```bash
   cp .env.example .env
   ```

4. Заполните минимум:

   ```env
   GIGACALLER_GATEWAY_WS_URL=wss://mock-gateway.example.test
   GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED=true
   ```

5. Запустите приложение:

   ```bash
   npm run dev
   ```

6. Откройте `http://localhost:3000`.
7. Введите номер в формате `+7XXXXXXXXXX`.
8. Выберите `Айтишный Архетип`.
9. Нажмите `Старт звонка`.
10. Ожидаемый результат: статус меняется, появляется live transcript, после финала справа появляется карточка `gigachat` или `fallback`.

## Настройка `.env`

Минимально нужно указать gateway:

```env
PORT=3000
GIGACALLER_GATEWAY_WS_URL=wss://your-gateway.example.ru
GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED=true
DEFAULT_RETRY=0
DEFAULT_VOICE=Bik-Freespeech_8000
```

`GIGACALLER_GATEWAY_WS_URL` можно задавать как base URL:

```env
GIGACALLER_GATEWAY_WS_URL=wss://gateway.example.ru
```

Приложение само добавит `/v1/ws`, если путь не указан. Если указать `wss://gateway.example.ru/v1/ws`, дубля не будет.

Для локального демо со стендом, сертификат которого не доверен вашей Node.js-установке, можно временно поставить:

```env
GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED=false
```

Для production лучше установить корпоративный CA и оставить значение `true`.

## `.env` cookbook

### Только gateway, без GigaChat

В этом режиме звонок работает, transcript отображается, result card будет `fallback`.

```env
PORT=3000
GIGACALLER_GATEWAY_WS_URL=wss://mock-gateway.example.test
GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED=true
DEFAULT_RETRY=0
DEFAULT_VOICE=Bik-Freespeech_8000

GIGACHAT_ACCESS_TOKEN=
GIGACHAT_CREDENTIALS=
GIGACHAT_USERNAME=
GIGACHAT_PASSWORD=
GIGACHAT_SCOPE=
GIGACHAT_TLS_REJECT_UNAUTHORIZED=true
GIGACHAT_AUTH_URL=
GIGACHAT_API_BASE_URL=
GIGACHAT_MODEL=GigaChat
```

### Gateway с TLS bypass для локального стенда

Используйте только локально, если Node.js не доверяет сертификату стенда.

```env
GIGACALLER_GATEWAY_WS_URL=wss://mock-gateway.example.test
GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED=false
```

### GigaChat по готовому token

```env
GIGACHAT_ACCESS_TOKEN=your_token
GIGACHAT_API_BASE_URL=https://mock-gigachat-api.example.test/api/v1
GIGACHAT_MODEL=GigaChat
GIGACHAT_TLS_REJECT_UNAUTHORIZED=true
```

### GigaChat по login/password

```env
GIGACHAT_USERNAME=your_login
GIGACHAT_PASSWORD=your_password
GIGACHAT_AUTH_URL=https://mock-gigachat-auth.example.test/v1/token
GIGACHAT_API_BASE_URL=https://mock-gigachat-api.example.test/v1
GIGACHAT_MODEL=GigaChat
GIGACHAT_SCOPE=
GIGACHAT_TLS_REJECT_UNAUTHORIZED=true
```

### Локальный GigaChat-стенд с TLS bypass

Используйте только локально.

```env
GIGACHAT_TLS_REJECT_UNAUTHORIZED=false
```

## Настройка GigaChat

GigaChat необязателен. Если он не настроен или недоступен, приложение покажет deterministic fallback-card.

Поддерживаются три способа авторизации. Приоритет такой:

1. `GIGACHAT_ACCESS_TOKEN`
2. `GIGACHAT_CREDENTIALS`
3. `GIGACHAT_USERNAME` + `GIGACHAT_PASSWORD`

### Вариант 1: готовый token

```env
GIGACHAT_ACCESS_TOKEN=your_token
GIGACHAT_API_BASE_URL=https://mock-gigachat-api.example.test/api/v1
GIGACHAT_MODEL=GigaChat
```

Если задан `GIGACHAT_ACCESS_TOKEN`, OAuth-запрос не выполняется.

### Вариант 2: pre-encoded Basic credentials

```env
GIGACHAT_CREDENTIALS=base64_client_credentials
GIGACHAT_SCOPE=GIGACHAT_API_PERS
GIGACHAT_AUTH_URL=https://mock-gigachat-auth.example.test/api/v2/oauth
GIGACHAT_API_BASE_URL=https://mock-gigachat-api.example.test/api/v1
GIGACHAT_MODEL=GigaChat
```

В `GIGACHAT_CREDENTIALS` указывается только base64-значение, без префикса `Basic `.

### Вариант 3: login/password

```env
GIGACHAT_USERNAME=your_login
GIGACHAT_PASSWORD=your_password
GIGACHAT_AUTH_URL=https://mock-gigachat-auth.example.test/v1/token
GIGACHAT_API_BASE_URL=https://mock-gigachat-api.example.test/v1
GIGACHAT_MODEL=GigaChat-3-Ultra
```

`GIGACHAT_SCOPE` можно оставить пустым, если ваш endpoint его не требует.

Если GigaChat endpoint использует сертификат, которому Node.js не доверяет, для локального демо можно временно поставить:

```env
GIGACHAT_TLS_REJECT_UNAUTHORIZED=false
```

Для production лучше установить корпоративный CA и оставить значение `true`.

## Голоса

В UI доступны только freespeech-голоса:

- `Bik-Freespeech_8000`
- `Che-Freespeech_8000`
- `Erm-Freespeech_8000`
- `She-Freespeech_8000`
- `Ved-Freespeech_8000`

## Как провести демо

1. Запустите приложение:

   ```bash
   npm run dev
   ```

2. Откройте `http://localhost:3000`.
3. Введите номер участника.
4. Выберите квест.
5. Выберите голос.
6. Нажмите `Старт звонка`.
7. Следите за live transcript в центральной панели.
8. Дождитесь завершения звонка.
9. Проверьте итоговую карточку справа.

## Как понять, что все работает

Проверка backend:

```bash
curl http://localhost:3000/api/quests
```

Ожидаемый результат: JSON со списком квестов и freespeech-голосов.

Проверка UI:

- страница открывается на `http://localhost:3000`;
- видны квесты и список голосов;
- кнопка `Старт звонка` активна до старта звонка;
- после старта кнопка блокируется и показывает `Звонок идет`;
- центральная панель получает новые реплики;
- transcript сам прокручивается вниз;
- после финала справа появляется `Итоговая карточка`;
- если GigaChat настроен, источник карточки `gigachat`;
- если GigaChat не настроен или недоступен, источник карточки `fallback`.

Телефон должен быть в формате, который принимает GigaCaller:

```text
+7XXXXXXXXXX
8XXXXXXXXXX
```

Пример:

```text
+79130521837
```

## Проверки

Запустить тесты:

```bash
npm test
```

Собрать production build:

```bash
npm run build
```

Запустить собранное приложение:

```bash
npm start
```

## Команды разработки

```bash
npm run dev
```

Запускает backend и отдает UI из текущего процесса.

```bash
npm run dev:client
```

Запускает отдельный Vite dev server для frontend-разработки. API проксируется на `http://localhost:3000`, поэтому backend должен быть запущен отдельно.

```bash
npm run build:server
npm run build:client
```

Собирают backend и frontend по отдельности.

## Troubleshooting

### `Unsupported engine`, Node.js ниже 20

Установите Node.js 20+:

```bash
nvm install 20
nvm use 20
npm install
```

### `unable to get local issuer certificate`

Node.js не доверяет сертификату gateway или GigaChat endpoint.

Для локального демо можно временно использовать:

```env
GIGACALLER_GATEWAY_TLS_REJECT_UNAUTHORIZED=false
GIGACHAT_TLS_REJECT_UNAUTHORIZED=false
```

Для production установите нужный CA и верните значения в `true`.

### `Invalid phone number`

GigaCaller принимает российские номера в формате:

```text
+7XXXXXXXXXX
8XXXXXXXXXX
```

Голый `7XXXXXXXXXX` gateway отклоняет.

### Result Card показывает `fallback`

Это значит, что GigaChat не был настроен или запрос к нему упал. В live technical events будет причина fallback.

Проверьте:

- заполнены ли GigaChat env-переменные;
- доступен ли `GIGACHAT_AUTH_URL`;
- доступен ли `GIGACHAT_API_BASE_URL`;
- верно ли указан `GIGACHAT_MODEL`;
- не нужна ли настройка TLS trust.

### Кнопка запуска недоступна

Кнопка блокируется, пока текущий звонок активен. Дождитесь итоговой карточки или нажмите `Прервать`.

### Порт 3000 занят

Измените порт:

```env
PORT=3001
```

И откройте:

```text
http://localhost:3001
```

## FAQ

### Нужно ли запускать frontend отдельно?

Нет. `npm run dev` запускает backend, который отдает UI и API из одного процесса. `npm run dev:client` нужен только для frontend-разработки.

### Почему карточка `fallback`, хотя разговор прошел?

Звонок и result-card генерация независимы. Звонок может пройти успешно, но GigaChat может быть не настроен, недоступен или вернуть невалидный JSON. В таком случае backend показывает fallback-card и пишет причину в technical events.

### Почему GigaCaller отклоняет номер?

Gateway принимает `+7XXXXXXXXXX` или `8XXXXXXXXXX`. Номер `7XXXXXXXXXX` без плюса отклоняется.

### Можно ли использовать приложение без GigaChat?

Да. Звонки, transcript и fallback-card будут работать без GigaChat.

### Где хранятся сессии?

Только в памяти Node.js-процесса. После перезапуска сервера история исчезает.

## Checklist оператора демо

Перед конференционным демо:

- Node.js 20+ установлен.
- `npm install` выполнен.
- `.env` заполнен и не закоммичен.
- `GIGACALLER_GATEWAY_WS_URL` ведет на рабочий gateway.
- Если нужен GigaChat, заполнен один из способов авторизации.
- TLS bypass включен только если без него локальный стенд не работает.
- `npm test` проходит.
- `npm run build` проходит.
- `npm run dev` запущен.
- `http://localhost:3000/api/quests` возвращает JSON.
- UI открывается.
- Тестовый номер вводится в формате `+7XXXXXXXXXX`.
- Оператор заранее предупредил участника, что будет демо-звонок.

## Безопасность

- Не коммитьте `.env`.
- Используйте `.env.example` как шаблон.
- Не вводите чужие номера без согласия участника.
- Не используйте демо-агента для сбора паролей, кодов, паспортных или банковских данных.
- TLS bypass-флаги предназначены только для локального демо.

## Ограничения

- Сессии хранятся в памяти и пропадают после перезапуска.
- Binary audio chunks игнорируются.
- Приложение не меняет код GigaCaller-сервисов.
- Result card генерируется после завершения звонка.
- Если GigaChat недоступен, используется fallback-card.
