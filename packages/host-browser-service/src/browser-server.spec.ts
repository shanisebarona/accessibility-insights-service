// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import 'reflect-metadata';

import http from 'http';
import { It, Mock, Times } from 'typemoq';
import Puppeteer from 'puppeteer';
import { GlobalLogger } from 'logger';
import Server from 'http-proxy';
import { BrowserLauncher } from './browser-launcher';
import { BrowserServer } from './browser-server';

describe(BrowserServer, () => {
    const launcherMock = Mock.ofType<BrowserLauncher>();
    const loggerMock = Mock.ofType<GlobalLogger>();
    const serverMock = Mock.ofType<http.Server>();
    const wsProxyMock = Mock.ofInstance((
        req: http.IncomingMessage,
        socket: unknown,
        head: unknown,
        options?: Server.ServerOptions) => null);

    let requestListener: http.RequestListener;
    let closeListener: () => void;
    let listenListener: () => void;
    let upgradeListener: (...args: unknown[]) => void;

    const httpStub = {
        createServer: (rl: http.RequestListener) => {
            requestListener = rl;

            return serverMock.object;
        },
    } as typeof http;

    const httpProxyStub = {
        createProxyServer: (options?: Server.ServerOptions) => {
            return {
                ws: wsProxyMock.object,
            };
        },
    } as unknown as typeof Server;

    beforeEach(() => {
        serverMock
            .setup((m) => m.on('upgrade', It.isAny()))
            .returns((_, func) => (upgradeListener = func))
            .verifiable(Times.once());
        serverMock
            .setup((m) => m.on('close', It.isAny()))
            .returns((_, func) => (closeListener = func))
            .verifiable(Times.once());
        serverMock
            .setup((m) => m.listen(8585, It.isAny()))
            .returns((_, func) => (listenListener = func))
            .verifiable(Times.once());

        const browserServer = new BrowserServer(launcherMock.object, loggerMock.object, httpStub, httpProxyStub);
        browserServer.run();
    });

    afterEach(() => {
        serverMock.verifyAll();
        launcherMock.reset();
        serverMock.reset();
    });

    it('/closeStale: closes stale browsers', async () => {
        const req = {
            url: '/closeStale',
        } as http.IncomingMessage;

        const res = Mock.ofType<http.ServerResponse>();
        await requestListener(req, res.object);

        launcherMock.verify((l) => l.closeStale(), Times.once());
        res.verify((r) => r.end(), Times.once());
    });

    it('/closeStale: if error, responds with 400', async () => {
        const req = {
            url: '/closeStale',
        } as http.IncomingMessage;

        launcherMock.setup((l) => l.closeStale()).returns(_ => {
            throw new Error();
        });


        const res = Mock.ofType<http.ServerResponse>();
        await requestListener(req, res.object);

        loggerMock.verify((m) => m.logInfo(It.isAny()), Times.once());
        res.verify((r) => r.writeHead(400), Times.once());
        res.verify((r) => r.end(), Times.once());
    });

    it('on close, closes all browsers', () => {
        closeListener();
        launcherMock.verify((m) => m.closeAll(), Times.once());
    });

    it('server listens to 8585 and logs', () => {
        listenListener();
        loggerMock.verify((m) => m.logInfo(It.isAnyString()), Times.once());
    });

    it('proxies to ws target when upgrade event emitted', () => {
        const req = {} as http.IncomingMessage;
        const socket = {};
        const head = {};
        const target = 'ws';
        const browserStub = {
            wsEndpoint: () => target,
        } as Puppeteer.Browser;
        launcherMock.setup((l) => l.launch(It.isAny())).returns(() => Promise.resolve(browserStub));

        upgradeListener(req, socket, head);
        // debugging this test
        wsProxyMock.verify(m => m(req, socket, head, { target }), Times.once());
    });
});
