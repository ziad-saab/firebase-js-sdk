/**
 * @license
 * Copyright 2020 Google LLC
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

import * as types from '@firebase/storage-types';
import { StorageService, isUrl, ref } from '../src/service';
import { Location } from '../src/implementation/location';
import * as args from '../src/implementation/args';
import { ReferenceCompat } from './reference';
import { Reference } from '../src/reference';

export function urlValidator(maybeUrl: unknown): void {
  if (typeof maybeUrl !== 'string') {
    throw 'Path is not a string.';
  }
  if (!isUrl) {
    throw 'Expected full URL but got a child path, use ref instead.';
  }
  try {
    Location.makeFromUrl(maybeUrl as string);
  } catch (e) {
    throw 'Expected valid full URL but got an invalid one.';
  }
}

export function pathValidator(path: unknown): void {
  if (typeof path !== 'string') {
    throw 'Path is not a string.';
  }
  if (isUrl(path)) {
    throw 'Expected child path but got a URL, use refFromURL instead.';
  }
}

/**
 * A service that provides firebaseStorage.Reference instances.
 * @param opt_url gs:// url to a custom Storage Bucket
 *
 * @struct
 */
export class StorageServiceCompat implements types.FirebaseStorage {
  constructor(
    readonly delegate: StorageService,
    private converter: (ref: Reference) => ReferenceCompat
  ) {}

  app = this.delegate.app;
  maxOperationRetryTime = this.delegate.maxOperationRetryTime;
  maxUploadRetryTime = this.delegate.maxUploadRetryTime;

  /**
   * Returns a firebaseStorage.Reference for the given path in the default
   * bucket.
   */
  ref(path?: string): types.Reference {
    args.validate('ref', [args.stringSpec(pathValidator, true)], arguments);
    return this.converter(ref(this.delegate, path));
  }

  /**
   * Returns a firebaseStorage.Reference object for the given absolute URL,
   * which must be a gs:// or http[s]:// URL.
   */
  refFromURL(url: string): types.Reference {
    args.validate(
      'refFromURL',
      [args.stringSpec(urlValidator, false)],
      arguments
    );
    return this.converter(ref(this.delegate, url)) as types.Reference;
  }

  setMaxUploadRetryTime(time: number): void {
    args.validate(
      'setMaxUploadRetryTime',
      [args.nonNegativeNumberSpec()],
      arguments
    );
    this.delegate.maxUploadRetryTime = time;
  }

  setMaxOperationRetryTime(time: number): void {
    args.validate(
      'setMaxOperationRetryTime',
      [args.nonNegativeNumberSpec()],
      arguments
    );
    this.delegate.maxOperationRetryTime = time;
  }
}

/**
 * @struct
 */
export class ServiceInternals {
  service_: StorageService;

  constructor(service: StorageService) {
    this.service_ = service;
  }

  /**
   * Called when the associated app is deleted.
   */
  delete(): Promise<void> {
    this.service_.deleteApp();
    return Promise.resolve();
  }
}
