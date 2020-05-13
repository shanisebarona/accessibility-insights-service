// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import 'reflect-metadata';

import { HtmlSummaryReportGenerator } from './html-summary-report-generator';
import { SummaryReportData } from './summary-report-data';

// tslint:disable: no-object-literal-type-assertion

describe(HtmlSummaryReportGenerator, () => {
    let testSubject: HtmlSummaryReportGenerator;

    beforeEach(() => {
        testSubject = new HtmlSummaryReportGenerator();
    });

    test.each([
        [
            'has no scanned urls',
            {
                failedUrlToReportMap: {},
                passedUrlToReportMap: {},
                violationCountByRuleMap: {},
                unScannableUrls: [],
            } as SummaryReportData,
        ],
        [
            'has failed urls only',
            {
                failedUrlToReportMap: {
                    'https://www.failedUrl1.com': './failed-url1.html',
                    'https://www.failedUrl2.com': './failed-url2.html',
                },
                passedUrlToReportMap: {},
                violationCountByRuleMap: { rule1: 3 },
                unScannableUrls: [],
            } as SummaryReportData,
        ],
        [
            'has passed urls only',
            {
                failedUrlToReportMap: {},
                passedUrlToReportMap: {
                    'https://www.passedUrl1.com': './passed-url1.html',
                    'https://www.passedUrl2.com': './passed-url2.html',
                },
                violationCountByRuleMap: {},
                unScannableUrls: [],
            } as SummaryReportData,
        ],
        [
            'has both failed & passed urls',
            {
                failedUrlToReportMap: {
                    'https://www.failedUrl1.com': './failed-url1.html',
                    'https://www.failedUrl2.com': './failed-url2.html',
                },
                passedUrlToReportMap: {
                    'https://www.passedUrl1.com': './passed-url1.html',
                    'https://www.passedUrl2.com': './passed-url2.html',
                },
                violationCountByRuleMap: {
                    rule1: 3,
                },
                unScannableUrls: [],
            } as SummaryReportData,
        ],
    ])('logs violation summary when %s', async (testCaseName, testCase) => {
        expect(testSubject.generateReport(testCase)).toMatchSnapshot();
    });
});