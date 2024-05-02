import { expect } from "chai";
import { METADATA_KEY, PARAMETER_TYPE } from "../src/constants.js";
import { authorize, authorizeAll, controller, httpMethod, params } from "../src/decorators.js";
import {
    AuthorizeAllMetadata, AuthorizeMetadata, ControllerMetadata, ControllerMethodMetadata,
    ControllerParameterMetadata, ParameterMetadata
} from "../src/interfaces.js";

describe("Unit Test: Controller Decorators", () => {

    it("should add controller metadata to a class when decorated with @controller", (done) => {
        const middleware = [function () { return; }, "foo", Symbol("bar")];
        const path = "foo";

        @controller(path, ...middleware)
        class TestController { }

        const controllerMetadata: ControllerMetadata = Reflect.getMetadata("_controller", TestController);

        expect(controllerMetadata.middleware).eql(middleware);
        expect(controllerMetadata.path).eql(path);
        expect(controllerMetadata.target).eql(TestController);
        done();
    });


    it("should add method metadata to a class when decorated with @httpMethod", (done) => {
        const middleware = [function () { return; }, "bar", Symbol("baz")];
        const path = "foo";
        const method = "get";

        class TestController {
            @httpMethod(method, path, ...middleware)
            public test() { return; }

            @httpMethod("foo", "bar")
            public test2() { return; }

            @httpMethod("bar", "foo")
            public test3() { return; }
        }

        const methodMetadata: ControllerMethodMetadata[] = Reflect.getMetadata("_controller-method", TestController);

        expect(methodMetadata.length).eql(3);

        const metadata: ControllerMethodMetadata = methodMetadata[0];

        expect(metadata.middleware).eql(middleware);
        expect(metadata.path).eql(path);
        expect(metadata.target.constructor).eql(TestController);
        expect(metadata.key).eql("test");
        expect(metadata.method).eql(method);
        done();
    });

    it("should add parameter metadata to a class when decorated with @params", (done) => {
        const middleware = [function () { return; }, "bar", Symbol("baz")];
        const path = "foo";
        const method = "get";
        const methodName = "test";

        class TestController {
            @httpMethod(method, path, ...middleware)
            public test(@params(PARAMETER_TYPE.PARAMS, "id") id: any, @params(PARAMETER_TYPE.PARAMS, "cat") cat: any) { return; }

            @httpMethod("foo", "bar")
            public test2(@params(PARAMETER_TYPE.PARAMS, "dog") dog: any) { return; }

            @httpMethod("bar", "foo")
            public test3() { return; }
        }
        const methodMetadataList: ControllerParameterMetadata =
            Reflect.getMetadata(METADATA_KEY.controllerParameter, TestController);
        expect(Object.prototype.hasOwnProperty.call(methodMetadataList, "test")).to.eqls(true);

        const paramaterMetadataList: ParameterMetadata[] = methodMetadataList[methodName];
        expect(paramaterMetadataList.length).eql(2);

        const paramaterMetadata: ParameterMetadata = paramaterMetadataList[0];
        expect(paramaterMetadata.index).eql(0);
        expect(paramaterMetadata.parameterName).eql("id");
        done();
    });

    it("should add authorize metadata to a class when decorated with @authorizeAll", (done) => {
        const requiredRoles = ["role a", "role b"];

        @authorizeAll(...requiredRoles)
        class TestController { }

        const authorizeAllMetadata: AuthorizeAllMetadata = Reflect.getMetadata("_authorize-all", TestController);

        expect(authorizeAllMetadata.requiredRoles).eql(requiredRoles);
        expect(authorizeAllMetadata.target).eql(TestController);
        done();
    });


    it("should add authorize metadata to a class when decorated with @authorize", (done) => {
        const requiredRoles = ["role a", "role b"];

        class TestController {
            @authorize(...requiredRoles)
            public test() { return; }

            @authorize("foo", "bar")
            public test2() { return; }

            @authorize("bar", "foo")
            public test3() { return; }
        }

        const authorizeMetadata: Record<string, AuthorizeMetadata> = Reflect.getMetadata("_authorize", TestController);

        expect(Object.keys(authorizeMetadata).length).eql(3);

        const metadata: AuthorizeMetadata = authorizeMetadata.test;

        expect(metadata.requiredRoles).eql(requiredRoles);
        expect(metadata.target.constructor).eql(TestController);
        expect(metadata.key).eql("test");
        done();
    });

});
