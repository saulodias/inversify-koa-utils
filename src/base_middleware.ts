import { injectable } from "inversify";
import { RouterContext } from "koa-router";

@injectable()
export abstract class BaseMiddleware implements BaseMiddleware {
    public abstract handler(
        ctx: RouterContext,
        next: () => Promise<any>
    ): any;
}
