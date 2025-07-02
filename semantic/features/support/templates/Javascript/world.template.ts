{{MODELMANAGER_IMPORT}}

import { setWorldConstructor, IWorldOptions } from '@cucumber/cucumber';

export class CustomWorld {
  public modelManager: ModelManager;
  public error: Error | null;

  constructor(options: IWorldOptions) {
    this.modelManager = new ModelManager({ enableMapType: true });
    this.error = null;
  }
}

setWorldConstructor(CustomWorld);
