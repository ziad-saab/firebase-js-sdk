/**
 * @license
 * Copyright 2017 Google LLC
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
import { Location } from './implementation/location';
import { FailRequest } from './implementation/failrequest';
import { Request, makeRequest } from './implementation/request';
import { RequestInfo } from './implementation/requestinfo';
import { XhrIoPool } from './implementation/xhriopool';
import { Reference, getChild } from './reference';
import { Provider } from '@firebase/component';
import { FirebaseAuthInternalName } from '@firebase/auth-interop-types';
import { FirebaseOptions } from '@firebase/app-types-exp';
import * as constants from '../src/implementation/constants';
import {
  invalidArgument,
  appDeleted,
  noDefaultBucket
} from './implementation/error';

export function isUrl(path?: string): boolean {
  return /^[A-Za-z]+:\/\//.test(path as string);
}

/**
 * Returns a firebaseStorage.Reference for the given url.
 */
function refFromURL(service: StorageService, url: string): Reference {
  return new Reference(service, url);
}

/**
 * Returns a firebaseStorage.Reference for the given path in the default
 * bucket.
 */
function refFromPath(
  ref: StorageService | Reference,
  path?: string
): Reference | null {
  if (ref instanceof StorageService) {
    const service = ref;
    if (service._bucket == null) {
      throw noDefaultBucket();
    }
    const reference = new Reference(service, service._bucket!);
    if (path != null) {
      return refFromPath(reference, path);
    } else {
      return reference;
    }
  } else {
    // ref is a Reference
    if (typeof path === 'string') {
      if (path.includes('..')) {
        throw invalidArgument('`path` param cannot contain ".."');
      }
      return getChild(ref, path);
    } else {
      return ref;
    }
  }
}

export function ref(storage: StorageService, url?: string): Reference;
export function ref(
  storageOrRef: StorageService | Reference,
  path?: string
): Reference;
/**
 * Returns a storage Reference for the given url, or given path in the
 * default bucket.
 * @param serviceOrRef - `Storage` instance or storage `Reference`.
 * @param pathOrUrlStorage - path, or URL. If empty, returns root reference (if Storage
 * instance provided) or returns same reference (if Reference provided).
 */
export function ref(
  serviceOrRef: StorageService | Reference,
  pathOrUrl?: string
): Reference | null {
  if (pathOrUrl && isUrl(pathOrUrl)) {
    if (serviceOrRef instanceof StorageService) {
      return refFromURL(serviceOrRef, pathOrUrl);
    } else {
      throw invalidArgument(
        'To use ref(service, url), the first argument must be a Storage instance.'
      );
    }
  } else if (pathOrUrl !== null) {
    if (
      serviceOrRef instanceof StorageService ||
      serviceOrRef instanceof Reference
    ) {
      return refFromPath(serviceOrRef, pathOrUrl);
    } else {
      throw invalidArgument(
        'To use ref(serviceOrRef, path), the first argument must be a Storage' +
          ' instance or Reference.'
      );
    }
  } else {
    // pathOrUrl param not provided
    if (serviceOrRef instanceof StorageService) {
      return refFromPath(serviceOrRef);
    } else {
      throw invalidArgument(
        'To get the root reference, a Storage instance must be provided as' +
          ' the param. Example: ref(storageInstance);'
      );
    }
  }
}

/**
 * A service that provides Firebase Storage Reference instances.
 * @param opt_url gs:// url to a custom Storage Bucket
 */
export class StorageService {
  /**
   * @internal
   */
  readonly _bucket: Location | null = null;
  protected readonly _appId: string | null = null;
  private readonly _requests: Set<Request<unknown>>;
  /**
   * @internal
   */
  private _deleted: boolean = false;
  maxOperationRetryTime: number;
  maxUploadRetryTime: number;

  constructor(
    readonly app: FirebaseApp,
    readonly authProvider_: Provider<FirebaseAuthInternalName>,
    readonly pool_: XhrIoPool,
    readonly url_?: string
  ) {
    this.maxOperationRetryTime = constants.DEFAULT_MAX_OPERATION_RETRY_TIME;
    this.maxUploadRetryTime = constants.DEFAULT_MAX_UPLOAD_RETRY_TIME;
    this._requests = new Set();
    if (url_ != null) {
      this._bucket = Location.makeFromBucketSpec(url_);
    } else {
      this._bucket = StorageService.extractBucket_(this.app.options);
    }
  }

  private static extractBucket_(config?: FirebaseOptions): Location | null {
    const bucketString = config?.[constants.CONFIG_STORAGE_BUCKET_KEY];
    if (bucketString == null) {
      return null;
    }
    return Location.makeFromBucketSpec(bucketString);
  }

  async getAuthToken(): Promise<string | null> {
    const auth = this.authProvider_.getImmediate({ optional: true });
    if (auth) {
      const tokenData = await auth.getToken();
      if (tokenData !== null) {
        return tokenData.accessToken;
      }
    }
    return null;
  }

  /**
   * Stop running requests and prevent more from being created.
   * @internal
   */
  deleteApp(): void {
    this._deleted = true;
    this._requests.forEach(request => request.cancel());
    this._requests.clear();
  }

  /**
   * Returns a new firebaseStorage.Reference object referencing this StorageService
   * at the given Location.
   * @internal
   * @param loc - The Location.
   * @return A firebaseStorage.Reference.
   */
  makeStorageReference(loc: Location): Reference {
    return new Reference(this, loc);
  }

  /**
   * @internal
   * @param requestInfo
   * @param authToken
   */
  makeRequest<T>(
    requestInfo: RequestInfo<T>,
    authToken: string | null
  ): Request<T> {
    if (!this._deleted) {
      const request = makeRequest(
        requestInfo,
        this._appId,
        authToken,
        this.pool_
      );
      this._requests.add(request);
      // Request removes itself from set when complete.
      request.getPromise().then(
        () => this._requests.delete(request),
        () => this._requests.delete(request)
      );
      return request;
    } else {
      return new FailRequest(appDeleted());
    }
  }
}
