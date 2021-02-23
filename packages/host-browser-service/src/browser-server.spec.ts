// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import 'reflect-metadata';

import http from 'http';
import { It, Mock, Times } from 'typemoq';
import Puppeteer from 'puppeteer';
import { GlobalLogger } from 'logger';
import { BrowserLauncher } from './browser-launcher';
import { BrowserServer } from './browser-server';

describe(BrowserServer, () => {
    const launcherMock = Mock.ofType<BrowserLauncher>();
    const loggerMock = Mock.ofType<GlobalLogger>();
    const serverMock = Mock.ofType<http.Server>();
    let requestListener: http.RequestListener;
    let closeListener: () => void;
    let listenListener: () => void;

    beforeEach(() => {
        const httpStub = {
            createServer: (rl: http.RequestListener) => {
                requestListener = rl;

                return serverMock.object;
            },
        } as typeof http;

        serverMock
            .setup((m) => m.on('close', It.isAny()))
            .returns((_, func) => (closeListener = func))
            .verifiable(Times.once());
        serverMock
            .setup((m) => m.listen(8585, It.isAny()))
            .returns((_, func) => (listenListener = func))
            .verifiable(Times.once());

        const browserServer = new BrowserServer(launcherMock.object, loggerMock.object, httpStub);
        browserServer.run();
    });

    afterEach(() => serverMock.verifyAll);

    it('/non-browser-url: ends request', async () => {
        const req = {
            url: '/',
        } as http.IncomingMessage;
        const res = Mock.ofType<http.ServerResponse>();
        await requestListener(req, res.object);

        res.verify((r) => r.end(), Times.once());
    });

    it('/browser: if launch error, responds with 400', async () => {
        const req = {
            url: '/browser',
        } as http.IncomingMessage;
        launcherMock.setup((l) => l.launch(It.isAny())).returns((_) => Promise.reject());

        const res = Mock.ofType<http.ServerResponse>();
        await requestListener(req, res.object);
        res.verify((r) => r.writeHead(400), Times.once());
        res.verify((r) => r.end(), Times.once());
        loggerMock.verify((m) => m.logInfo(It.isAny()), Times.once());
    });

    it('/browser: responds with 200 and ws endpoint', async () => {
        const req = {
            url: '/browser',
        } as http.IncomingMessage;

        const browserStub = {
            wsEndpoint: () => 'ws',
        } as Puppeteer.Browser;
        launcherMock.setup((l) => l.launch(It.isAny())).returns(() => Promise.resolve(browserStub));

        const res = Mock.ofType<http.ServerResponse>();
        await requestListener(req, res.object);

        res.verify((r) => r.writeHead(200, { 'Content-Type': 'application/json' }), Times.once());
        res.verify((r) => r.end(JSON.stringify({ wsEndpoint: 'ws' })), Times.once());
    });

    it('on close, closes all browsers', () => {
        closeListener();
        launcherMock.verify((m) => m.closeAll(), Times.once());
    });

    it('server listens to 8585 and logs', () => {
        listenListener();
        loggerMock.verify((m) => m.logInfo(It.isAnyString()), Times.once());
    });
});
