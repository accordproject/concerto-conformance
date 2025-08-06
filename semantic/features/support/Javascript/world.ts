import { setWorldConstructor, IWorldOptions } from '@cucumber/cucumber';
import { loadDependencies } from './utils/dynamicLoader.ts';

export class CustomWorld {
  public modelManager: any;
  public error: Error | null;

  constructor(options: IWorldOptions) {
    this.error = null;
  }

  async initialize() {
    const deps = await loadDependencies();
    const ModelManager = deps.ModelManager;
    this.modelManager = new ModelManager({ strict: true, importAliasing: true, enableMapType: true });
  }
}

setWorldConstructor(CustomWorld);
