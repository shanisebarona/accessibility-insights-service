// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import 'reflect-metadata';

import { It, Mock, Times } from 'typemoq';
import { WebDriver } from 'scanner-global-library';
import Puppeteer from 'puppeteer';
import { BrowserLauncher } from './browser-launcher';
import { getPromisableDynamicMock } from './promisable-mock';

describe(BrowserLauncher, () => {
    const browserMock = getPromisableDynamicMock(Mock.ofType<Puppeteer.Browser>());
    let testSubject: BrowserLauncher;

    beforeAll(() => {
        const webdriverMock = Mock.ofType(WebDriver);
        testSubject = new BrowserLauncher(webdriverMock.object);

        webdriverMock.setup((m) => m.launch(It.isAny())).returns(() => Promise.resolve(browserMock.object));
    });

    it('launches browser via webdriver', async () => {
        const browser = await testSubject.launch();
        expect(browser).toBe(browserMock.object);
    });

    it('closes launched browser', async () => {
        const browser = await testSubject.launch();
        expect(browser).toBe(browserMock.object);
        await testSubject.closeAll();
        browserMock.verify((m) => m.close(), Times.once());
    });
});
