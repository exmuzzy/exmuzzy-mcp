# Адреса для Swagger/OpenAPI документации в Jira

## ❌ Результат проверки

**Важно:** Jira Server **НЕ предоставляет** встроенную Swagger/OpenAPI документацию в формате JSON/YAML.

Все проверенные endpoints возвращают **HTML** вместо JSON:
- `/rest/api/3/swagger.json` → HTML
- `/rest/api/3/openapi.json` → HTML
- `/rest/api/2/swagger.json` → 404
- `/rest/api/2/openapi.json` → 404
- И другие варианты → все возвращают HTML или 404

## ✅ Альтернативные источники документации

### 1. REST API Browser (Рекомендуется)

**Адрес:** `https://job.sbertroika.ru/plugins/servlet/restbrowser`

**Описание:**
- HTML интерфейс для интерактивного просмотра API
- Позволяет тестировать endpoints напрямую
- Показывает доступные методы и параметры
- **Используйте это для поиска правильных Structure API endpoints**

### 2. Официальная документация Atlassian

**Jira REST API v3:**
- URL: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- Формат: HTML документация
- Примечание: Для Jira Cloud, но многие endpoints работают и в Server

**Jira REST API v2:**
- URL: https://developer.atlassian.com/cloud/jira/platform/rest/v2/
- Формат: HTML документация
- Примечание: Используется в текущем проекте

### 3. Документация плагина Structure

**Официальная документация:**
- URL: https://docs.almworks.com/structure/latest/rest-api.html
- Формат: HTML документация
- Описание: REST API для плагина Jira Structure

**Основные endpoints (из документации):**
```
GET /rest/structure/latest/structure              # Список структур ✅ Работает
GET /rest/structure/latest/structure/{id}         # Детали структуры ✅ Работает
GET /rest/structure/latest/structure/{id}/element  # Элементы ❌ 404
```

## 🔍 Почему нет Swagger/OpenAPI?

1. **Jira Server** не включает встроенную Swagger/OpenAPI документацию
2. Документация предоставляется через **HTML интерфейсы** и **онлайн ресурсы**
3. Для некоторых плагинов может быть своя документация, но не в Swagger формате

## 💡 Рекомендации для поиска правильных Structure API endpoints

### Вариант 1: Использовать REST API Browser

1. Откройте: `https://job.sbertroika.ru/plugins/servlet/restbrowser`
2. Найдите раздел Structure API
3. Проверьте доступные endpoints для элементов и иерархии
4. Протестируйте различные варианты endpoints

### Вариант 2: Проверить документацию плагина

1. Узнайте точную версию установленного плагина Structure
2. Найдите соответствующую документацию на https://docs.almworks.com/
3. Проверьте правильные endpoints для этой версии

### Вариант 3: Проверить через curl

```bash
# Попробуйте разные варианты endpoints
curl -H "Authorization: Bearer TOKEN" \
     https://job.sbertroika.ru/rest/structure/latest/structure/138/elements

curl -H "Authorization: Bearer TOKEN" \
     https://job.sbertroika.ru/rest/structure/latest/structure/138/tree

curl -H "Authorization: Bearer TOKEN" \
     https://job.sbertroika.ru/rest/structure/1.0/structure/138/element
```

## 📊 Итог

**Вопрос:** По какому адресу Swagger описание у Jira?

**Ответ:** 
- ❌ **Нет встроенного Swagger/OpenAPI** в формате JSON/YAML
- ✅ **REST API Browser:** `https://job.sbertroika.ru/plugins/servlet/restbrowser`
- ✅ **Официальная документация:** https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- ✅ **Structure API документация:** https://docs.almworks.com/structure/latest/rest-api.html

**Рекомендация:** Используйте **REST API Browser** для интерактивного поиска правильных endpoints для Structure API.





