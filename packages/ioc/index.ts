/**
 * @license
 * Copyright 2019 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ServiceFactory } from './src/container';
import { Container } from './src/container';
import { FirebaseApp } from '@firebase/app-types';

export const CONTAINER_KEY = Symbol('@firebase/ioc Container Key');

export function register(
  serviceName: string,
  serviceFactory: ServiceFactory
): void {
  if (Container.registrations[serviceName]) {
    throw Error('factory-already-exists');
  }

  /**
   * register the service in the global registration
   */
  Container.registrations[serviceName] = serviceFactory;

  /**
   * register the service with all containers
   */
  for (const instance of Container.instances) {
    instance.register(serviceName, serviceFactory);
  }
}

export function injector(app: FirebaseApp): Container {
  return app[CONTAINER_KEY];
}

export { Container } from './src/Container';
