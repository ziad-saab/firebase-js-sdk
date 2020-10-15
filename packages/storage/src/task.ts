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
/**
 * @fileoverview Defines types for interacting with blob transfer tasks.
 */

import { FbsBlob } from './implementation/blob';
import { FirebaseStorageError, Code, canceled } from './implementation/error';
import {
  InternalTaskState,
  TaskEvent,
  TaskState,
  taskStateFromInternalTaskState
} from './implementation/taskenums';
import { Metadata } from './metadata';
import {
  CompleteFn,
  ErrorFn,
  NextFn,
  Observer,
  StorageObserver,
  Subscribe,
  Unsubscribe
} from './implementation/observer';
import { Request } from './implementation/request';
import { UploadTaskSnapshot } from './tasksnapshot';
import { async as fbsAsync } from './implementation/async';
import * as fbsMetadata from './implementation/metadata';
import * as fbsRequests from './implementation/requests';
import { Reference } from './reference';
import { getMappings } from './implementation/metadata';

/**
 * Represents a blob being uploaded. Can be used to pause/resume/cancel the
 * upload and manage callbacks for various events.
 */
export class UploadTask {
  private _ref: Reference;
  /**
   * @internal
   */
  _blob: FbsBlob;
  /**
   * @internal
   */
  _metadata: Metadata | null;
  private _mappings: fbsMetadata.Mappings;
  /**
   * @internal
   */
  _transferred: number = 0;
  private _needToFetchStatus: boolean = false;
  private _needToFetchMetadata: boolean = false;
  private _observers: Array<StorageObserver<UploadTaskSnapshot>> = [];
  private _resumable: boolean;
  /**
   * @internal
   */
  _state: InternalTaskState;
  private _error: FirebaseStorageError | null = null;
  private _uploadUrl: string | null = null;
  private _request: Request<unknown> | null = null;
  private _chunkMultiplier: number = 1;
  private _errorHandler: (p1: FirebaseStorageError) => void;
  private _metadataErrorHandler: (p1: FirebaseStorageError) => void;
  private _resolve: ((p1: UploadTaskSnapshot) => void) | null = null;
  private _reject: ((p1: FirebaseStorageError) => void) | null = null;
  private _promise: Promise<UploadTaskSnapshot>;

