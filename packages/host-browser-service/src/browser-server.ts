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
        const launcher = this.browserLauncher;
        const server = this.Http.createServer(async (req, res) => {
            try {
                if (req.url.endsWith('browser')) {
                    const browser = await launcher.launch();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ wsEndpoint: browser.wsEndpoint() }));
                }
            } catch (e) {
                this.logger.logInfo(e);
                res.writeHead(400);
            }
            res.end();
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
