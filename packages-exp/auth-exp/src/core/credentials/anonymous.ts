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

import { ProviderId, SignInMethod } from '@firebase/auth-types-exp';

import { signUp } from '../../api/authentication/sign_up';
import { Auth } from '../../model/auth';
import { IdTokenResponse } from '../../model/id_token';
import { debugFail } from '../util/assert';
import { AuthCredential } from './';

export class AnonymousCredential implements AuthCredential {
  providerId = ProviderId.ANONYMOUS;
  signInMethod = SignInMethod.ANONYMOUS;

  toJSON(): never {
    debugFail('Method not implemented.');
  }

  static fromJSON(_json: object | string): AnonymousCredential | null {
    debugFail('Method not implemented');
  }

  async _getIdTokenResponse(auth: Auth): Promise<IdTokenResponse> {
    return signUp(auth, {
      returnSecureToken: true
    });
  }

  async _linkToIdToken(_auth: Auth, _idToken: string): Promise<never> {
    debugFail("Can't link to an anonymous credential");
  }

  _getReauthenticationResolver(_auth: Auth): Promise<never> {
    debugFail('Method not implemented.');
  }
}