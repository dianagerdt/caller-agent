# Gigacaller gateway

Gateway принимает WebSocket-подключение от клиента, запускает звонок и
возвращает клиенту события по этому звонку: статусы, текстовую расшифровку,
аудио и запросы на выполнение функций.


Если у вас уже есть `requestId`, его можно передать в URL:

```text
ws://<host>/v1/ws/<requestId>
```

`requestId` - это идентификатор одного запроса/звонка. Если не передать его в
URL, gateway создаст новый `requestId` сам.

После подключения gateway сразу отправляет сообщение:

```json
{
  "type": "ready",
  "data": {
    "requestId": "2e7c3e61-7a23-4a8f-8a7f-8c9a4b4f8a11"
  }
}
```

Сохраните этот `requestId`: по нему дальше можно понимать, к какому звонку
относятся события.

## Общий формат JSON-сообщений

Все текстовые сообщения имеют одинаковую структуру:

```json
{
  "type": "название_сообщения",
  "data": {}
}
```

`type` говорит, что это за сообщение. `data` содержит полезные данные.

## Как запустить звонок

После сообщения `ready` клиент отправляет `initialRequest`.

```json
{
  "type": "initialRequest",
  "data": {
    "phoneNumber": "+79991234567",
    "systemPrompt": "Позвони клиенту и уточни, удобно ли ему получить консультацию.",
    "retry": "0",
    "voice": "Bik-Freespeech_8000"
  }
}
```

Поля:

| Поле | Что значит |
| --- | --- |
| `phoneNumber` | Номер телефона, на который нужно позвонить. |
| `systemPrompt` | Инструкция для ассистента: что он должен сказать или узнать. |
| `retry` | Настройки повторной попытки. Если повтор не нужен, обычно передают `"0"`. |
| `voice` | Голос синтеза речи. |

Голоса:

- `Bik-Freespeech_8000`
- `Che-Freespeech_8000`
- `Erm-Freespeech_8000`
- `She-Freespeech_8000`
- `Ved-Freespeech_8000`

Если запрос принят, gateway ответит статусом:

```json
{
  "type": "status",
  "data": {
    "requestId": "2e7c3e61-7a23-4a8f-8a7f-8c9a4b4f8a11",
    "callId": "",
    "status": "published",
    "createdAt": 1730000000000
  }
}
```

Если номер телефона некорректный, gateway вернет ошибку:

```json
{
  "type": "error",
  "data": {
    "message": "Invalid phone number"
  }
}
```

## Проверка соединения

Клиент может отправить `ping`:

```json
{
  "type": "ping"
}
```

Gateway ответит `pong`:

```json
{
  "type": "pong",
  "data": {
    "requestId": "2e7c3e61-7a23-4a8f-8a7f-8c9a4b4f8a11"
  }
}
```

## Что gateway отправляет клиенту

### Статус звонка

```json
{
  "type": "status",
  "data": {
    "requestId": "2e7c3e61-7a23-4a8f-8a7f-8c9a4b4f8a11",
    "callId": "7b3d5f0a-7a6a-4d52-9a3e-8f5f8d8c8b30",
    "status": "completed"
  }
}
```

Точный набор полей внутри `data` зависит от статуса звонка. Главное поле -
`status`.

### Расшифровка речи

```json
{
  "type": "transcription",
  "data": {
    "requestId": "2e7c3e61-7a23-4a8f-8a7f-8c9a4b4f8a11",
    "text": "Здравствуйте, чем могу помочь?"
  }
}
```

Точный набор полей внутри `data` приходит от сервиса распознавания. Для клиента
важно, что это текстовое событие с типом `transcription`.

### Аудио

Аудио приходит не JSON-сообщением, а бинарным WebSocket-сообщением.

Основные поля:

| Поле | Что значит |
| --- | --- |
| `request_id` | Идентификатор запроса в бинарном UUID-формате. |
| `call_id` | Идентификатор звонка в бинарном UUID-формате. |
| `source` | Источник аудио: `MODEL` или `USER`. |
| `audio` | Чанк аудио. |
| `seq_num` | Порядковый номер чанка. |

### Запрос на выполнение функции

Иногда gateway может отправить клиенту `functionCall`.

```json
{
  "type": "functionCall",
  "data": {
    "requestId": "2e7c3e61-7a23-4a8f-8a7f-8c9a4b4f8a11",
    "callId": "7b3d5f0a-7a6a-4d52-9a3e-8f5f8d8c8b30",
    "function": {
      "id": "54c4878e-e5be-4975-a672-2b7c6e032663",
      "name": "function_name"
    },
    "generatedAt": 1730000000000
  }
}
```

Если клиент выполнил функцию, он отправляет результат обратно:

```json
{
  "type": "functionResult",
  "data": {
    "callId": "7b3d5f0a-7a6a-4d52-9a3e-8f5f8d8c8b30",
    "functionCallId": "54c4878e-e5be-4975-a672-2b7c6e032663",
    "name": "function_name",
    "content": "Результат выполнения функции",
    "generatedAt": 1730000000000,
    "error": ""
  }
}
```

Если функция завершилась с ошибкой, заполните поле `error`.

## Как остановить звонок

Клиент может отправить `interrupt`:

```json
{
  "type": "interrupt",
  "data": {
    "calledAt": 1730000000000
  }
}
```

`calledAt` - время отправки команды в миллисекундах Unix time.

## Ошибки

Если gateway не понял сообщение или произошла внутренняя ошибка, он вернет:

```json
{
  "type": "error",
  "data": {
    "message": "Описание ошибки"
  }
}
```

Частые причины ошибок:

- неизвестный `type`;
- неверный формат JSON;
- отсутствуют обязательные поля в `data`;
- некорректный номер телефона.

## Минимальный пример на JavaScript

```js
const socket = new WebSocket("ws://localhost:8080/v1/ws/");

socket.onmessage = (event) => {
  if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
    console.log("Получили аудио");
    return;
  }

  const message = JSON.parse(event.data);
  console.log("Получили сообщение:", message);

  if (message.type === "ready") {
    socket.send(JSON.stringify({
      type: "initialRequest",
      data: {
        phoneNumber: "+79991234567",
        systemPrompt: "Позвони клиенту и уточни статус заявки.",
        retry: "0",
        voice: "Bik-Freespeech_8000"
      }
    }));
  }
};
```

## Порядок работы клиента

1. Открыть WebSocket-соединение.
2. Дождаться сообщения `ready`.
3. Отправить `initialRequest`.
4. Читать входящие `status`, `transcription`, `functionCall` и бинарное аудио.
5. При необходимости отправлять `functionResult` или `interrupt`.
6. Закрыть WebSocket-соединение после завершения работы.
