// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { inject, injectable } from 'inversify';
import { WebDriver } from 'scanner-global-library';
import Puppeteer from 'puppeteer';

@injectable()
export class BrowserLauncher {
    private readonly BROWSER_TIMEOUT_MS: number = 3 * 60 * 1000;
    private readonly browsers = new Map<Puppeteer.Browser, Date>();

    constructor(@inject(WebDriver) private readonly webDriver: WebDriver) {}

    public async launch(browserExecutablePath?: string): Promise<Puppeteer.Browser> {
        const browser = await this.webDriver.launch(browserExecutablePath);
        this.browsers.set(browser, new Date());

        return browser;
    }

    public async closeStale(): Promise<void> {
        const currentTime = new Date();
        for (const b of this.browsers.keys()) {
            if (currentTime.getTime() - this.browsers.get(b).getTime() > this.BROWSER_TIMEOUT_MS) {
                await b.close();
                this.browsers.delete(b);
            }
        }
    }

    public async closeAll(): Promise<void> {
        for (const b of this.browsers.keys()) {
            await b.close();
        }
    }
}
