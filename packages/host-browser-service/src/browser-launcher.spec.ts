// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import 'reflect-metadata';

import { It, Mock, Times } from 'typemoq';
import { WebDriver } from 'scanner-global-library';
import Puppeteer from 'puppeteer';
import * as MockDate from 'mockdate';
import { BrowserLauncher } from './browser-launcher';
import { getPromisableDynamicMock } from './promisable-mock';

describe(BrowserLauncher, () => {
    const browserMock = getPromisableDynamicMock(Mock.ofType<Puppeteer.Browser>());
    let testSubject: BrowserLauncher;

    beforeAll(() => {
        MockDate.reset();
        const webdriverMock = Mock.ofType(WebDriver);
        testSubject = new BrowserLauncher(webdriverMock.object);
        webdriverMock.setup((m) => m.launch(It.isAny())).returns(() => Promise.resolve(browserMock.object));
    });

    it('launches browser via webdriver', async () => {
        const browser = await testSubject.launch();
        expect(browser).toBe(browserMock.object);
    });

    it('closes all launched browsers', async () => {
        const browser = await testSubject.launch();
        expect(browser).toBe(browserMock.object);
        await testSubject.closeAll();
        browserMock.verify((m) => m.close(), Times.once());
    });

    it('closes stale browsers', async () => {
        const launchDate = new Date();
        MockDate.set(launchDate);

        await testSubject.launch();
        const afterOneMinute = new Date(launchDate.getTime() + 60 * 1000 + 1);
        MockDate.set(afterOneMinute);
        await testSubject.closeStale();

        await testSubject.launch();
        const afterThreeMinutes = new Date(launchDate.getTime() + 2 * 60 * 1000 + 1);
        MockDate.set(afterThreeMinutes);
        await testSubject.closeStale();

        browserMock.verify(m => m.close(), Times.once());
    });
});
