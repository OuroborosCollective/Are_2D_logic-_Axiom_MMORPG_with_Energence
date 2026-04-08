import createAdminRouter from '../admin/api';

import config from '@kaetram/common/config';
import log from '@kaetram/common/util/log';
import Utils from '@kaetram/common/util/utils';
import axios from 'axios';
import express from 'express';
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

import type { Integration } from '@sentry/types';
import type { Router, Express } from 'express';
import type World from '../game/world';

/**
 * API will have a variety of uses. Including communication
 * between multiple worlds (planned for the future).
 *
 * `accessToken` - A randomly generated token that can be used
 * to verify the validity between the client and the server.
 * This is a rudimentary security method, but is enough considering
 * the simplicity of the current API.
 */

export default class API {
    private hubConnected = false;

    public constructor(private world: World) {
        // Admin API is always available (on the server API port or default port 9002)
        let app: Express = express(),
            router: Router | undefined;

        if (config.sentryDsn)
            app.use(Sentry.Handlers.requestHandler())
                .use(Sentry.Handlers.tracingHandler())
                .use(Sentry.Handlers.errorHandler());

        app.use(express.urlencoded({ extended: true })).use(express.json());

        // Mount admin panel routes with CORS for the admin UI
        const adminRouter = createAdminRouter(world);
        app.use('/admin', (req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
            next();
        }, adminRouter);

        router = express.Router();
        this.handleRouter(router);
        app.use('/', router);

        let apiEnabled = config.apiEnabled || config.hubEnabled;
        let apiPort = apiEnabled ? config.apiPort : 9002;

        app.listen(apiPort, () => {
            log.notice(`${config.name} API + Admin panel initialized on port ${apiPort}.`);
        });

        if (!config.sentryDsn) return;

        let integrations: Integration[] = [new Sentry.Integrations.Http({ tracing: true })];

        integrations.push(new Tracing.Integrations.Express({ app, router: router! }));

        Sentry.init({
            dsn: config.sentryDsn,
            integrations,
            tracesSampleRate: 1
        });
    }

    /**
     * Default routing for the server API. We just display some basic infomration
     * about the server, such as the name, port, game version, and the amount of
     * players currently online.
     * @param router Router for endpoints.
     */

    private handleRouter(router: express.Router): void {
        router.get('/', (_request, response) => {
            response.json({
                name: config.name,
                port: config.port, // Sends the server port.
                gameVersion: config.gver,
                maxPlayers: config.maxPlayers,
                playerCount: this.world.getPopulation()
            });
        });
    }

    /**
     * Checks whether the player is online on another server.
     * @param username The username of the player we are checking for.
     */

    public isPlayerOnline(username: string, callback: (online: boolean) => void): void {
        if (!config.hubEnabled) return callback(false);

        let url = Utils.getUrl(config.hubHost, config.hubPort, 'isOnline'),
            data = {
                hubAccessToken: config.hubAccessToken,
                serverId: config.serverId,
                username
            };

        axios
            .post(url, data)
            .then(({ data }) => callback(data.online))
            .catch(() => log.error('Could not send `isOnline` to hub.'));
    }
}
