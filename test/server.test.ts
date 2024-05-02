import { expect } from "chai";
import sinon from "sinon";

import Router, { RouterContext } from "@koa/router";
import { Container, injectable } from "inversify";
import Koa from "koa";
import { TYPE } from "../src/constants.js";
import { AuthProvider, Principal } from "../src/interfaces.js";
import { InversifyKoaServer } from "../src/server.js";

describe("Unit Test: InversifyKoaServer", () => {

    it("should call the configFn before the errorConfigFn", (done) => {
        const middleware = function (ctx: RouterContext, next: () => Promise<any>) { return; };
        const configFn = sinon.spy((app: Koa) => { app.use(middleware); });
        const errorConfigFn = sinon.spy((app: Koa) => { app.use(middleware); });
        const container = new Container();

        @injectable()
        class TestController { }

        container.bind(TYPE.Controller).to(TestController);
        const server = new InversifyKoaServer(container);

        server.setConfig(configFn)
            .setErrorConfig(errorConfigFn);

        expect(configFn.called).to.eq(false);
        expect(errorConfigFn.called).to.eq(false);

        server.build();

        expect(configFn.calledOnce).to.eqls(true);
        expect(errorConfigFn.calledOnce).to.eqls(true);
        expect(configFn.calledBefore(errorConfigFn)).to.eqls(true);
        done();
    });

    it("Should allow to pass a custom Router instance as config", () => {

        const container = new Container();

        const customRouter = new Router({
        });

        const serverWithDefaultRouter = new InversifyKoaServer(container);
        const serverWithCustomRouter = new InversifyKoaServer(container, customRouter);

        expect((serverWithDefaultRouter as any)._router === customRouter).to.eq(false);
        expect((serverWithCustomRouter as any)._router === customRouter).to.eqls(true);

    });

    it("Should allow to provide custom routing configuration", () => {

        const container = new Container();

        const routingConfig = {
            rootPath: "/such/root/path"
        };

        const serverWithDefaultConfig = new InversifyKoaServer(container);
        const serverWithCustomConfig = new InversifyKoaServer(container, null, routingConfig);

        expect((serverWithCustomConfig as any)._routingConfig).to.eq(routingConfig);
        expect((serverWithDefaultConfig as any)._routingConfig).to.not.eql(
            (serverWithCustomConfig as any)._routingConfig
        );

    });

    it("Should allow to provide a custom Koa application", () => {
        const container = new Container();

        const app = new Koa();

        const serverWithDefaultApp = new InversifyKoaServer(container);
        const serverWithCustomApp = new InversifyKoaServer(container, null, null, app);

        expect((serverWithCustomApp as any)._app).to.eq(app);
        // deeply equal causes error with property URL
        expect((serverWithDefaultApp as any)._app).to.not.equal((serverWithCustomApp as any)._app);
    });

    it("Should allow to provide a auth provider", () => {
        class MyAuthProvider implements AuthProvider {
            public getPrincipal(ctx: RouterContext): Promise<Principal> {
                return Promise.resolve({
                    details: null,
                    isAuthenticated: () => Promise.resolve(false),
                    isInRole: (role: string) => Promise.resolve(false),
                    isResourceOwner: (resourceId: any) => Promise.resolve(false)
                });
            }
        }
        const container = new Container();

        const server = new InversifyKoaServer(container, null, null, null, MyAuthProvider);

        expect((server as any)._AuthProvider).to.eq(MyAuthProvider);
    });
});
