// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { isEmpty } from 'lodash';
import { ApifySettings, ApifySettingsHandler, apifySettingsHandler } from '../apify/apify-settings';
import { CrawlerRunOptions } from '../types/crawler-run-options';
import { crawlerIocTypes } from '../types/ioc-types';
import { DiscoveryPatternFactory, getDiscoveryPatternForUrl } from '../apify/discovery-patterns';

@injectable()
export class CrawlerConfiguration {
    public constructor(
        @inject(crawlerIocTypes.CrawlerRunOptions) private readonly crawlerRunOptions: CrawlerRunOptions,
        private readonly settingsHandler: ApifySettingsHandler = apifySettingsHandler,
        private readonly createDiscoveryPattern: DiscoveryPatternFactory = getDiscoveryPatternForUrl,
    ) {}

    public baseUrl(): string {
        return this.crawlerRunOptions.baseUrl;
    }

    public discoveryPatterns(): string[] {
        return this.getDiscoveryPattern(this.crawlerRunOptions.baseUrl, this.crawlerRunOptions.discoveryPatterns);
    }

    public selectors(): string[] {
        return this.getDefaultSelectors(this.crawlerRunOptions.selectors);
    }

    public snapshot(): boolean {
        return this.getSnapshot(this.crawlerRunOptions.snapshot, this.crawlerRunOptions.simulate);
    }

    public maxRequestsPerCrawl(): number {
        return this.getMaxRequestsPerCrawl(this.crawlerRunOptions.maxRequestsPerCrawl);
    }

    public crawl(): boolean {
        return this.crawlerRunOptions.crawl ?? false;
    }

    public axeSourcePath(): string {
        return this.crawlerRunOptions.axeSourcePath;
    }

    public chromePath(): string {
        return this.crawlerRunOptions.chromePath;
    }

    public localOutputDir(): string {
        return this.crawlerRunOptions.localOutputDir;
    }

    public setDefaultApifySettings(): void {
        this.settingsHandler.setApifySettings(this.getDefaultApifySettings());
    }

    public setMemoryMBytes(memoryMBytes: number): void {
        this.settingsHandler.setApifySettings({ APIFY_MEMORY_MBYTES: memoryMBytes?.toString() });
    }

    public setSilentMode(silentMode: boolean): void {
        this.settingsHandler.setApifySettings({ APIFY_HEADLESS: silentMode === undefined ? undefined : silentMode ? '1' : '0' });
    }

    public setChromePath(chromePath: string): void {
        this.settingsHandler.setApifySettings({ APIFY_CHROME_EXECUTABLE_PATH: chromePath });
    }

    private getMaxRequestsPerCrawl(maxRequestsPerCrawl: number): number {
        return maxRequestsPerCrawl === undefined || maxRequestsPerCrawl <= 0 ? 100 : maxRequestsPerCrawl;
    }

    private getSnapshot(snapshot: boolean, simulation: boolean): boolean {
        return snapshot ? true : simulation ?? false;
    }

    private getDefaultSelectors(selectors: string[]): string[] {
        return selectors === undefined || selectors.length === 0 ? ['button'] : selectors;
    }

    private getDefaultDiscoveryPattern(baseUrl: string): string[] {
        if (this.crawl() || baseUrl) {
            return [this.createDiscoveryPattern(baseUrl)];
        }

        return [];
    }

    private getDiscoveryPattern(baseUrl: string, discoveryPatterns: string[]): string[] {
        return discoveryPatterns ?? this.getDefaultDiscoveryPattern(baseUrl);
    }

    private getDefaultApifySettings(): ApifySettings {
        const currentSettings = this.settingsHandler.getApifySettings();

        return {
            APIFY_HEADLESS: '1',
            APIFY_LOCAL_STORAGE_DIR: isEmpty(currentSettings.APIFY_LOCAL_STORAGE_DIR)
                ? './ai_scan_cli_output'
                : currentSettings.APIFY_LOCAL_STORAGE_DIR,
        };
    }
}
