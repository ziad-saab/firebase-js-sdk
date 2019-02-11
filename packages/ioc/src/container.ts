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

import { FirebaseApp } from '@firebase/app-types';
import { Deferred } from '@firebase/util';

export interface ServiceFactory<T = any> {
  (app: FirebaseApp, instanceName?: string): T;
}

export interface GetOptions {
  instanceName: string;
}

const DEFAULT_SERVICE_INSTANCE_NAME = '[DEFAULT]';

// service factroy registration
const registrations: { [name: string]: ServiceFactory } = {};

// all container instances
const containerInstances = [];

export class Container {
  static get instances(): Container[] {
    return containerInstances;
  }

  static get registrations(): { [name: string]: ServiceFactory } {
    return registrations;
  }

  private _factories: { [name: string]: ServiceFactory } = {};
  private _pendingRegistration: { [name: string]: Deferred<any> } = {};

  /**
   * service instance
   */
  private _serviceInstanceCache: {
    [serviceName: string]: {
      [instanceName: string]: any;
    };
  } = {};

  constructor(private _app: FirebaseApp) {
    containerInstances.push(this);

    // register existing service factories on this container
    Object.keys(Container.registrations).forEach(key => {
      this.register(key, Container.registrations[key]);
    });
  }

  register(name: string, serviceFactory: ServiceFactory): void {
    if (typeof serviceFactory !== 'function') {
      throw Error('invalid-factory');
    }

    if (this._factories[name]) {
      throw Error('factory-already-exists');
    }

    this._factories[name] = serviceFactory;

    // resolve any pending registration
    if (this._pendingRegistration[name]) {
      this._pendingRegistration[name].resolve(serviceFactory);
      delete this._pendingRegistration[name];
    }
  }

  async get<T = any>(serviceName: string, options: GetOptions): Promise<T> {
    const instanceName = options.instanceName || DEFAULT_SERVICE_INSTANCE_NAME;

    const cachedInstance = this._getFromCache(serviceName, instanceName);
    if (cachedInstance) {
      return cachedInstance;
    }

    const factory = await this._getFactory(serviceName);
    const serviceInstance = factory(this._app, instanceName);

    if (!this._serviceInstanceCache[serviceName]) {
      this._serviceInstanceCache[serviceName] = {};
    }

    this._serviceInstanceCache[serviceName][instanceName] = serviceInstance;
    return serviceInstance;
  }

  getImmediate<T = any>(serviceName: string, options: GetOptions): T {
    const instanceName = options.instanceName || DEFAULT_SERVICE_INSTANCE_NAME;

    const cachedInstance = this._getFromCache(serviceName, instanceName);
    if (cachedInstance) {
      return cachedInstance;
    }

    if (
      this._serviceInstanceCache[serviceName] &&
      this._serviceInstanceCache[serviceName][instanceName]
    ) {
      return this._serviceInstanceCache[serviceName][instanceName];
    }

    // get factory synchronously without waiting for lazily loaded services
    const factory = this._factories[serviceName];
    const serviceInstance = factory(this._app, instanceName);

    if (!this._serviceInstanceCache[serviceName]) {
      this._serviceInstanceCache[serviceName] = {};
    }

    this._serviceInstanceCache[serviceName][instanceName] = serviceInstance;
    return serviceInstance;
  }

  private _getFromCache(serviceName: string, instanceName: string): any {
    if (
      this._serviceInstanceCache[serviceName] &&
      this._serviceInstanceCache[serviceName][instanceName]
    ) {
      return this._serviceInstanceCache[serviceName][instanceName];
    }
  }

  /**
   * The factory can either be pre-registered or lazily loaded, we handle them
   * both the same way by getting it asynchronously
   */
  private async _getFactory(name: string): Promise<ServiceFactory> {
    if (this._factories[name]) {
      return this._factories[name];
    }

    if (this._pendingRegistration[name]) {
      return this._pendingRegistration[name].promise;
    }

    const deferred = new Deferred<ServiceFactory>();
    this._pendingRegistration[name] = deferred;

    return deferred.promise;
  }
}
