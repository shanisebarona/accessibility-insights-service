// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { Spec } from 'axe-core';
import axe from 'axe-core';

export type AxeConfiguration = Spec;

// Note that @axe-core/puppeteer version range ">= 4.2.0 < 4.3.0" does not support
// axe-core's allowedOrigins Spec property, which will cause these configurations to
// be *silently* misapplied.

export const cloudAxeConfiguration: AxeConfiguration = {
    // We allow this for our own cloud workers because we can verify *both* that they
    // only use isolated, non-privileged browser contexts *and* they run in a network
    // environment that does not contain any private endpoints which expose secrets.
    allowedOrigins: ['<unsafe_all_origins>'],
};

export const localAxeConfiguration: AxeConfiguration = {
    // Local cases still use isolated, non-privileged browser contexts, but they may
    // be running in an environment with sensitive local/network endpoints, so we don't
    // allow cross-origin scanning.
    allowedOrigins: ['<same_origin>'],
    disableOtherRules: true,
    rules: [
        {
            "id": "aria-allowed-role",
            "excludeHidden": false,
            "selector": "a[role][href], button[role], details[role], embed[role], iframe[role], img[role][usemap], input[role]:not([type='hidden']), label[role], select[role], textarea[role], video[role][controls]",
            "matches": "aria-allowed-role-matches",
            "tags": ["cat.aria", "best-practice"],
            "metadata": {
              "description": "Please work!!!",
              "help": "ARIA role should be appropriate for the element"
            },
            "all": [],
            "any": ["aria-allowed-role"],
            "none": []
          } as axe.Rule
    ]
};
