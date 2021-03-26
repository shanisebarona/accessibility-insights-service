// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import 'reflect-metadata';

import Apify from 'apify';
import { Page, Response } from 'puppeteer';
import { BrowserError, PageConfigurator, NavigationHooks } from 'scanner-global-library';
import { IMock, It, Mock, Times } from 'typemoq';
import { System } from 'common';
import { CrawlerConfiguration } from '../crawler/crawler-configuration';
import { DataBase } from '../level-storage/data-base';
import { AccessibilityScanOperation } from '../page-operations/accessibility-scan-operation';
import { BlobStore, DataStore } from '../storage/store-types';
import { ApifyRequestQueueProvider } from '../types/ioc-types';
import { ScanData } from '../types/scan-data';
import { ScanResult } from '../level-storage/storage-documents';
import { PageProcessorBase, PuppeteerCrawlingContext, PuppeteerHandlePageInputs } from './page-processor-base';

/* eslint-disable @typescript-eslint/no-explicit-any, , @typescript-eslint/consistent-type-assertions */

describe(PageProcessorBase, () => {
    class TestablePageProcessor extends PageProcessorBase {
        public snapshot: boolean;

        public baseUrl: string;

        public processPage = async (inputs: PuppeteerHandlePageInputs) => {
            return;
        };

        public async saveSnapshot(page: Page, id: string): Promise<void> {
            await super.saveSnapshot(page, id);
        }
    }

    const discoveryPatterns: string[] = ['pattern1', 'pattern2'];
    const testUrl = 'url';
    const testId = 'id';
    const error: Error = {
        name: 'error',
        message: 'error message',
        stack: 'stack',
    };

    let requestQueueStub: Apify.RequestQueue;
    let accessibilityScanOpMock: IMock<AccessibilityScanOperation>;
    let dataStoreMock: IMock<DataStore>;
    let blobStoreMock: IMock<BlobStore>;
    let dataBaseMock: IMock<DataBase>;
    let enqueueLinksExtMock: IMock<typeof Apify.utils.enqueueLinks>;
    let saveSnapshotMock: IMock<typeof Apify.utils.puppeteer.saveSnapshot>;
    let processPageMock: IMock<Apify.PuppeteerHandlePage>;
    let navigationHooksMock: IMock<NavigationHooks>;
    let pageConfiguratorMock: IMock<PageConfigurator>;
    let crawlerConfigurationMock: IMock<CrawlerConfiguration>;
    let requestQueueProvider: ApifyRequestQueueProvider;
    let requestStub: Apify.Request;
    let pageStub: Page;
    let pageProcessorBase: TestablePageProcessor;

    beforeEach(() => {
        requestQueueStub = {} as Apify.RequestQueue;
        accessibilityScanOpMock = Mock.ofType<AccessibilityScanOperation>();
        dataStoreMock = Mock.ofType<DataStore>();
        blobStoreMock = Mock.ofType<BlobStore>();
        dataBaseMock = Mock.ofType<DataBase>();
        enqueueLinksExtMock = Mock.ofType<typeof Apify.utils.enqueueLinks>();
        saveSnapshotMock = Mock.ofType<typeof Apify.utils.puppeteer.saveSnapshot>();
        processPageMock = Mock.ofType<Apify.PuppeteerHandlePage>();
        navigationHooksMock = Mock.ofType<NavigationHooks>();
        pageConfiguratorMock = Mock.ofType<PageConfigurator>();
        crawlerConfigurationMock = Mock.ofType(CrawlerConfiguration);
        crawlerConfigurationMock
            .setup((o) => o.discoveryPatterns())
            .returns(() => discoveryPatterns)
            .verifiable();
        crawlerConfigurationMock
            .setup((o) => o.snapshot())
            .returns(() => false)
            .verifiable();

        requestStub = {
            id: testId,
            url: testUrl,
            userData: {},
            errorMessages: [],
        } as any;

        pageStub = {
            url: () => testUrl,
            setBypassCSP: (op: boolean) => {
                return;
            },
            title: () => 'title',
        } as any;

        requestQueueProvider = () => Promise.resolve(requestQueueStub);
        pageProcessorBase = new TestablePageProcessor(
            accessibilityScanOpMock.object,
            dataStoreMock.object,
            blobStoreMock.object,
            dataBaseMock.object,
            navigationHooksMock.object,
            requestQueueProvider,
            crawlerConfigurationMock.object,
            enqueueLinksExtMock.object,
            saveSnapshotMock.object,
        );
        pageProcessorBase.processPage = processPageMock.object;
    });

    afterEach(() => {
        blobStoreMock.verifyAll();
        dataStoreMock.verifyAll();
        processPageMock.verifyAll();
        saveSnapshotMock.verifyAll();
        navigationHooksMock.verifyAll();
        dataBaseMock.verifyAll();
        crawlerConfigurationMock.verifyAll();
    });

    it('preNavigation', async () => {
        const crawlingContext: PuppeteerCrawlingContext = {
            page: pageStub,
            request: requestStub,
            response: {} as Response,
        } as any;
        const gotoOptions = {};

        navigationHooksMock.setup((o) => o.preNavigation(crawlingContext.page));

        await pageProcessorBase.preNavigation(crawlingContext, gotoOptions);
    });

    it('postNavigation', async () => {
        pageProcessorBase.baseUrl = testUrl;
        const userAgent = 'userAgent';
        const browserResolution = '1920x1080';
        const crawlingContext: PuppeteerCrawlingContext = {
            page: pageStub,
            request: requestStub,
            response: {} as Response,
        } as any;
        pageConfiguratorMock
            .setup((o) => o.getUserAgent())
            .returns(() => userAgent)
            .verifiable();
        pageConfiguratorMock
            .setup((o) => o.getBrowserResolution())
            .returns(() => browserResolution)
            .verifiable();
        navigationHooksMock
            .setup((o) => o.pageConfigurator)
            .returns(() => pageConfiguratorMock.object)
            .verifiable(Times.atLeastOnce());
        navigationHooksMock.setup(async (o) => o.postNavigation(crawlingContext.page, It.isAny(), It.isAny())).verifiable();
        dataBaseMock
            .setup((o) => o.addScanMetadata({ baseUrl: testUrl, basePageTitle: 'title', userAgent, browserResolution }))
            .verifiable();

        await pageProcessorBase.postNavigation(crawlingContext);
    });

    it('postNavigationHook logs errors', async () => {
        const crawlingContext: PuppeteerCrawlingContext = {
            page: pageStub,
            request: requestStub,
        } as any;
        setupScanErrorLogging();

        const browserError = {
            errorType: 'NavigationError',
            message: error.message,
            stack: 'stack',
        } as BrowserError;
        navigationHooksMock
            .setup(async (o) => o.postNavigation(crawlingContext.page, It.isAny(), It.isAny()))
            .callback(async (url, page, fn) => {
                await fn(browserError, error);
            })
            .returns(() => Promise.reject(error))
            .verifiable();

        const scanResult = {
            id: requestStub.id as string,
            url: requestStub.url,
            scanState: 'runError',
            error: System.serializeError(error),
        } as ScanResult;
        dataBaseMock.setup((o) => o.addScanResult(testId, scanResult)).verifiable();

        try {
            await pageProcessorBase.postNavigation(crawlingContext);
            expect('').toBe('postNavigation() should throw an error');
        } catch (err) {
            expect(err).toBe(error);
        }
    });

    it('pageErrorProcessor', () => {
        const expectedScanData: ScanData = {
            id: requestStub.id as string,
            url: requestStub.url,
            succeeded: false,
            context: requestStub.userData,
            error: JSON.stringify(error),
            requestErrors: requestStub.errorMessages as string[],
            issueCount: 0,
        };
        dataStoreMock.setup((ds) => ds.pushData(expectedScanData)).verifiable();
        setupScanErrorLogging();

        pageProcessorBase.pageErrorProcessor({ request: requestStub, error } as Apify.HandleFailedRequestInput);
    });

    it('pageProcessor', async () => {
        const inputs: PuppeteerHandlePageInputs = {
            page: pageStub,
            request: requestStub,
        } as any;
        processPageMock.setup((pp) => pp(inputs)).verifiable();

        await pageProcessorBase.pageHandler(inputs);
    });

    it('pageProcessor logs errors', async () => {
        const inputs: PuppeteerHandlePageInputs = {
            page: pageStub,
            request: requestStub,
        } as any;
        processPageMock
            .setup((pp) => pp(inputs))
            .throws(error)
            .verifiable();
        setupScanErrorLogging();

        try {
            await pageProcessorBase.pageHandler(inputs);
            fail('pageProcessor should have thrown error');
        } catch (err) {
            expect(err).toBe(error);
        }
    });

    it('saveSnapshot', async () => {
        setupSaveSnapshot();
        pageProcessorBase.snapshot = true;

        pageProcessorBase.processPage = processPageMock.object;
        await pageProcessorBase.saveSnapshot(pageStub, testId);
    });

    function setupSaveSnapshot(): void {
        saveSnapshotMock.reset();
        saveSnapshotMock
            .setup((ssm) =>
                ssm(pageStub, {
                    key: `${testId}.screenshot`,
                    saveHtml: false,
                    keyValueStoreName: 'scan-results',
                }),
            )
            .verifiable();
    }

    function setupScanErrorLogging(): void {
        blobStoreMock
            .setup((bs) => bs.setValue(`${testId}.data`, { id: requestStub.id as string, url: requestStub.url, succeeded: false }))
            .verifiable();
        blobStoreMock.setup((bs) => bs.setValue(`${testId}.err`, `${error.stack}`, { contentType: 'text/plain' })).verifiable();
    }
});