  /**
   * @param ref The firebaseStorage.Reference object this task came
   *     from, untyped to avoid cyclic dependencies.
   * @param blob The blob to upload.
   */
  constructor(ref: Reference, blob: FbsBlob, metadata: Metadata | null = null) {
    this._ref = ref;
    this._blob = blob;
    this._metadata = metadata;
    this._mappings = getMappings();
    this._resumable = this._shouldDoResumable(this._blob);
    this._state = InternalTaskState.RUNNING;
    this._errorHandler = error => {
      this._request = null;
      this._chunkMultiplier = 1;
      if (error.codeEquals(Code.CANCELED)) {
        this._needToFetchStatus = true;
        this.completeTransitions_();
      } else {
        this._error = error;
        this._transition(InternalTaskState.ERROR);
      }
    };
    this._metadataErrorHandler = error => {
      this._request = null;
      if (error.codeEquals(Code.CANCELED)) {
        this.completeTransitions_();
      } else {
        this._error = error;
        this._transition(InternalTaskState.ERROR);
      }
    };
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
      this._start();
    });

    // Prevent uncaught rejections on the internal promise from bubbling out
    // to the top level with a dummy handler.
    this._promise.then(null, () => {});
  }

  private _makeProgressCallback(): (p1: number, p2: number) => void {
    const sizeBefore = this._transferred;
    return loaded => this._updateProgress(sizeBefore + loaded);
  }

  private _shouldDoResumable(blob: FbsBlob): boolean {
    return blob.size() > 256 * 1024;
  }

  private _start(): void {
    if (this._state !== InternalTaskState.RUNNING) {
      // This can happen if someone pauses us in a resume callback, for example.
      return;
    }
    if (this._request !== null) {
      return;
    }
    if (this._resumable) {
      if (this._uploadUrl === null) {
        this._createResumable();
      } else {
        if (this._needToFetchStatus) {
          this._fetchStatus();
        } else {
          if (this._needToFetchMetadata) {
            // Happens if we miss the metadata on upload completion.
            this._fetchMetadata();
          } else {
            this._continueUpload();
          }
        }
      }
    } else {
      this._oneShotUpload();
    }
  }

  private _resolveToken(callback: (p1: string | null) => void): void {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this._ref.service.getAuthToken().then(authToken => {
      switch (this._state) {
        case InternalTaskState.RUNNING:
          callback(authToken);
          break;
        case InternalTaskState.CANCELING:
          this._transition(InternalTaskState.CANCELED);
          break;
        case InternalTaskState.PAUSING:
          this._transition(InternalTaskState.PAUSED);
          break;
        default:
      }
    });
  }

  // TODO(andysoto): assert false

  private _createResumable(): void {
    this._resolveToken(authToken => {
      const requestInfo = fbsRequests.createResumableUpload(
        this._ref.service,
        this._ref.location,
        this._mappings,
        this._blob,
        this._metadata
      );
      const createRequest = this._ref.service.makeRequest(
        requestInfo,
        authToken
      );
      this._request = createRequest;
      createRequest.getPromise().then((url: string) => {
        this._request = null;
        this._uploadUrl = url;
        this._needToFetchStatus = false;
        this.completeTransitions_();
      }, this._errorHandler);
    });
  }

  private _fetchStatus(): void {
    // TODO(andysoto): assert(this.uploadUrl_ !== null);
    const url = this._uploadUrl as string;
    this._resolveToken(authToken => {
      const requestInfo = fbsRequests.getResumableUploadStatus(
        this._ref.service,
        this._ref.location,
        url,
        this._blob
      );
      const statusRequest = this._ref.service.makeRequest(
        requestInfo,
        authToken
      );
      this._request = statusRequest;
      statusRequest.getPromise().then(status => {
        status = status as fbsRequests.ResumableUploadStatus;
        this._request = null;
        this._updateProgress(status.current);
        this._needToFetchStatus = false;
        if (status.finalized) {
          this._needToFetchMetadata = true;
        }
        this.completeTransitions_();
      }, this._errorHandler);
    });
  }

  private _continueUpload(): void {
    const chunkSize =
      fbsRequests.resumableUploadChunkSize * this._chunkMultiplier;
    const status = new fbsRequests.ResumableUploadStatus(
      this._transferred,
      this._blob.size()
    );

    // TODO(andysoto): assert(this.uploadUrl_ !== null);
    const url = this._uploadUrl as string;
    this._resolveToken(authToken => {
      let requestInfo;
      try {
        requestInfo = fbsRequests.continueResumableUpload(
          this._ref.location,
          this._ref.service,
          url,
          this._blob,
          chunkSize,
          this._mappings,
          status,
          this._makeProgressCallback()
        );
      } catch (e) {
        this._error = e;
        this._transition(InternalTaskState.ERROR);
        return;
      }
      const uploadRequest = this._ref.service.makeRequest(
        requestInfo,
        authToken
      );
      this._request = uploadRequest;
      uploadRequest
        .getPromise()
        .then((newStatus: fbsRequests.ResumableUploadStatus) => {
          this._increaseMultiplier();
          this._request = null;
          this._updateProgress(newStatus.current);
          if (newStatus.finalized) {
            this._metadata = newStatus.metadata;
            this._transition(InternalTaskState.SUCCESS);
          } else {
            this.completeTransitions_();
          }
        }, this._errorHandler);
    });
  }

  private _increaseMultiplier(): void {
    const currentSize =
      fbsRequests.resumableUploadChunkSize * this._chunkMultiplier;

    // Max chunk size is 32M.
    if (currentSize < 32 * 1024 * 1024) {
      this._chunkMultiplier *= 2;
    }
  }

  private _fetchMetadata(): void {
    this._resolveToken(authToken => {
      const requestInfo = fbsRequests.getMetadata(
        this._ref.service,
        this._ref.location,
        this._mappings
      );
      const metadataRequest = this._ref.service.makeRequest(
        requestInfo,
        authToken
      );
      this._request = metadataRequest;
      metadataRequest.getPromise().then(metadata => {
        this._request = null;
        this._metadata = metadata;
        this._transition(InternalTaskState.SUCCESS);
      }, this._metadataErrorHandler);
    });
  }

  private _oneShotUpload(): void {
    this._resolveToken(authToken => {
      const requestInfo = fbsRequests.multipartUpload(
        this._ref.service,
        this._ref.location,
        this._mappings,
        this._blob,
        this._metadata
      );
      const multipartRequest = this._ref.service.makeRequest(
        requestInfo,
        authToken
      );
      this._request = multipartRequest;
      multipartRequest.getPromise().then(metadata => {
        this._request = null;
        this._metadata = metadata;
        this._updateProgress(this._blob.size());
        this._transition(InternalTaskState.SUCCESS);
      }, this._errorHandler);
    });
  }

  private _updateProgress(transferred: number): void {
    const old = this._transferred;
    this._transferred = transferred;

    // A progress update can make the "transferred" value smaller (e.g. a
    // partial upload not completed by server, after which the "transferred"
    // value may reset to the value at the beginning of the request).
    if (this._transferred !== old) {
      this._notifyObservers();
    }
  }

  private _transition(state: InternalTaskState): void {
    if (this._state === state) {
      return;
    }
    switch (state) {
      case InternalTaskState.CANCELING:
        // TODO(andysoto):
        // assert(this.state_ === InternalTaskState.RUNNING ||
        //        this.state_ === InternalTaskState.PAUSING);
        this._state = state;
        if (this._request !== null) {
          this._request.cancel();
        }
        break;
      case InternalTaskState.PAUSING:
        // TODO(andysoto):
        // assert(this.state_ === InternalTaskState.RUNNING);
        this._state = state;
        if (this._request !== null) {
          this._request.cancel();
        }
        break;
      case InternalTaskState.RUNNING:
        // TODO(andysoto):
        // assert(this.state_ === InternalTaskState.PAUSED ||
        //        this.state_ === InternalTaskState.PAUSING);
        const wasPaused = this._state === InternalTaskState.PAUSED;
        this._state = state;
        if (wasPaused) {
          this._notifyObservers();
          this._start();
        }
        break;
      case InternalTaskState.PAUSED:
        // TODO(andysoto):
        // assert(this.state_ === InternalTaskState.PAUSING);
        this._state = state;
        this._notifyObservers();
        break;
      case InternalTaskState.CANCELED:
        // TODO(andysoto):
        // assert(this.state_ === InternalTaskState.PAUSED ||
        //        this.state_ === InternalTaskState.CANCELING);
        this._error = canceled();
        this._state = state;
        this._notifyObservers();
        break;
      case InternalTaskState.ERROR:
        // TODO(andysoto):
        // assert(this.state_ === InternalTaskState.RUNNING ||
        //        this.state_ === InternalTaskState.PAUSING ||
        //        this.state_ === InternalTaskState.CANCELING);
        this._state = state;
        this._notifyObservers();
        break;
      case InternalTaskState.SUCCESS:
        // TODO(andysoto):
        // assert(this.state_ === InternalTaskState.RUNNING ||
        //        this.state_ === InternalTaskState.PAUSING ||
        //        this.state_ === InternalTaskState.CANCELING);
        this._state = state;
        this._notifyObservers();
        break;
      default: // Ignore
    }
  }

  private completeTransitions_(): void {
    switch (this._state) {
      case InternalTaskState.PAUSING:
        this._transition(InternalTaskState.PAUSED);
        break;
      case InternalTaskState.CANCELING:
        this._transition(InternalTaskState.CANCELED);
        break;
      case InternalTaskState.RUNNING:
        this._start();
        break;
      default:
        // TODO(andysoto): assert(false);
        break;
    }
  }

  get snapshot(): UploadTaskSnapshot {
    const externalState = taskStateFromInternalTaskState(this._state);
    return new UploadTaskSnapshot(
      this._transferred,
      this._blob.size(),
      externalState,
      this._metadata!,
      this,
      this._ref
    );
  }

  /**
   * Adds a callback for an event.
   * @param type The type of event to listen for.
   */
  on(
    type: TaskEvent,
    nextOrObserver?:
      | StorageObserver<UploadTaskSnapshot>
      | ((a: UploadTaskSnapshot) => unknown),
    error?: ErrorFn,
    completed?: CompleteFn
  ): Unsubscribe | Subscribe<UploadTaskSnapshot> {
    const self = this;

    function makeBinder(): Subscribe<UploadTaskSnapshot> {
      function binder(
        nextOrObserver?:
          | NextFn<UploadTaskSnapshot>
          | StorageObserver<UploadTaskSnapshot>,
        error?: ErrorFn,
        complete?: CompleteFn
      ): () => void {
        const observer = new Observer(nextOrObserver, error, completed);
        self._addObserver(observer);
        return () => {
          self._removeObserver(observer);
        };
      }
      return binder;
    }

    return makeBinder()(nextOrObserver, error, completed);
  }

  /**
   * This object behaves like a Promise, and resolves with its snapshot data
   * when the upload completes.
   * @param onFulfilled The fulfillment callback. Promise chaining works as normal.
   * @param onRejected The rejection callback.
   */
  then<U>(
    onFulfilled?: ((value: UploadTaskSnapshot) => U | Promise<U>) | null,
    onRejected?: ((error: FirebaseStorageError) => U | Promise<U>) | null
  ): Promise<U> {
    // These casts are needed so that TypeScript can infer the types of the
    // resulting Promise.
    return this._promise.then<U>(
      onFulfilled as (value: UploadTaskSnapshot) => U | Promise<U>,
      onRejected as ((error: unknown) => Promise<never>) | null
    );
  }

  /**
   * Equivalent to calling `then(null, onRejected)`.
   */
  catch<T>(
    onRejected: (p1: FirebaseStorageError) => T | Promise<T>
  ): Promise<T> {
    return this.then(null, onRejected);
  }

  /**
   * Adds the given observer.
   */
  private _addObserver(observer: Observer<UploadTaskSnapshot>): void {
    this._observers.push(observer);
    this._notifyObserver(observer);
  }

  /**
   * Removes the given observer.
   */
  private _removeObserver(observer: Observer<UploadTaskSnapshot>): void {
    const i = this._observers.indexOf(observer);
    if (i !== -1) {
      this._observers.splice(i, 1);
    }
  }

  private _notifyObservers(): void {
    this._finishPromise();
    const observers = this._observers.slice();
    observers.forEach(observer => {
      this._notifyObserver(observer);
    });
  }

  private _finishPromise(): void {
    if (this._resolve !== null) {
      let triggered = true;
      switch (taskStateFromInternalTaskState(this._state)) {
        case TaskState.SUCCESS:
          fbsAsync(this._resolve.bind(null, this.snapshot))();
          break;
        case TaskState.CANCELED:
        case TaskState.ERROR:
          const toCall = this._reject as (p1: FirebaseStorageError) => void;
          fbsAsync(toCall.bind(null, this._error as FirebaseStorageError))();
          break;
        default:
          triggered = false;
          break;
      }
      if (triggered) {
        this._resolve = null;
        this._reject = null;
      }
    }
  }

  private _notifyObserver(observer: Observer<UploadTaskSnapshot>): void {
    const externalState = taskStateFromInternalTaskState(this._state);
    switch (externalState) {
      case TaskState.RUNNING:
      case TaskState.PAUSED:
        if (observer.next) {
          fbsAsync(observer.next.bind(observer, this.snapshot))();
        }
        break;
      case TaskState.SUCCESS:
        if (observer.complete) {
          fbsAsync(observer.complete.bind(observer))();
        }
        break;
      case TaskState.CANCELED:
      case TaskState.ERROR:
        if (observer.error) {
          fbsAsync(
            observer.error.bind(observer, this._error as FirebaseStorageError)
          )();
        }
        break;
      default:
        // TODO(andysoto): assert(false);
        if (observer.error) {
          fbsAsync(
            observer.error.bind(observer, this._error as FirebaseStorageError)
          )();
        }
    }
  }

  /**
   * Resumes a paused task. Has no effect on a currently running or failed task.
   * @return True if the operation took effect, false if ignored.
   */
  resume(): boolean {
    const valid =
      this._state === InternalTaskState.PAUSED ||
      this._state === InternalTaskState.PAUSING;
    if (valid) {
      this._transition(InternalTaskState.RUNNING);
    }
    return valid;
  }

  /**
   * Pauses a currently running task. Has no effect on a paused or failed task.
   * @return True if the operation took effect, false if ignored.
   */
  pause(): boolean {
    const valid = this._state === InternalTaskState.RUNNING;
    if (valid) {
      this._transition(InternalTaskState.PAUSING);
    }
    return valid;
  }

  /**
   * Cancels a currently running or paused task. Has no effect on a complete or
   * failed task.
   * @return True if the operation took effect, false if ignored.
   */
  cancel(): boolean {
    const valid =
      this._state === InternalTaskState.RUNNING ||
      this._state === InternalTaskState.PAUSING;
    if (valid) {
      this._transition(InternalTaskState.CANCELING);
    }
    return valid;
  }
}
