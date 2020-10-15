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

import { UploadTask } from '../src/task';
import { UploadTaskSnapshotCompat } from './tasksnapshot';
import { TaskEvent } from '../src/implementation/taskenums';
import * as types from '@firebase/storage-types';
import {
  StorageObserver,
  ErrorFn,
  CompleteFn,
  Subscribe,
  Unsubscribe
} from '../src/implementation/observer';
import { UploadTaskSnapshot } from '../src/tasksnapshot';
import { ReferenceCompat } from './reference';
import { FirebaseStorageError } from '../src/implementation/error';

export class UploadTaskCompat implements types.UploadTask {
  constructor(
    private readonly _delegate: UploadTask,
    private readonly _ref: ReferenceCompat
  ) {}

  snapshot = new UploadTaskSnapshotCompat(
    this._delegate.snapshot,
    this,
    this._ref
  );

  cancel = this._delegate.cancel.bind(this._delegate);
  catch = this._delegate.catch.bind(this._delegate);
  pause = this._delegate.pause.bind(this._delegate);
  resume = this._delegate.resume.bind(this._delegate);

  then(
    onFulfilled?: ((a: UploadTaskSnapshotCompat) => unknown) | null,
    onRejected?: ((a: FirebaseStorageError) => unknown) | null
  ): Promise<unknown> {
    return this._delegate.then(snapshot => {
      if (onFulfilled) {
        return onFulfilled(
          new UploadTaskSnapshotCompat(snapshot, this, this._ref)
        );
      }
    }, onRejected);
  }

  on(
    type: TaskEvent,
    nextOrObserver?:
      | types.StorageObserver<UploadTaskSnapshotCompat>
      | null
      | ((a: UploadTaskSnapshotCompat) => unknown),
    error?: ErrorFn | null,
    completed?: CompleteFn | null
  ): Unsubscribe | Subscribe<UploadTaskSnapshotCompat> {
    // TODO: Wrap all returned values in new snapshot
    return this._delegate.on(
      type,
      (nextOrObserver || undefined) as StorageObserver<UploadTaskSnapshot>,
      error || undefined,
      completed || undefined
    );
  }
}
