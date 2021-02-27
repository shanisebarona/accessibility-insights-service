// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import http from 'http';
import Server from 'http-proxy';
import { inject, injectable, optional } from 'inversify';
import { GlobalLogger, Logger } from 'logger';
import { BrowserLauncher } from './browser-launcher';

@injectable()
export class BrowserServer {
    constructor(
        @inject(BrowserLauncher) private readonly browserLauncher: BrowserLauncher,
        @inject(GlobalLogger) @optional() private readonly logger: Logger,
        private readonly Http: typeof http = http,
        private readonly ProxyServer: typeof Server = Server,
    ) {}

    public run(): void {
        const launcher = this.browserLauncher;
        const proxy = this.ProxyServer.createProxyServer();

        const server = this.Http.createServer(async (req, res) => {
            try {
                if (req.url.endsWith('closeStale')) {
                    await launcher.closeStale();
                    res.end();
                }
            } catch (e) {
                this.logger.logInfo(e);
                res.writeHead(400);
                res.end();
            }
        });

        server.on('upgrade', async (req, socket, head) => {
            const browser = await launcher.launch();
            const target = browser.wsEndpoint();
            proxy.ws(req, socket, head, { target });
        });

        server.on('close', async () => {
            await this.browserLauncher.closeAll();
        });

        server.listen(8585, () => {
            this.logger.logInfo(
                `http://localhost:8585/closeStale or puppeteer.connect with wsEndpoint http://localhost:8585`,
            );
        });
    }
}
