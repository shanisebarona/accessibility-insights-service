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
    checks: [
        {
            id: 'dylang',
            options: ['dylan'],
            evaluate:
                'function (node, options) {\n        var lang = (node.getAttribute("lang") || "").trim().toLowerCase();\n        var xmlLang = (node.getAttribute("xml:lang") || "").trim().toLowerCase();\n        var invalid = [];\n        (options || []).forEach(function(cc) {\n          cc = cc.toLowerCase();\n          if (lang && (lang === cc || lang.indexOf(cc.toLowerCase() + "-") === 0)) {\n            lang = null;\n          }\n          if (xmlLang && (xmlLang === cc || xmlLang.indexOf(cc.toLowerCase() + "-") === 0)) {\n            xmlLang = null;\n          }\n        });\n        if (xmlLang) {\n          invalid.push(\'xml:lang="\' + xmlLang + \'"\');\n        }\n        if (lang) {\n          invalid.push(\'lang="\' + lang + \'"\');\n        }\n        if (invalid.length) {\n          this.data(invalid);\n          return true;\n        }\n        return false;\n      }',
            messages: {
                pass: 'Good language',
                fail: 'You mst use the DYLAN language',
            },
        } as axe.Check,
    ],
    rules: [
        {
            id: 'dylang',
            metadata: {
                description: "Ensures lang attributes have the value of 'dylan'",
                help: "lang attribute must have the value of 'dylan'",
            },
            selector: 'html',
            any: [],
            all: [],
            none: ['dylang'],
            tags: ['wcag2aa'],
        } as axe.Rule,
    ],
};
