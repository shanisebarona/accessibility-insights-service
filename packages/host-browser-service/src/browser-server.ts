// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import http from 'http';
import { inject, injectable, optional } from 'inversify';
import { GlobalLogger, Logger } from 'logger';
import { BrowserLauncher } from './browser-launcher';

@injectable()
export class BrowserServer {
    constructor(
        @inject(BrowserLauncher) private readonly browserLauncher: BrowserLauncher,
        @inject(GlobalLogger) @optional() private readonly logger: Logger,
        private readonly Http: typeof http = http,
    ) {}

    public run(): void {
        let response: string;
        const launcher = this.browserLauncher;
        const server = this.Http.createServer(async (req, res) => {
            try {
                if (req.url.endsWith('browser')) {
                    const browser = await launcher.launch();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    response = JSON.stringify({ wsEndpoint: browser.wsEndpoint() });
                } else if (req.url.endsWith('closeStale')) {
                    await launcher.closeStale();
                }
            } catch (e) {
                this.logger.logInfo(e);
                res.writeHead(400);
            } finally {
                res.end(response);
            }
        });

        server.on('close', async () => {
            await this.browserLauncher.closeAll();
        });

        server.listen(8585, () => {
            this.logger.logInfo(
                `make a request to http://localhost:8585/browser to start a new browser instance; ws endpoint will be returned`,
            );
        });
    }
}
