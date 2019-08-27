// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as inversify from 'inversify';

export function setupWebApiScanJobManagerContainer(): inversify.Container {
    return new inversify.Container({ autoBindInjectable: true });
}