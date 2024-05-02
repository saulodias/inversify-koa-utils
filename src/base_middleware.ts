import "reflect-metadata";

import { RouterContext } from "@koa/router";
import { injectable } from "inversify";

@injectable()
export abstract class BaseMiddleware {
    public abstract handler(
        ctx: RouterContext,
        next: () => Promise<any>
    ): any;
}
