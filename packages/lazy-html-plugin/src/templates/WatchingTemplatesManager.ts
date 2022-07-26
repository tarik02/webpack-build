import { Template } from './Template';
import { TemplatesManager } from './TemplatesManager';

export class WatchingTemplatesManager implements TemplatesManager {
  protected readonly usedTemplates = new Map<string, {
    template: Template;
    subscribersCount: number;
  }>();

  constructor(
    protected readonly invalidate: () => void,
    protected readonly createTemplate: (name: string) => Template,
  ) {
  }

  used() {
    return [...this.usedTemplates.keys()];
  }

  emit(name: string, content: string) {
    if (!this.usedTemplates.has(name)) {
      return;
    }

    const { template } = this.usedTemplates.get(name)!;
    template.emit(content);
  }

  subscribe(name: string): [Template, () => void] {
    if (!this.usedTemplates.has(name)) {
      const template = this.createTemplate(name);

      this.usedTemplates.set(name, {
        template,
        subscribersCount: 0,
      });

      this.invalidate();
    }

    const container = this.usedTemplates.get(name)!;
    ++container.subscribersCount;

    let isSubscribed = true;
    const unsubscribe = () => {
      if (isSubscribed) {
        if (--container.subscribersCount === 0) {
          this.usedTemplates.delete(name);
        }
        isSubscribed = false;
      } else {
        throw new Error('This subscription is not active');
      }
    };

    return [container.template, unsubscribe];
  }
}
