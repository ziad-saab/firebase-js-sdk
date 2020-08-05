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
import { UploadTaskSnapshot } from '../src/tasksnapshot';
import {
  taskStateFromInternalTaskState,
  TaskEvent
} from '../src/implementation/taskenums';
import { ReferenceCompat } from './reference';
import { FbsBlob } from '../src/implementation/blob';
import { Metadata } from '../src/metadata';
import { ErrorFn, CompleteFn, Unsubscribe, Subscribe } from '@firebase/util';
import * as types from '@firebase/storage-types';
import { StorageObserver } from '../src/implementation/observer';

export class UploadTaskCompat extends UploadTask<UploadTaskSnapshotCompat>
  implements types.UploadTask {
  constructor(
    private refCompat_: ReferenceCompat,
    blob: FbsBlob,
    metadata: Metadata | null = null
  ) {
    super(refCompat_, blob, metadata);
  }
  get snapshot(): UploadTaskSnapshotCompat {
    const externalState = taskStateFromInternalTaskState(this.state_);
    return new UploadTaskSnapshotCompat(
      this.transferred_,
      this.blob_.size(),
      externalState,
      this.metadata_,
      this,
      this.refCompat_
    );
  }
  on(
    type: TaskEvent,
    nextOrObserver?:
      | Partial<StorageObserver<UploadTaskSnapshotCompat>>
      | null
      | ((a: UploadTaskSnapshotCompat) => unknown),
    error?: ErrorFn | null,
    completed?: CompleteFn | null
  ): Unsubscribe | Subscribe<UploadTaskSnapshotCompat> {
    const castNextOrObserver = nextOrObserver as
      | Partial<StorageObserver<UploadTaskSnapshot>>
      | null
      | ((a: UploadTaskSnapshot) => unknown);
    return super.on(type, castNextOrObserver, error, completed) as
      | Unsubscribe
      | Subscribe<types.UploadTaskSnapshot>;
  }
}
