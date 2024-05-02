import Router from "@koa/router";
import inversify from "inversify";
import Koa from "koa";
import { BaseMiddleware } from "./base_middleware.js";
import { DEFAULT_ROUTING_ROOT_PATH, METADATA_KEY, PARAMETER_TYPE, TYPE } from "./constants.js";
import { AuthProvider, AuthorizeAllMetadata, AuthorizeMetadata, ConfigFunction, Controller, ControllerMetadata, ControllerMethodMetadata, ControllerParameterMetadata, KoaRequestHandler, Middleware, ParameterMetadata, Principal, RoutingConfig } from "./interfaces.js";
import pathJoin from "./utils.js";

/**
 * Wrapper for the koa server.
 */
export class InversifyKoaServer {

    private _router: Router;
    private _container: inversify.Container;
    private _app: Koa;
    private _configFn: ConfigFunction = () => { };
    private _errorConfigFn: ConfigFunction = () => { };
    private _routingConfig: RoutingConfig;
    private _AuthProvider: { new(): AuthProvider } | null = null;

    /**
     * Wrapper for the koa server.
     *
     * @param container Container loaded with all controllers and their dependencies.
     */
    constructor(
        container: inversify.Container,
        customRouter?: Router | null,
        routingConfig?: RoutingConfig | null,
        customApp?: Koa | null,
        authProvider?: { new(): AuthProvider } | null
    ) {
        this._container = container;
        this._router = customRouter || new Router();
        this._routingConfig = routingConfig || {
            rootPath: DEFAULT_ROUTING_ROOT_PATH
        };
        this._app = customApp || new Koa();
        if (authProvider) {
            this._AuthProvider = authProvider;
            container.bind<AuthProvider>(TYPE.AuthProvider)
                .to(this._AuthProvider);
        }
    }

    /**
     * Sets the configuration function to be applied to the application.
     * Note that the config function is not actually executed until a call to InversifyKoaServer.build().
     *
     * This method is chainable.
     *
     * @param fn Function in which app-level middleware can be registered.
     */
    public setConfig(fn: ConfigFunction): InversifyKoaServer {
        this._configFn = fn;
        return this;
    }

    /**
     * Sets the error handler configuration function to be applied to the application.
     * Note that the error config function is not actually executed until a call to InversifyKoaServer.build().
     *
     * This method is chainable.
     *
     * @param fn Function in which app-level error handlers can be registered.
     */
    public setErrorConfig(fn: ConfigFunction): InversifyKoaServer {
        this._errorConfigFn = fn;
        return this;
    }

    /**
     * Applies all routes and configuration to the server, returning the Koa application.
     */
    public build(): Koa {
        const _self = this;

        // at very first middleware set the principal to the context state
        this._app.use(async (ctx: Router.RouterContext, next: () => Promise<any>) => {
            ctx.state.principal = await _self._getCurrentPrincipal(ctx);
            await next();
        });

        // register server-level middleware before anything else
        if (this._configFn) {
            this._configFn.apply(undefined, [this._app]);
        }

        this.registerControllers();

        // register error handlers after controllers
        if (this._errorConfigFn) {
            this._errorConfigFn.apply(undefined, [this._app]);
        }

        return this._app;
    }

    private registerControllers() {
        // set prefix route in config rootpath
        if (this._routingConfig.rootPath !== DEFAULT_ROUTING_ROOT_PATH) {
            this._router.prefix(this._routingConfig.rootPath);
        }

        const controllers: Controller[] = this._container.getAll<Controller>(TYPE.Controller);

        controllers.forEach((controller: Controller) => {

            const controllerMetadata: ControllerMetadata = Reflect.getOwnMetadata(
                METADATA_KEY.controller,
                controller.constructor
            );

            const methodMetadata: ControllerMethodMetadata[] = Reflect.getOwnMetadata(
                METADATA_KEY.controllerMethod,
                controller.constructor
            );

            const parameterMetadata: ControllerParameterMetadata = Reflect.getOwnMetadata(
                METADATA_KEY.controllerParameter,
                controller.constructor
            );

            const authorizeAllMetadata: AuthorizeAllMetadata = Reflect.getOwnMetadata(
                METADATA_KEY.authorizeAll,
                controller.constructor
            );

            const authorizeMetadata: Record<string, AuthorizeMetadata> = Reflect.getOwnMetadata(
                METADATA_KEY.authorize,
                controller.constructor
            );

            if (controllerMetadata && methodMetadata) {
                const controllerMiddleware = this.resolveMiddleware(...controllerMetadata.middleware);

                methodMetadata.forEach((metadata: ControllerMethodMetadata) => {
                    let paramList: ParameterMetadata[] = [];
                    if (parameterMetadata) {
                        paramList = parameterMetadata[metadata.key] || [];
                    }

                    const authorizationHandler = [];
                    if (authorizeAllMetadata) {
                        const requiredRoles = authorizeAllMetadata.requiredRoles;
                        authorizationHandler.push(this.authorizationHandlerFactory(requiredRoles));
                    }
                    if (authorizeMetadata) {
                        const authorizedMetadataForMethod = authorizeMetadata[metadata.key];
                        if (authorizedMetadataForMethod !== undefined) {
                            const requiredRoles = authorizedMetadataForMethod.requiredRoles;
                            authorizationHandler.push(this.authorizationHandlerFactory(requiredRoles));
                        }
                    }

                    const handler = this.handlerFactory(controllerMetadata.target.name, metadata.key, paramList);
                    const routeMiddleware = this.resolveMiddleware(...metadata.middleware);

                    (this._router as any)[metadata.method](
                        pathJoin(controllerMetadata.path, metadata.path),
                        ...controllerMiddleware,
                        ...routeMiddleware,
                        ...authorizationHandler,
                        handler
                    );
                });
            }
        });

        this._app.use(this._router.routes());
    }

