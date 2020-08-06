/**
 * @license
 * Copyright 2019 Google LLC
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
import {ListResult} from "../src/list";
import {ReferenceCompat} from "./reference";


export class ListResultCompat implements types.ListResult {
  constructor(private readonly  delegate: ListResult) {
  }
  
  prefixes = this.delegate.prefixes.map(v => ReferenceCompat.fromReference(v));
  items = this.delegate.items.map(v => ReferenceCompat.fromReference(v));
  nextPageToken = this.delegate.nextPageToken;
  
}
