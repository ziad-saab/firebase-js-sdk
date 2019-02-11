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
