import { expect } from "chai";
import { Container, injectable } from "inversify";
import Koa from "koa";
import supertest from "supertest";
import { TYPE } from "../src/constants.js";
import {
    controller,
    httpGet,
    queryParam,
    request,
    requestParam,
    response
} from "../src/decorators.js";
import { InversifyKoaServer } from "../src/server.js";

describe("Unit Test: Previous bugs", () => {

    it("should support multiple controller methods with param annotations", (done) => {

        const container = new Container();

        @injectable()
        @controller("/api/test/")
        class TestController {
            @httpGet("/")
            public get(
                @request() req: Koa.Request,
                @response() res: Koa.Response
            ) {
                expect(req.url).not.to.eql(undefined);
                expect((req as any).setHeader).to.eql(undefined);
                expect(res.headers).not.to.eql(undefined);
                expect((res as any).url).to.eql(undefined);
                res.body = [{ id: 1 }, { id: 2 }];
            }
            @httpGet("/:id")
            public getById(
                @requestParam("id") id: string,
                @request() req: Koa.Request,
                @response() res: Koa.Response
            ) {
                expect(id).to.eql("5");
                expect(req.url).not.to.eql(undefined);
                expect((req as any).setHeader).to.eql(undefined);
                expect(res.headers).not.to.eql(undefined);
                expect((res as any).url).to.eql(undefined);
                res.body = { id: id };
            }
        }

        container.bind(TYPE.Controller).to(TestController);
        const server = new InversifyKoaServer(container);
        const app = server.build().listen();

        supertest(app).get("/api/test/")
            .expect("Content-Type", /json/)
            .expect(200)
            .then(response1 => {
                expect(Array.isArray(response1.body)).to.eql(true);
                expect(response1.body[0].id).to.eql(1);
                expect(response1.body[1].id).to.eql(2);
            });

        supertest(app).get("/api/test/5")
            .expect("Content-Type", /json/)
            .expect(200)
            .then(response2 => {
                expect(Array.isArray(response2.body)).to.eql(false);
                expect(response2.body.id).to.eql("5");
                done();
            });

    });

    it("should support empty query params", (done) => {
        const container = new Container();

        @injectable()
        @controller("/api/test")
        class TestController {
            @httpGet("")
            public get(
                @request() req: Koa.Request,
                @response() res: Koa.Response,
                @queryParam("empty") empty: string,
                @queryParam("test") test: string
            ) {
                return { empty: empty, test: test };
            }

        }

        container.bind(TYPE.Controller).to(TestController);
        const server = new InversifyKoaServer(container);
        const app = server.build().listen();

        supertest(app).get("/api/test?test=testquery")
            // .query({ test: "testquery" })
            .expect("Content-Type", /json/)
            .expect(200)
            .then(response1 => {
                expect(response1.body.test).to.eql("testquery");
                expect(response1.body.empty).to.eq(undefined);
                done();
            });

    });

});
