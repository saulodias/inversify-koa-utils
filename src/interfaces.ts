import { RouterContext } from "@koa/router";
import { interfaces } from "inversify";
import * as Koa from "koa";
import { PARAMETER_TYPE } from "./constants";

export type Middleware = (interfaces.ServiceIdentifier<any> | KoaRequestHandler);

export interface ControllerMetadata {
    path: string;
    middleware: Middleware[];
    target: any;
}

export interface ControllerMethodMetadata extends ControllerMetadata {
    method: string;
    key: string;
}

export interface ControllerParameterMetadata {
    [methodName: string]: ParameterMetadata[];
}

export interface ParameterMetadata {
    parameterName: string;
    index: number;
    type: PARAMETER_TYPE;
}

export interface AuthorizeAllMetadata {
    requiredRoles: string[];
    target: any;
}

export interface AuthorizeMetadata extends AuthorizeAllMetadata {
    key: string;
}

export interface Controller {
}

export type HandlerDecorator = (target: any, key: string, descriptor: any) => void;

export type ConfigFunction = (app: Koa) => void;

export interface RoutingConfig {
    rootPath: string;
}

export type KoaRequestHandler = (ctx: RouterContext, next: () => Promise<any>) => any;

export interface Principal {
    details: any;
    isAuthenticated(): Promise<boolean>;
    isResourceOwner(resourceId: unknown): Promise<boolean>;
    isInRole(role: string): Promise<boolean>;
}

export interface AuthProvider {
    getPrincipal(ctx: RouterContext): Promise<Principal>;
}
