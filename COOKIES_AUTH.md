# Авторизация через Cookies из браузера

Если Bearer token или API token не работают для доступа к Structure API, вы можете использовать cookies из браузера после ручной авторизации.

## Как получить cookies из браузера

### Chrome / Edge / Brave

1. Откройте ваш Jira в браузере и авторизуйтесь
2. Нажмите `F12` или `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows) для открытия DevTools
3. Перейдите на вкладку **Application** (Chrome) или **Storage** (Edge)
4. В левой панели выберите **Cookies** → ваш домен Jira (например, `job.sbertroika.ru`)
5. Найдите следующие cookies:
   - `JSESSIONID` - основная сессия
   - `atlassian.xsrf.token` - токен безопасности
6. Скопируйте значения в формате: `JSESSIONID=значение; atlassian.xsrf.token=значение`

**Пример:**
```
JSESSIONID=ABC123DEF456; atlassian.xsrf.token=BYRJ-VNBY-G0WF-BSNC_abc123def456
```

### Firefox

1. Откройте ваш Jira в браузере и авторизуйтесь
2. Нажмите `F12` для открытия DevTools
3. Перейдите на вкладку **Storage**
4. В левой панели выберите **Cookies** → ваш домен Jira
5. Найдите `JSESSIONID` и `atlassian.xsrf.token`
6. Скопируйте значения в том же формате

### Safari

1. Включите меню разработчика: Safari → Настройки → Дополнения → Показать меню "Разработка"
2. Откройте ваш Jira и авторизуйтесь
3. Нажмите `Cmd+Option+I` для открытия Web Inspector
4. Перейдите на вкладку **Storage** → **Cookies**
5. Найдите нужные cookies и скопируйте их значения

## Использование cookies

### Вариант 1: Через переменную окружения

Добавьте в ваш `.env` файл:

```bash
JIRA_BASE_URL=https://job.sbertroika.ru
JIRA_SESSION_COOKIES=JSESSIONID=ABC123DEF456; atlassian.xsrf.token=BYRJ-VNBY-G0WF-BSNC_abc123def456
```

### Вариант 2: Через экспорт в терминале

```bash
export JIRA_BASE_URL=https://job.sbertroika.ru
export JIRA_SESSION_COOKIES="JSESSIONID=ABC123DEF456; atlassian.xsrf.token=BYRJ-VNBY-G0WF-BSNC_abc123def456"
```

## Важные замечания

1. **Безопасность**: Cookies содержат вашу активную сессию. Не делитесь ими и не коммитьте в git!

2. **Срок действия**: Cookies имеют срок действия (обычно несколько часов). Если они перестанут работать, получите новые из браузера.

3. **Формат**: Cookies должны быть в формате `name=value; name2=value2` с точкой с запятой и пробелом между парами.

4. **Приоритет**: Если установлен `JIRA_SESSION_COOKIES`, он будет использован вместо автоматической инициализации сессии.

## Проверка работы

После установки cookies, запустите тест:

```bash
node test-tree-endpoint.js
```

Если все работает, вы увидите данные структуры вместо пустого результата.

## Альтернативные методы авторизации

Если cookies не работают, попробуйте:

1. **Bearer Token** - если ваш Jira поддерживает OAuth
2. **API Token** - стандартный метод через `JIRA_EMAIL` и `JIRA_API_TOKEN`

## Устранение проблем

### Cookies не работают

- Убедитесь, что вы авторизованы в браузере
- Проверьте формат cookies (должны быть через `; ` с пробелом)
- Убедитесь, что cookies не истекли (получите новые)

### Ошибка "Missing required environment variables"

- Убедитесь, что установлен `JIRA_BASE_URL`
- Проверьте, что `JIRA_SESSION_COOKIES` содержит правильные значения

### Редирект на страницу логина

- Cookies могли истечь - получите новые из браузера
- Убедитесь, что вы используете правильный домен в `JIRA_BASE_URL`