    private authorizationHandlerFactory(requiredRoles: string[]): KoaRequestHandler {
        return async (ctx: Router.RouterContext, next: () => Promise<any>) => {
            let isAuthenticated = false;
            let isAuthorized = false;

            if (ctx.state.principal) {
                const principal: Principal = ctx.state.principal;

                isAuthenticated = await principal.isAuthenticated();
                if (isAuthenticated) {

                    isAuthorized = true;
                    for (const requiredRole of requiredRoles) {
                        const isInRole = await principal.isInRole(requiredRole);
                        if (!isInRole) {
                            isAuthorized = false;
                        }
                    }
                }
            }

            if (!isAuthenticated) {
                ctx.throw(401);
            } else if (!isAuthorized) {
                ctx.throw(403);
            } else {
                return await next();
            }
        };
    }

    private resolveMiddleware(...middleware: Middleware[]): KoaRequestHandler[] {
        return middleware.map(middlewareItem => {
            if (this._container.isBound(middlewareItem)) {

                type MiddlewareInstance = KoaRequestHandler | BaseMiddleware;
                const middlewareInstance = this._container.get<MiddlewareInstance>(middlewareItem);

                if (middlewareInstance instanceof BaseMiddleware) {
                    return function (ctx: Router.RouterContext, next: () => Promise<any>) {
                        return middlewareInstance.handler(ctx, next);
                    };
                } else {
                    return middlewareInstance;
                }

            } else {
                return middlewareItem as KoaRequestHandler;
            }
        });
    }

    private handlerFactory(controllerName: string, key: string,
        parameterMetadata: ParameterMetadata[]): KoaRequestHandler {
        // this function works like another top middleware to extract and inject arguments
        return async (ctx: Router.RouterContext, next: () => Promise<any>) => {
            const args = this.extractParameters(ctx, next, parameterMetadata);
            const result = (await this._container.getNamed(TYPE.Controller, controllerName) as any)[key](...args);

            if (result && result instanceof Promise) {
                // koa handle promises
                return result;
            } else if (result && !ctx.headerSent) {
                ctx.body = result;
            }
        };
    }

    private extractParameters(ctx: Router.RouterContext, next: () => Promise<any>,
        params: ParameterMetadata[]): any[] {
        const args = [];
        if (!params || !params.length) {
            return [ctx, next];
        }
        for (const item of params) {

            switch (item.type) {
                default: args[item.index] = ctx; break; // response
                case PARAMETER_TYPE.RESPONSE: args[item.index] = this.getParam(ctx.response, null, item.parameterName); break;
                case PARAMETER_TYPE.REQUEST: args[item.index] = this.getParam(ctx.request, null, item.parameterName); break;
                case PARAMETER_TYPE.NEXT: args[item.index] = next; break;
                case PARAMETER_TYPE.CTX: args[item.index] = this.getParam(ctx, null, item.parameterName); break;
                case PARAMETER_TYPE.PARAMS: args[item.index] = this.getParam(ctx, "params", item.parameterName); break;
                case PARAMETER_TYPE.QUERY: args[item.index] = this.getParam(ctx, "query", item.parameterName); break;
                case PARAMETER_TYPE.BODY: args[item.index] = this.getParam(ctx.request, "body", item.parameterName); break;
                case PARAMETER_TYPE.HEADERS: args[item.index] = this.getParam(ctx.request, "headers", item.parameterName); break;
                case PARAMETER_TYPE.COOKIES: args[item.index] = this.getParam(ctx, "cookies", item.parameterName); break;
            }

        }
        args.push(ctx, next);
        return args;
    }

    private getParam(source: any, paramType: string | null, name: string) {
        const param = paramType === null ? source : source[paramType] || source;

        return param[name] || this.checkQueryParam(paramType, param, name);
    }

    private checkQueryParam(paramType: string | null, param: any, name: string) {
        if (paramType === "query") {
            return undefined;
        } if (paramType === "cookies") {
            return param.get(name);
        } else {
            return param;
        }
    }

    private async _getCurrentPrincipal(ctx: Router.RouterContext): Promise<Principal> {
        if (this._AuthProvider) {
            const authProvider = this._container.get<AuthProvider>(TYPE.AuthProvider);
            return await authProvider.getPrincipal(ctx);
        } else {
            return Promise.resolve<Principal>({
                details: null,
                isAuthenticated: () => Promise.resolve(false),
                isInRole: (role: string) => Promise.resolve(false),
                isResourceOwner: (resourceId: any) => Promise.resolve(false)
            });
        }
    }
}
