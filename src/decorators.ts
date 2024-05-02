import "reflect-metadata";

import { METADATA_KEY, PARAMETER_TYPE } from "./constants.js";
import {
    AuthorizeAllMetadata, AuthorizeMetadata, ControllerMetadata, ControllerMethodMetadata,
    ControllerParameterMetadata, HandlerDecorator, Middleware, ParameterMetadata
} from "./interfaces.js";

export function controller(path: string, ...middleware: Middleware[]): ClassDecorator {
    return function (target: any) {
        const metadata: ControllerMetadata = { path, middleware, target };
        Reflect.defineMetadata(METADATA_KEY.controller, metadata, target);
    };
}

export function all(path: string, ...middleware: Middleware[]): HandlerDecorator {
    return httpMethod("all", path, ...middleware);
}

export function httpGet(path: string, ...middleware: Middleware[]): HandlerDecorator {
    return httpMethod("get", path, ...middleware);
}

export function httpPost(path: string, ...middleware: Middleware[]): HandlerDecorator {
    return httpMethod("post", path, ...middleware);
}

export function httpPut(path: string, ...middleware: Middleware[]): HandlerDecorator {
    return httpMethod("put", path, ...middleware);
}

export function httpPatch(path: string, ...middleware: Middleware[]): HandlerDecorator {
    return httpMethod("patch", path, ...middleware);
}

export function httpHead(path: string, ...middleware: Middleware[]): HandlerDecorator {
    return httpMethod("head", path, ...middleware);
}

export function httpDelete(path: string, ...middleware: Middleware[]): HandlerDecorator {
    return httpMethod("delete", path, ...middleware);
}

export function httpMethod(method: string, path: string, ...middleware: Middleware[]): HandlerDecorator {
    return function (target: object, key: string, descriptor: any) {
        const metadata: ControllerMethodMetadata = { path, middleware, method, target, key };
        const metadataList: ControllerMethodMetadata[] = getMetadataList<ControllerMethodMetadata>(METADATA_KEY.controllerMethod, target);

        metadataList.push(metadata);
    };
}

export function authorizeAll(...requiredRoles: string[]): ClassDecorator {
    return function (target: any) {
        const metadata: AuthorizeAllMetadata = { requiredRoles, target };
        Reflect.defineMetadata(METADATA_KEY.authorizeAll, metadata, target);
    };
}

export function authorize(...requiredRoles: string[]): HandlerDecorator {
    return function (target: any, key: string, descriptor: any) {
        const metadata: AuthorizeMetadata = { requiredRoles, target, key };
        const metadataList: AuthorizeMetadata[] = getMetadataList<AuthorizeMetadata>(METADATA_KEY.authorize, target);

        metadataList[key as any] = metadata;
    };
}

function getMetadataList<T>(metadataKey: string, target: any): T[] {
    let metadataList: T[] = [];

    if (!Reflect.hasOwnMetadata(metadataKey, target.constructor)) {
        Reflect.defineMetadata(metadataKey, metadataList, target.constructor);
    } else {
        metadataList = Reflect.getOwnMetadata(metadataKey, target.constructor);
    }

    return metadataList;
}

export const request = paramDecoratorFactory(PARAMETER_TYPE.REQUEST);
export const response = paramDecoratorFactory(PARAMETER_TYPE.RESPONSE);
export const requestParam = paramDecoratorFactory(PARAMETER_TYPE.PARAMS);
export const queryParam = paramDecoratorFactory(PARAMETER_TYPE.QUERY);
export const requestBody = paramDecoratorFactory(PARAMETER_TYPE.BODY);
export const requestHeaders = paramDecoratorFactory(PARAMETER_TYPE.HEADERS);
export const cookies = paramDecoratorFactory(PARAMETER_TYPE.COOKIES);
export const next = paramDecoratorFactory(PARAMETER_TYPE.NEXT);
export const context = paramDecoratorFactory(PARAMETER_TYPE.CTX);


function paramDecoratorFactory(parameterType: PARAMETER_TYPE) {
    return function (name?: string) {
        name = name || "default";
        return params(parameterType, name);
    };
}

export function params(type: PARAMETER_TYPE, parameterName: string) {
    return function (target: object, methodName: string, index: number) {

        let metadataList: ControllerParameterMetadata = {};
        let parameterMetadataList: ParameterMetadata[] = [];
        const parameterMetadata: ParameterMetadata = {
            index,
            parameterName,
            type
        };
        if (!Reflect.hasOwnMetadata(METADATA_KEY.controllerParameter, target.constructor)) {
            parameterMetadataList.unshift(parameterMetadata);
        } else {
            metadataList = Reflect.getOwnMetadata(METADATA_KEY.controllerParameter, target.constructor);
            if (Object.prototype.hasOwnProperty.call(metadataList, methodName)) {
                parameterMetadataList = metadataList[methodName];
            }
            parameterMetadataList.unshift(parameterMetadata);
        }
        metadataList[methodName] = parameterMetadataList;
        Reflect.defineMetadata(METADATA_KEY.controllerParameter, metadataList, target.constructor);
    };
}

