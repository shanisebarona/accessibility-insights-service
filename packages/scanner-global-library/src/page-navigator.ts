// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { Page, Response } from 'puppeteer';
import { injectable, inject } from 'inversify';
import _ from 'lodash';
import { PageResponseProcessor } from './page-response-processor';
import { BrowserError } from './browser-error';
import { NavigationHooks } from './navigation-hooks';
import { PageConfigurator } from './page-configurator';

@injectable()
export class PageNavigator {
    // The total page navigation timeout should correlate with Batch scan task 'max wall-clock time' constrain
    // Refer to service configuration TaskRuntimeConfig.taskTimeoutInMinutes property
    public readonly gotoTimeoutMsecs = 60000;

    constructor(
        @inject(PageResponseProcessor) public readonly pageResponseProcessor: PageResponseProcessor,
        @inject(NavigationHooks) public readonly navigationHooks: NavigationHooks,
    ) {}

    public get pageConfigurator(): PageConfigurator {
        return this.navigationHooks.pageConfigurator;
    }

    public async navigate(
        url: string,
        page: Page,
        onNavigationError: (browserError: BrowserError, error?: unknown) => Promise<void> = () => Promise.resolve(),
    ): Promise<Response> {
        await this.navigationHooks.preNavigation(page);

        let response: Response;
        try {
            response = await page.goto(url, {
                waitUntil: 'networkidle0',
                timeout: this.gotoTimeoutMsecs,
            });
        } catch (err) {
            const navigationError = this.pageResponseProcessor.getNavigationError(err as Error);
            onNavigationError(navigationError, err);

            return undefined;
        }

        this.navigationHooks.postNavigation(page, response, onNavigationError);

        return response;
    }
}
