// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { WebDriver } from 'scanner-global-library';
import Puppeteer from 'puppeteer';

@injectable()
export class BrowserLauncher {
    private readonly browsers: Set<Puppeteer.Browser> = new Set();

    constructor(@inject(WebDriver) private readonly webDriver: WebDriver) {}

    public async launch(browserExecutablePath?: string): Promise<Puppeteer.Browser> {
        const browser = await this.webDriver.launch(browserExecutablePath);
        this.browsers.add(browser);

        return browser;
    }

    public async closeAll(): Promise<void> {
        for (const b of this.browsers) {
            await b.close();
        }
    }
}
