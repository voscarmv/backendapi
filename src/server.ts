import express, { type Request, type Response, type Express } from "express";
import { type CorsOptions } from "cors";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { messages } from './schema.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { and, asc, eq, sql } from "drizzle-orm";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export interface StoreBackend {
    migrate: () => void;
    listen: () => void;
};

export type MessageStoreBackendParams = {
    dbUrl: string,
    port: number,
    corsOpts?: CorsOptions,
};

export class AiMessageStoreBackend implements StoreBackend {
    #db: NodePgDatabase<Record<string, never>>;
    #app: Express;
    #port: number;
    constructor(params: MessageStoreBackendParams) {
        this.#db = drizzle(params.dbUrl);
        this.#app = express();
        if (params.corsOpts) {
            this.#app.use(cors(params.corsOpts));
        } else {
            this.#app.use(cors());
        }
        this.#app.use(helmet());
        this.#app.use(morgan("combined"));
        this.#app.use(express.json());
        this.#port = params.port;
        type CreateMessageBody = {
            user_id: string;
            queued: boolean;
            msgs: string[];
        };
        this.#app.post(
            "/messages",
            async (req: Request<{}, {}, CreateMessageBody>, res: Response) => {
                try {
                    const { user_id, queued, msgs } = req.body;
                    const response: { message: string }[] = await this.#db
                        .insert(messages)
                        .values(msgs.map((msg) => (
                            {
                                user_id,
                                queued,
                                message: msg
                            }
                        )))
                        .returning({ message: messages.message });
                    res.json(response.map(item => item.message));
                } catch (err) {
                    res.status(500).json({ error: String(err) });
                }
            }
        );
        this.#app.get(
            "/messages/:user_id",
            async (req: Request<{ user_id: string }>, res: Response) => {
                try {
                    const response: { message: string }[] = await this.#db
                        .select({ message: messages.message })
                        .from(messages)
                        .where(eq(messages.user_id, req.params.user_id))
                        .orderBy(asc(messages.updated_at), asc(messages.id));
                    res.json(response.map(item => item.message));
                } catch (err) {
                    res.status(500).json({ error: String(err) });
                }
            }
        );
        this.#app.get(
            "/messages/:user_id/queued",
            async (req: Request<{ user_id: string }>, res: Response) => {
                try {
                    const response: { message: string }[] = await this.#db
                        .select({ message: messages.message })
                        .from(messages)
                        .where(
                            and(
                                eq(messages.queued, true),
                                eq(messages.user_id, req.params.user_id)
                            ));
                    res.json(response.map(item => item.message));
                } catch (err) {
                    res.status(500).json({ error: String(err) });
                }
            }
        );
        this.#app.put(
            "/messages/:user_id/unqueue",
            async (req: Request<{ user_id: string }>, res: Response) => {
                try {
                    const response: { message: string }[] = await this.#db
                        .update(messages)
                        .set({ queued: false, updated_at: sql`now()` })
                        .where(eq(messages.user_id, req.params.user_id))
                        .returning({ message: messages.message });
                    res.json(response.map(item => item.message));
                } catch (err) {
                    res.status(500).json({ error: String(err) });
                }
            }
        );
    }
    async migrate() {
        try {
            await migrate(this.#db, { migrationsFolder: `${__dirname}/drizzle` });
        } catch(e: any) {
            console.log(e.message);
        }
        return;
    }
    listen() {
        this.#app.listen(this.#port);
        return;
    }
}
