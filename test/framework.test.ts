import Router from "@koa/router";
import { expect } from "chai";
import { Container, inject, injectable } from "inversify";
import { default as Application, default as Koa } from "koa";
import bodyParser from "koa-bodyparser";
import sinon from "sinon";
import supertest from "supertest";
import { BaseMiddleware } from "../src/base_middleware.js";
import { TYPE } from "../src/constants.js";
import {
    all,
    authorize, authorizeAll,
    context,
    controller,
    cookies,
    httpDelete,
    httpGet,
    httpHead,
    httpMethod,
    httpPatch,
    httpPost, httpPut,
    next,
    queryParam,
    request,
    requestBody,
    requestHeaders,
    requestParam,
    response
} from "../src/decorators.js";
import { AuthProvider, Controller, KoaRequestHandler, Middleware, Principal } from "../src/interfaces.js";
import { InversifyKoaServer } from "../src/server.js";

describe("Integration Tests:", () => {
    let server: InversifyKoaServer;
    let container: Container;

    beforeEach((done) => {
        container = new Container();
        done();
    });

    describe("Routing & Request Handling:", () => {

        it("should work for basic koa cascading (using async/await)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public async getTest(ctx: Router.RouterContext, nextFunc: () => Promise<any>) {
                    const start = new Date();
                    await nextFunc();
                    const ms = new Date().valueOf() - start.valueOf();
                    ctx.set("X-Response-Time", `${ms}ms`);
                }

                @httpGet("/") public getTest2(ctx: Router.RouterContext) {
                    ctx.body = "Hello World";
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "Hello World", done);
        });

        it("should work for basic koa cascading (using promises)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public async getTest(ctx: Router.RouterContext, nextFunc: () => Promise<any>) {
                    const start = new Date();
                    return nextFunc().then(() => {
                        const ms = new Date().valueOf() - start.valueOf();
                        ctx.set("X-Response-Time", `${ms}ms`);
                        ctx.body = "Hello World";
                    });
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "Hello World", done);
        });

        it("should work for methods which call nextFunc()", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public async getTest(ctx: Router.RouterContext, nextFunc: () => Promise<any>) {
                    nextFunc();
                }

                @httpGet("/") public getTest2(ctx: Router.RouterContext) {
                    ctx.body = "GET";
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", done);
        });

        it("should work for async methods which call nextFunc()", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest(ctx: Router.RouterContext, nextFunc: () => Promise<any>) {
                    return new Promise(((resolve) => {
                        setTimeout(() => {
                            nextFunc();
                            resolve(null);
                        }, 100);
                    }));
                }

                @httpGet("/") public getTest2(ctx: Router.RouterContext) {
                    ctx.body = "GET";
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", done);
        });

        it("should work for async methods called by nextFunc()", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public async getTest(ctx: Router.RouterContext, nextFunc: () => Promise<any>) {
                    await nextFunc();
                }

                @httpGet("/") public async getTest2(ctx: Router.RouterContext) {
                    await new Promise(resolve => setTimeout(resolve, 100))
                    ctx.body = "GET";
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", done);
        });

        it("should work for each shortcut decorator", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest(ctx: Router.RouterContext) { ctx.body = "GET"; }
                @httpPost("/") public postTest(ctx: Router.RouterContext) { ctx.body = "POST"; }
                @httpPut("/") public putTest(ctx: Router.RouterContext) { ctx.body = "PUT"; }
                @httpPatch("/") public patchTest(ctx: Router.RouterContext) { ctx.body = "PATCH"; }
                @httpHead("/") public headTest(ctx: Router.RouterContext) { ctx.body = "HEAD"; }
                @httpDelete("/") public deleteTest(ctx: Router.RouterContext) { ctx.body = "DELETE"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            const agent = supertest(server.build().listen());

            const deleteFn = () => { agent.delete("/").expect(200, "DELETE", done); };
            const head = () => { agent.head("/").expect(200, "HEAD", deleteFn); };
            const patch = () => { agent.patch("/").expect(200, "PATCH", head); };
            const put = () => { agent.put("/").expect(200, "PUT", patch); };
            const post = () => { agent.post("/").expect(200, "POST", put); };
            const get = () => { agent.get("/").expect(200, "GET", post); };

            get();
        });

        it("should work for more obscure HTTP methods using the httpMethod decorator", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpMethod("propfind", "/") public getTest(ctx: Router.RouterContext) { ctx.body = "PROPFIND"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .propfind("/")
                .expect(200, "PROPFIND", done);
        });

        it("should use returned values as response", (done) => {
            const result = { "hello": "world" };

            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest(ctx: Router.RouterContext) { return result; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, JSON.stringify(result), done);
        });

        it("should use custom router passed from configuration", () => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("endpoint") public get() {
                    return "Such Text";
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            const customRouter = new Router({
                prefix: "/api"
            });

            server = new InversifyKoaServer(container, customRouter);
            const app = server.build().listen();

            const expectedSuccess = supertest(app)
                .get("/api/endpoint")
                .expect(200, "Such Text");

            const expectedNotFound1 = supertest(app)
                .get("/otherpath/endpoint")
                .expect(404);

            const expectedNotFound2 = supertest(app)
                .get("/endpoint")
                .expect(404);

            return Promise.all([
                expectedSuccess,
                expectedNotFound1,
                expectedNotFound2
            ]);

        });

        it("should use custom routing configuration", () => {
            @injectable()
            @controller("/ping")
            class TestController {
                @httpGet("/endpoint") public get() {
                    return "pong";
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, { rootPath: "/api/v1" });

            return supertest(server.build().listen())
                .get("/api/v1/ping/endpoint")
                .expect(200, "pong");
        });

        it("Should set the principal from auth provider into koa context", () => {
            const myPrincipal: Principal = {
                details: null,
                isAuthenticated: () => Promise.resolve(false),
                isInRole: (role: string) => Promise.resolve(false),
                isResourceOwner: (resourceId: any) => Promise.resolve(false)
            };
            @injectable()
            class MyAuthProvider implements AuthProvider {
                public getPrincipal(ctx: Router.RouterContext): Promise<Principal> {
                    return Promise.resolve(myPrincipal);
                }
            }
            @injectable()
            @controller("/ping")
            class TestController {
                @httpGet("/endpoint") public get(@context() ctx: Router.RouterContext) {
                    return ctx.state.principal === myPrincipal ? "correct principal" : "wrong principal";
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, MyAuthProvider);

            return supertest(server.build().listen())
                .get("/ping/endpoint")
                .expect(200, "correct principal");
        });
    });


    describe("Middleware:", () => {
        let result: string;
        const middleware: Record<string, Middleware> = {
            a: function (ctx: Router.RouterContext, nextFunc: () => Promise<any>) {
                result += "a";
                nextFunc();
            },
            b: function (ctx: Router.RouterContext, nextFunc: () => Promise<any>) {
                result += "b";
                nextFunc();
            },
            c: function (ctx: Router.RouterContext, nextFunc: () => Promise<any>) {
                result += "c";
                nextFunc();
            }
        };
        const spyA = sinon.spy(middleware, "a");
        const spyB = sinon.spy(middleware, "b");
        const spyC = sinon.spy(middleware, "c");

        beforeEach((done) => {
            result = "";
            spyA.resetHistory();
            spyB.resetHistory();
            spyC.resetHistory();
            done();
        });

        it("should call method-level middleware correctly (GET)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/", spyA, spyB, spyC) public getTest(ctx: Router.RouterContext) { ctx.body = "GET"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            const agent = supertest(server.build().listen());

            agent.get("/")
                .expect(200, "GET", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call method-level middleware correctly (POST)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpPost("/", spyA, spyB, spyC) public postTest(ctx: Router.RouterContext) { ctx.body = "POST"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            const agent = supertest(server.build().listen());

            agent.post("/")
                .expect(200, "POST", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call method-level middleware correctly (PUT)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpPut("/", spyA, spyB, spyC) public postTest(ctx: Router.RouterContext) { ctx.body = "PUT"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            const agent = supertest(server.build().listen());

            agent.put("/")
                .expect(200, "PUT", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call method-level middleware correctly (PATCH)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpPatch("/", spyA, spyB, spyC) public postTest(ctx: Router.RouterContext) { ctx.body = "PATCH"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            const agent = supertest(server.build().listen());

            agent.patch("/")
                .expect(200, "PATCH", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call method-level middleware correctly (HEAD)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpHead("/", spyA, spyB, spyC) public postTest(ctx: Router.RouterContext) { ctx.body = "HEAD"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            const agent = supertest(server.build().listen());

            agent.head("/")
                .expect(200, "HEAD", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call method-level middleware correctly (DELETE)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpDelete("/", spyA, spyB, spyC) public postTest(ctx: Router.RouterContext) { ctx.body = "DELETE"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            const agent = supertest(server.build().listen());

            agent.delete("/")
                .expect(200, "DELETE", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call method-level middleware correctly (ALL)", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @all("/", spyA, spyB, spyC) public postTest(ctx: Router.RouterContext) { ctx.body = "ALL"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            const agent = supertest(server.build().listen());

            agent.get("/")
                .expect(200, "ALL", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call controller-level middleware correctly", (done) => {
            @injectable()
            @controller("/", spyA, spyB, spyC)
            class TestController {
                @httpGet("/") public getTest(ctx: Router.RouterContext) { ctx.body = "GET"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call injected controller-level BaseMiddleware correctly", (done) => {
            // Create a custom service
            const serviceType = Symbol.for("TestService");
            @injectable()
            class TestService {
                public get value() { return "d"; }
            }
            container.bind<TestService>(serviceType).to(TestService);

            // Create a custom middleware
            const middlewareType = Symbol.for("TestMiddleware");
            @injectable()
            class TestMiddleware extends BaseMiddleware {
                private _testService: TestService;

                // Inject the service in the constructor
                constructor(@inject(serviceType) testService: TestService) {
                    super();
                    this._testService = testService;
                }

                public handler(ctx: Router.RouterContext, nextFunc: () => Promise<any>) {
                    result += this._testService.value;
                    nextFunc();
                }
            }
            container.bind<TestMiddleware>(middlewareType).to(TestMiddleware)

            @injectable()
            @controller("/", spyA, spyB, spyC, middlewareType)
            class TestController {
                @httpGet("/") public getTest(ctx: Router.RouterContext) { ctx.body = "GET"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abcd");
                    done();
                });
        });

        it("should call server-level middleware correctly", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest(ctx: Router.RouterContext) { ctx.body = "GET"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);

            server.setConfig((app) => {
                app.use(spyA);
                app.use(spyB);
                app.use(spyC);
            });

            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should call all middleware in correct order", (done) => {
            @injectable()
            @controller("/", spyB)
            class TestController {
                @httpGet("/", spyC) public getTest(ctx: Router.RouterContext) { ctx.body = "GET"; }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);

            server.setConfig((app: Application) => {
                app.use(spyA);
            });

            supertest(server.build().listen())
                .get("/")
                .expect(200, "GET", function () {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(spyC.calledOnce).to.eqls(true);
                    expect(result).to.equal("abc");
                    done();
                });
        });

        it("should resolve controller-level middleware", () => {
            const symbolId = Symbol("spyA");
            const strId = "spyB";

            @injectable()
            @controller("/", symbolId, strId)
            class TestController {
                @httpGet("/") public getTest(ctx: Router.RouterContext) { ctx.body = "GET"; }
            }

            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");
            container.bind<KoaRequestHandler>(symbolId).toConstantValue(spyA);
            container.bind<KoaRequestHandler>(strId).toConstantValue(spyB);

            server = new InversifyKoaServer(container);

            const agent = supertest(server.build().listen());

            return agent.get("/")
                .expect(200, "GET")
                .then(() => {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(result).to.equal("ab");
                });
        });

        it("should resolve method-level middleware", () => {
            const symbolId = Symbol("spyA");
            const strId = "spyB";

            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/", symbolId, strId)
                public getTest(ctx: Router.RouterContext) { ctx.body = "GET"; }
            }

            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");
            container.bind<KoaRequestHandler>(symbolId).toConstantValue(spyA);
            container.bind<KoaRequestHandler>(strId).toConstantValue(spyB);

            server = new InversifyKoaServer(container);

            const agent = supertest(server.build().listen());

            return agent.get("/")
                .expect(200, "GET")
                .then(() => {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(result).to.equal("ab");
                });
        });

        it("should compose controller- and method-level middleware", () => {
            const symbolId = Symbol("spyA");
            const strId = "spyB";

            @injectable()
            @controller("/", symbolId)
            class TestController {
                @httpGet("/", strId)
                public getTest(ctx: Router.RouterContext) { ctx.body = "GET"; }
            }

            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");
            container.bind<KoaRequestHandler>(symbolId).toConstantValue(spyA);
            container.bind<KoaRequestHandler>(strId).toConstantValue(spyB);

            server = new InversifyKoaServer(container);

            const agent = supertest(server.build().listen());

            return agent.get("/")
                .expect(200, "GET")
                .then(() => {
                    expect(spyA.calledOnce).to.eqls(true);
                    expect(spyB.calledOnce).to.eqls(true);
                    expect(result).to.equal("ab");
                });
        });
    });


    describe("Parameters:", () => {
        it("should bind a method parameter to the url parameter of the web request", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet(":id") public getTest(@requestParam("id") id: string, ctx: Router.RouterContext) {
                    return id;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/foo")
                .expect(200, "foo", done);
        });

        it("should bind a method parameter to the request object", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet(":id") public getTest(@request() req: Koa.Request) {
                    return req.url;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/GET")
                .expect(200, "/GET", done);
        });

        it("should bind a method parameter to the response object", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest(@response() res: Koa.Response) {
                    return res.body = "foo";
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "foo", done);
        });

        it("should bind a method parameter to the context object", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest(@context() ctx: Koa.Context) {
                    return ctx.body = "foo";
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "foo", done);
        });

        it("should bind a method parameter to a query parameter", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest(@queryParam("id") id: string) {
                    return id;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .query("id=foo")
                .expect(200, "foo", done);
        });

        it("should bind a method parameter to the request body", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpPost("/") public getTest(@requestBody() reqBody: string) {
                    return reqBody;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            server.setConfig((app) => {
                app.use(bodyParser());
            });
            const body = { foo: "bar" };
            supertest(server.build().listen())
                .post("/")
                .send(body)
                .expect(200, body, done);
        });

        it("should bind a method parameter to the request headers", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getTest(@requestHeaders("testhead") headers: any) {
                    return headers;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .set("TestHead", "foo")
                .expect(200, "foo", done);
        });

        it("should bind a method parameter to a cookie", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public getCookie(@cookies("cookie") cookie: any, ctx: Router.RouterContext) {
                    if (cookie) {
                        ctx.body = cookie;
                    } else {
                        ctx.body = ":(";
                    }
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            server.setConfig((app) => {
                app.use(function (ctx, nextFunc) {
                    ctx.cookies.set("cookie", "hey", { httpOnly: false });
                    nextFunc();
                });
            });
            supertest(server.build().listen())
                .get("/")
                .expect("set-cookie", "cookie=hey; path=/", done);
        });

        it("should bind a method parameter to the next function", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet("/") public async getTest(@next() nextFunc: any) {
                    const err = new Error("foo");
                    await nextFunc();
                }
                @httpGet("/") public getResult() {
                    return "foo";
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/")
                .expect(200, "foo", done);
        });
    });


    describe("Authorization:", () => {
        it("should respond with 401 if there is no auth provider and controller is decorated with @authorizeAll", (done) => {
            @injectable()
            @controller("/")
            @authorizeAll()
            class TestController {
                @httpGet(":id") public getTest(@requestParam("id") id: string, ctx: Router.RouterContext) {
                    return id;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/foo")
                .expect(401, done);
        });

        it("should respond with 401 if provided principal is not authenticated and controller is decorated with @authorizeAll", (done) => {
            @injectable()
            class TestAuthProvider implements AuthProvider {
                public getPrincipal(ctx: Router.RouterContext): Promise<Principal> {
                    const principal: Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(false),
                        isInRole: (role: string) => Promise.resolve(true),
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            @authorizeAll()
            class TestController {
                @httpGet(":id") public getTest(@requestParam("id") id: string, ctx: Router.RouterContext) {
                    return id;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(401, done);
        });

        it("should respond with 403 if provided principal is not in role and controller is decorated with @authorizeAll", (done) => {
            @injectable()
            class TestAuthProvider implements AuthProvider {
                public getPrincipal(ctx: Router.RouterContext): Promise<Principal> {
                    const principal: Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(true),
                        isInRole: (role: string) => {
                            if (role === "role a") {
                                return Promise.resolve(true);
                            }
                            return Promise.resolve(false);
                        },
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            @authorizeAll("role a", "role b")
            class TestController {
                @httpGet(":id") public getTest(@requestParam("id") id: string, ctx: Router.RouterContext) {
                    return id;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(403, done);
        });

        it("should invoke controller if provided principal is authorized according to roles in @authorizeAll", (done) => {
            @injectable()
            class TestAuthProvider implements AuthProvider {
                public getPrincipal(ctx: Router.RouterContext): Promise<Principal> {
                    const principal: Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(true),
                        isInRole: (role: string) => Promise.resolve(true),
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            @authorizeAll("role a", "role b")
            class TestController {
                @httpGet(":id") public getTest(@requestParam("id") id: string, ctx: Router.RouterContext) {
                    return id;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(200, "foo", done);
        });

        it("should invoke controller if provided principal is authenticated and no roles are enforced in @authorizeAll", (done) => {
            @injectable()
            class TestAuthProvider implements AuthProvider {
                public getPrincipal(ctx: Router.RouterContext): Promise<Principal> {
                    const principal: Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(true),
                        isInRole: (role: string) => Promise.resolve(false),
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            @authorizeAll()
            class TestController {
                @httpGet(":id") public getTest(@requestParam("id") id: string, ctx: Router.RouterContext) {
                    return id;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(200, "foo", done);
        });

        // =====
        it("should respond with 401 if there is no auth provider and method is decorated with @authorize", (done) => {
            @injectable()
            @controller("/")
            class TestController {
                @httpGet(":id") @authorize() public getTest(@requestParam("id") id: string, ctx: Router.RouterContext) {
                    return id;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container);
            supertest(server.build().listen())
                .get("/foo")
                .expect(401, done);
        });

        it("should respond with 401 if provided principal is not authenticated and method is decorated with @authorize", (done) => {
            @injectable()
            class TestAuthProvider implements AuthProvider {
                public getPrincipal(ctx: Router.RouterContext): Promise<Principal> {
                    const principal: Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(false),
                        isInRole: (role: string) => Promise.resolve(true),
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            class TestController {
                @httpGet(":id") @authorize() public getTest(@requestParam("id") id: string, ctx: Router.RouterContext) {
                    return id;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(401, done);
        });

        it("should respond with 403 if provided principal is not in role and method is decorated with @authorize", (done) => {
            @injectable()
            class TestAuthProvider implements AuthProvider {
                public getPrincipal(ctx: Router.RouterContext): Promise<Principal> {
                    const principal: Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(true),
                        isInRole: (role: string) => {
                            if (role === "role a") {
                                return Promise.resolve(true);
                            }
                            return Promise.resolve(false);
                        },
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            class TestController {
                @httpGet(":id") @authorize("role a", "role b") public getTest(@requestParam("id") id: string, ctx: Router.RouterContext) {
                    return id;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(403, done);
        });

        it("should invoke controller if provided principal is authorized according to roles in @authorize", (done) => {
            @injectable()
            class TestAuthProvider implements AuthProvider {
                public getPrincipal(ctx: Router.RouterContext): Promise<Principal> {
                    const principal: Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(true),
                        isInRole: (role: string) => Promise.resolve(true),
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            class TestController {
                @httpGet(":id") @authorize("role a", "role b") public getTest(@requestParam("id") id: string, ctx: Router.RouterContext) {
                    return id;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(200, "foo", done);
        });

        it("should invoke controller if provided principal is authenticated and no roles are enforced in @authorize", (done) => {
            @injectable()
            class TestAuthProvider implements AuthProvider {
                public getPrincipal(ctx: Router.RouterContext): Promise<Principal> {
                    const principal: Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(true),
                        isInRole: (role: string) => Promise.resolve(false),
                        isResourceOwner: (resourceId: any) => Promise.resolve(true)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            class TestController {
                @httpGet(":id") @authorize() public getTest(@requestParam("id") id: string, ctx: Router.RouterContext) {
                    return id;
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            supertest(server.build().listen())
                .get("/foo")
                .expect(200, "foo", done);
        });

        it("should protected metohd which is annotated with @authorize but not method in same controller without @authorize", (done) => {
            @injectable()
            class TestAuthProvider implements AuthProvider {
                public getPrincipal(ctx: Router.RouterContext): Promise<Principal> {
                    const principal: Principal = {
                        details: null,
                        isAuthenticated: () => Promise.resolve(false),
                        isInRole: (role: string) => Promise.resolve(false),
                        isResourceOwner: (resourceId: any) => Promise.resolve(false)
                    };
                    return Promise.resolve(principal);
                }
            }

            @injectable()
            @controller("/")
            class TestController {
                @httpGet(":id")
                @authorize()
                public getTest(@requestParam("id") id: string, ctx: Router.RouterContext) {
                    return id;
                }

                @httpGet("")
                public getAll(ctx: Router.RouterContext) {
                    return "response";
                }
            }
            container.bind<Controller>(TYPE.Controller).to(TestController).whenTargetNamed("TestController");

            server = new InversifyKoaServer(container, null, null, null, TestAuthProvider);
            const serverTest = supertest(server.build().listen());
            serverTest
                .get("/foo")
                .expect(401, "foo");
            serverTest
                .get("/")
                .expect(200, "response", done);
        });
    });

});
