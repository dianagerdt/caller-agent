# Интеграция с GigaCaller Gateway

GigaCaller Gateway работает по WebSocket: агент создает задачу на звонок, получает статусы, транскрипцию, аудио и function call'ы, а затем возвращает результаты выполнения функций.

## Подключение

```text
GET /v1/ws/{requestId}
```

`requestId` опционален. Его можно передать для восстановления WebSocket-сессии после кратковременного разрыва.

После подключения gateway отправляет:

```json
{
  "type": "ready",
  "data": {
    "requestId": "11b4f2d5-75ce-42d5-bde6-555be1b2a7f9",
    "gigaCallerFunctions": []
  }
}
```

`requestId` нужно сохранить как идентификатор сессии.

Все текстовые сообщения имеют формат:

```json
{
  "type": "string",
  "data": {}
}
```

Время во всех сообщениях передается в миллисекундах.

## Запуск звонка

Агент отправляет `initialRequest`:

```json
{
  "type": "initialRequest",
  "data": {
    "voice": "Krn_8000",
    "systemPrompt": "string",
    "phoneNumber": "79990000000",
    "retry": "30, 30, 30",
    "asrModel": "universal_turbo",
    "gigachatModel": "GigaChat-2-Pro",
    "enableDenoiser": true,
    "agentFunctions": [],
    "debugMode": true,
    "gigavoiceMode": "RECOGNIZE_GIGACHAT_SYNTHESIS"
  }
}
```

`agentFunctions` - список функций, которые GigaCaller может вызвать на стороне агента.

## Проверка соединения

```json
{
  "type": "ping"
}
```

Ответ:

```json
{
  "type": "pong",
  "data": {
    "requestId": "11b4f2d575ce42d5bde6555be1b2a7f9"
  }
}
```

## Входящие сообщения от Gateway

### status

Статус звонка:

```json
{
  "type": "status",
  "data": {
    "requestId": "14652506-5a6b-47fe-8ef5-4ae5380460d1",
    "callId": "",
    "status": "published",
    "createdAt": 1764268800000
  }
}
```

Основные статусы:

```text
published
ringing
answered
completed
summarizing
noAnswer
failed
```

### transcription

Текстовая транскрипция:

```json
{
  "type": "transcription",
  "data": {
    "requestId": "7c7305f5-11c1-44b7-9dde-5fb76b033c7e",
    "callId": "14652506-5a6b-47fe-8ef5-4ae5380460d9",
    "source": "user",
    "seqNum": 1,
    "text": "Ресторан Ламбик Москва Сити, чем могу помочь?",
    "gvRecognizedAt": 1764268800,
    "gcReceivedAt": 1764268860000
  }
}
```

### functionCall

Вызов функции на стороне агента:

```json
{
  "type": "functionCall",
  "data": {
    "requestId": "8cbf5b76-e871-4fdb-85b1-b023fc87cb13",
    "callId": "40123f7b-8c93-4df4-a63f-eb243af7e011",
    "function": {
      "functionCallId": "ce3d8803-a1e6-4889-a6db-4b5299250c9d",
      "name": "gigacaller-get_current_datetime_with_timezone",
      "arguments": {
        "format": "full"
      },
      "source": "model"
    },
    "calledAt": 1769092822000,
    "gcReceivedAt": 1769092822896,
    "error": null
  }
}
```

### error

Ошибка gateway:

```json
{
  "type": "error",
  "data": {
    "message": "error description"
  }
}
```

## Аудио

Аудио приходит отдельными бинарными WebSocket-сообщениями в protobuf `AudioTrace`:

```proto
message AudioTrace {
  bytes request_id = 1;
  bytes call_id = 2;
  Source source = 3;
  bytes audio = 4;
  int64 gc_received_at = 5;
  int32 seq_num = 6;
}

enum Source {
  NA = 0;
  MODEL = 1;
  USER = 2;
}
```

`MODEL` - речь модели, `USER` - речь абонента.

## Ответ на function call

После выполнения функции агент отправляет `functionResult`:

```json
{
  "type": "functionResult",
  "data": {
    "requestId": "14652506-5a6b-47fe-8ef5-4ae5380460d1",
    "callId": "14652506-5a6b-47fe-8ef5-4ae5380460d2",
    "functionCallId": "14652506-5a6b-47fe-8ef5-4ae5380460d0",
    "name": "end_call",
    "content": "{\"key\":\"value\"}",
    "generatedAt": 1764268800000,
    "error": ""
  }
}
```

Если функция завершилась ошибкой, описание передается в `error`.

## Принудительное завершение звонка

```json
{
  "type": "interrupt",
  "data": {
    "calledAt": 1764268800000
  }
}
```

## Минимальный сценарий

1. Открыть WebSocket `/v1/ws/{requestId}`.
2. Дождаться `ready`, сохранить `requestId` и список `gigaCallerFunctions`.
3. Отправить `initialRequest`.
4. Обрабатывать `status`, `transcription`, `functionCall`, `error` и бинарный `AudioTrace`.
5. На `functionCall` отвечать `functionResult`.
6. Для ручного завершения звонка отправить `interrupt`.
