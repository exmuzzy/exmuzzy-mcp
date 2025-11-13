import { Issue } from '../types/index.js';
import { Logger } from './logger.js';

export class ResolutionGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ResolutionGenerator');
  }

  /**
   * Генерирует резолюцию для issue на основе его содержимого
   * В будущем можно заменить на реальную генерацию через LLM API
   */
  async generateResolution(issue: Issue): Promise<string> {
    this.logger.debug(`Generating resolution for issue: ${issue.key}`);

    const summary = issue.fields.summary;
    const description = typeof issue.fields.description === 'string' 
      ? issue.fields.description 
      : '';
    const issueType = issue.fields.issuetype.name;
    const status = issue.fields.status.name;
    const assignee = issue.fields.assignee?.displayName || 'не назначен';
    const components = issue.fields.components.map(c => c.name).join(', ');
    const labels = issue.fields.labels.join(', ');

    // Анализируем содержимое issue для генерации резолюции
    let resolution = '';

    // Базовый шаблон резолюции
    if (issueType === 'Ошибка' || issueType === 'Bug') {
      resolution = `Ошибка исправлена. ${summary}`;
      if (description) {
        const shortDesc = description.length > 100 ? description.substring(0, 100) + '...' : description;
        resolution += ` Проблема: ${shortDesc}`;
      }
    } else if (issueType === 'Задача' || issueType === 'Task') {
      resolution = `Задача выполнена: ${summary}`;
      if (components) {
        resolution += ` Компоненты: ${components}`;
      }
    } else if (issueType === 'История' || issueType === 'Story') {
      resolution = `История реализована: ${summary}`;
      if (components) {
        resolution += ` Затронутые компоненты: ${components}`;
      }
    } else if (issueType === 'Улучшение' || issueType === 'Improvement') {
      resolution = `Улучшение внедрено: ${summary}`;
    } else if (issueType === 'Новая функциональность' || issueType === 'Feature') {
      resolution = `Функциональность реализована: ${summary}`;
      if (components) {
        resolution += ` Компоненты: ${components}`;
      }
    } else {
      // Общий шаблон для других типов
      resolution = `Задача завершена: ${summary}`;
      if (description) {
        const shortDesc = description.length > 80 ? description.substring(0, 80) + '...' : description;
        resolution += ` ${shortDesc}`;
      }
    }

    // Добавляем информацию о статусе, если был переход из определенного статуса
    if (status === 'Тестирование в процессе' || status === 'For test') {
      resolution += ' Протестировано и готово к использованию.';
    } else if (status === 'Under Review') {
      resolution += ' Проверено и одобрено.';
    } else if (status === 'Blocked') {
      resolution += ' Блокировка снята, задача завершена.';
    } else if (status === 'On hold') {
      resolution += ' Работа возобновлена и завершена.';
    }

    // Ограничиваем длину резолюции
    if (resolution.length > 500) {
      resolution = resolution.substring(0, 497) + '...';
    }

    this.logger.debug(`Generated resolution: ${resolution}`);
    return resolution;
  }

  /**
   * Получает доступные резолюции из Jira
   * В Jira обычно есть стандартные резолюции: "Fixed", "Won't Fix", "Duplicate", "Incomplete", "Cannot Reproduce"
   */
  getDefaultResolution(): string {
    // Возвращаем стандартную резолюцию "Fixed" или "Исправлено"
    // В реальном сценарии нужно получать это из Jira API
    return 'Fixed';
  }
}

